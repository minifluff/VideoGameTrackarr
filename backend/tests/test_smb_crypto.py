"""SMB password encryption at rest (see app/core/security.py).

cryptography is not installed in the sandbox venv (no PyPI access), so the
real-Fernet test is skipped there via importorskip and runs in CI once the
image rebuild installs the new requirements.txt entry. The no-key and
fake-cipher tests run everywhere and cover the wiring and legacy fallback.
"""

import pytest

from app.core import security
from app.core.config import get_settings


@pytest.fixture()
def smb_key_env(monkeypatch):
    """Point settings at a (test) encryption key, restoring defaults after."""
    monkeypatch.setenv("SMB_ENCRYPTION_KEY", "test-key-accepted-by-the-fake-cipher")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_no_key_passthrough():
    # No SMB_ENCRYPTION_KEY in the test env: values pass through unchanged and
    # boot never breaks. (Settings are re-read fresh; nothing else sets the key.)
    get_settings.cache_clear()
    try:
        assert security.encrypt_smb_password("hunter2") == "hunter2"
        assert security.decrypt_smb_password("hunter2") == "hunter2"
        assert security.encrypt_smb_password(None) is None
        assert security.decrypt_smb_password(None) is None
    finally:
        get_settings.cache_clear()


class _FakeInvalidToken(Exception):
    pass


class _FakeFernet:
    """Minimal stand-in for cryptography.fernet.Fernet (prefix-tagged bytes)."""

    def __init__(self, key):
        self.key = key

    def encrypt(self, data: bytes) -> bytes:
        return b"fake:" + data

    def decrypt(self, token: bytes) -> bytes:
        text = token.decode("utf-8")
        if not text.startswith("fake:"):
            raise _FakeInvalidToken("not a fake token")
        return text[len("fake:") :].encode("utf-8")


def test_fake_cipher_wiring_via_playnite_config(smb_key_env, monkeypatch, db_session, test_user):
    """With a cipher available, saving encrypts and reading back decrypts, and
    legacy plaintext rows still pass through (re-encrypted on next save)."""
    monkeypatch.setattr(security, "Fernet", _FakeFernet)
    monkeypatch.setattr(security, "InvalidToken", _FakeInvalidToken)

    from app.services import playnite_service

    playnite_service.set_config(db_session, test_user, "\\\\srv\\share", "user", "hunter2")
    stored = test_user.playnite_smb_password

    assert stored != "hunter2"
    assert stored.startswith("fake:")
    assert security.decrypt_smb_password(stored) == "hunter2"
    # Legacy plaintext row: returned as-is, not mangled.
    assert security.decrypt_smb_password("plain-old-value") == "plain-old-value"


def test_real_fernet_roundtrip(monkeypatch):
    pytest.importorskip("cryptography")
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    monkeypatch.setenv("SMB_ENCRYPTION_KEY", key)
    get_settings.cache_clear()
    try:
        stored = security.encrypt_smb_password("hunter2")
        assert stored != "hunter2"
        assert stored.startswith("gAAAAA")
        assert security.decrypt_smb_password(stored) == "hunter2"
        assert security.decrypt_smb_password("legacy-plaintext") == "legacy-plaintext"
    finally:
        get_settings.cache_clear()
