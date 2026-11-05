import pytest

from app.core.security import create_refresh_token
from app.models.system import RefreshToken
from app.services import auth_service
from app.services.auth_service import AuthError


def _legacy_token(db_session, test_user):
    """A refresh-token row as issued before sign-in families existed: no family id."""
    token, jti, expires_at = create_refresh_token(test_user.id)
    db_session.add(RefreshToken(user_id=test_user.id, jti=jti, expires_at=expires_at, family_id=None))
    db_session.commit()
    return token


def _active_rows(db_session, test_user):
    return (
        db_session.query(RefreshToken)
        .filter(RefreshToken.user_id == test_user.id, RefreshToken.revoked_at.is_(None))
        .all()
    )


def test_rotation_graduates_legacy_token_to_a_family(db_session, test_user):
    token = _legacy_token(db_session, test_user)

    auth_service.rotate_refresh_token(db_session, token)

    rows = _active_rows(db_session, test_user)
    assert len(rows) == 1
    assert rows[0].family_id is not None


def test_replayed_legacy_token_revokes_only_legacy_rows(db_session, test_user):
    first_legacy = _legacy_token(db_session, test_user)
    second_legacy = _legacy_token(db_session, test_user)

    # Rotating the first legacy token graduates it to a family of its own.
    _, rotated_first = auth_service.rotate_refresh_token(db_session, first_legacy)

    # Replaying the pre-rotation legacy token still fails — and revokes the other
    # still-legacy row, but not the graduated family.
    with pytest.raises(AuthError):
        auth_service.rotate_refresh_token(db_session, first_legacy)
    with pytest.raises(AuthError):
        auth_service.rotate_refresh_token(db_session, second_legacy)
    auth_service.rotate_refresh_token(db_session, rotated_first)
