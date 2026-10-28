import logging
import uuid
from datetime import UTC, datetime, timedelta
from enum import StrEnum

import bcrypt
import jwt

from app.core.config import get_settings

logger = logging.getLogger(__name__)

try:
    # Optional import: cryptography joins requirements.txt with this change, but
    # the app must keep booting on images built before it lands (and in test
    # venvs without it) — helpers below degrade to legacy plaintext behavior.
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:  # pragma: no cover - exercised only without cryptography
    Fernet = None  # type: ignore[assignment,misc]
    InvalidToken = None  # type: ignore[assignment,misc]


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"
    ROM = "rom"
    BIOS = "bios"
    BACKUP_DOWNLOAD = "backup_download"


class TokenError(Exception):
    """Raised for any invalid, expired, malformed, or wrong-type token."""


# Refresh-token lifetime issued when the login form's "Remember me" checkbox is
# ticked — keeps the device signed in long-term. The default (unticked) lifetime
# stays at settings.refresh_token_expire_days (default 30 days).
REMEMBER_ME_REFRESH_DAYS = 365


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def _require_secret() -> str:
    secret = get_settings().jwt_secret_key
    if not secret:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. Generate one "
            '(e.g. `python -c "import secrets; print(secrets.token_hex(32))"`) '
            "and add it to the repo-root .env."
        )
    return secret


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": TokenType.ACCESS.value,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, _require_secret(), algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: int, remember_me: bool = False) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at). The caller is responsible for persisting
    (user_id, jti, expires_at) so the token can be revoked before it naturally expires —
    see app/models/system.py: RefreshToken.

    remember_me=True issues a long-lived refresh token (a year) so the "Remember me"
    login checkbox keeps the device signed in; the default is the configured short
    lifetime (default 30 days).
    """
    settings = get_settings()
    now = datetime.now(UTC)
    jti = str(uuid.uuid4())
    lifetime_days = REMEMBER_ME_REFRESH_DAYS if remember_me else settings.refresh_token_expire_days
    expires_at = now + timedelta(days=lifetime_days)
    payload = {
        "sub": str(user_id),
        "type": TokenType.REFRESH.value,
        "jti": jti,
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(payload, _require_secret(), algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def create_rom_token(user_id: int, rom_id: int, expires_minutes: int = 10) -> str:
    """A short-lived token scoped to downloading one ROM file. EmulatorJS fetches the ROM
    itself (from inside the player iframe) and can't attach an Authorization header, so the
    token travels in the URL path instead — kept narrow (one rom id, its own token type,
    minutes-long expiry) so a leaked URL is worth very little. Only checked when the
    request starts, so a slow download of a large file isn't cut off mid-transfer."""
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": TokenType.ROM.value,
        "rom": rom_id,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, _require_secret(), algorithm=settings.jwt_algorithm)


def create_bios_token(user_id: int, bios_id: int, expires_minutes: int = 10) -> str:
    """Same idea as create_rom_token, scoped to one uploaded BIOS file: the player fetches
    BIOS files itself and can't send an Authorization header either."""
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": TokenType.BIOS.value,
        "bios": bios_id,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, _require_secret(), algorithm=settings.jwt_algorithm)


def create_backup_download_token(user_id: int, expires_minutes: int = 5) -> str:
    """A one-purpose link for downloading a full backup: the .zip can be many GB, so the
    browser downloads it directly (streamed to disk) instead of through a script holding it
    in memory — and a plain navigation can't carry an Authorization header."""
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": TokenType.BACKUP_DOWNLOAD.value,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, _require_secret(), algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: TokenType) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, _require_secret(), algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    if payload.get("type") != expected_type.value:
        raise TokenError(f"Expected a {expected_type.value} token")

    return payload


# --- SMB passwords at rest -------------------------------------------------
# playnite_smb_password / export_smb_password live in the same String columns
# as before (no schema change): when a Fernet key is configured, values are
# stored as Fernet tokens; otherwise they stay plaintext (legacy behavior).
# Decryption tolerates legacy rows: a value that fails to decrypt is returned
# as-is, and the next save re-encrypts it.

_smb_key_warning_logged = False


def _smb_fernet() -> "Fernet | None":
    """Fernet cipher from settings, or None when encryption is unavailable
    (no key configured, cryptography not installed, or a malformed key).
    Never raises — a missing key must warn, not break boot."""
    global _smb_key_warning_logged
    key = get_settings().smb_encryption_key
    if not key or Fernet is None:
        if not _smb_key_warning_logged:
            logger.warning(
                "SMB_ENCRYPTION_KEY is not set (or cryptography is not installed) — "
                "SMB passwords are stored in plaintext"
            )
            _smb_key_warning_logged = True
        return None
    try:
        return Fernet(key)
    except (ValueError, TypeError):
        if not _smb_key_warning_logged:
            logger.warning("SMB_ENCRYPTION_KEY is malformed — SMB passwords are stored in plaintext")
            _smb_key_warning_logged = True
        return None


def encrypt_smb_password(plaintext: str | None) -> str | None:
    """Encrypt a password for storage, or return it unchanged when encryption
    is unavailable. None passes through (callers use None for 'untouched')."""
    if plaintext is None:
        return None
    cipher = _smb_fernet()
    if cipher is None:
        return plaintext
    return cipher.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_smb_password(stored: str | None) -> str | None:
    """Decrypt a stored SMB password. Legacy plaintext rows pass through
    unchanged (and are re-encrypted on next save); a Fernet token that fails
    to decrypt — e.g. the key was rotated — is logged and passed through
    rather than crashing the caller."""
    if stored is None:
        return None
    cipher = _smb_fernet()
    if cipher is None:
        return stored
    try:
        return cipher.decrypt(stored.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        if stored.startswith("gAAAAA"):
            logger.warning("Stored SMB password could not be decrypted — wrong key?")
        else:
            logger.debug("Stored SMB password is legacy plaintext, passing through")
        return stored
