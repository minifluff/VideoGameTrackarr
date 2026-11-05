import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.security import (
    TokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.system import RefreshToken, User
from app.services.exceptions import ConflictError, NotFoundError

logger = logging.getLogger(__name__)


class AuthError(Exception):
    """Raised for any auth failure that should surface as 401 to the API client."""


class WrongPasswordError(Exception):
    """The current password given to change it is wrong — 400."""


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Invalid username or password")
    return user


def create_initial_admin(db: Session, username: str, password: str) -> User:
    """Provisions the very first user account from the web setup flow. Re-checks
    emptiness here (not just at the route layer) so this can never become a backdoor
    register endpoint once an admin already exists — see app/api/routes/auth.py's /setup
    docstring for why a public register endpoint is deliberately not otherwise offered."""
    if db.query(User).count() > 0:
        raise ConflictError("Setup has already been completed.")

    user = User(username=username, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """Sets a new password and deletes every refresh token the user has, so other browsers
    and devices are signed out once their short-lived access token runs out. The caller
    issues fresh tokens for the session that made the change.

    Deletion (not revocation) is deliberate: a stale client's later refresh then finds
    no record and fails quietly, instead of tripping reuse detection and revoking the
    fresh session too. Only rotation-revoked tokens are reuse evidence.
    """
    if not verify_password(current_password, user.password_hash):
        raise WrongPasswordError("The current password is incorrect.")

    user.password_hash = hash_password(new_password)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete(synchronize_session=False)
    db.commit()


def _revoke_family(db: Session, user_id: int, family_id: str | None) -> None:
    """Revokes every still-active refresh token in one sign-in family. A NULL
    family means pre-family rows, so it revokes the user's other pre-family rows
    too — the old behavior, kept only until those rows graduate to a family on
    their next rotation. Family rows are never touched by another family's reuse."""
    query = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
    )
    if family_id is None:
        query = query.filter(RefreshToken.family_id.is_(None))
    else:
        query = query.filter(RefreshToken.family_id == family_id)
    query.update({RefreshToken.revoked_at: datetime.now(UTC)}, synchronize_session=False)
    db.commit()


def issue_tokens(
    db: Session, user: User, remember_me: bool = False, family_id: str | None = None
) -> tuple[str, str]:
    """Issues an access+refresh pair. A fresh login gets a fresh family id; a
    rotation passes the rotated row's family so the chain stays in its family.
    Passing None mints a family — that is how pre-family rows graduate."""
    access_token = create_access_token(user.id)
    refresh_token, jti, expires_at = create_refresh_token(user.id, remember_me=remember_me)
    db.add(
        RefreshToken(
            user_id=user.id, jti=jti, expires_at=expires_at, family_id=family_id or str(uuid.uuid4())
        )
    )
    db.commit()
    return access_token, refresh_token


def rotate_refresh_token(db: Session, refresh_token: str) -> tuple[str, str]:
    """Validates a refresh token, revokes it, and issues a fresh access+refresh pair.

    Reuse detection: presenting an already-revoked token is treated as a
    compromise signal, not just a failed refresh — every still-active token in
    that token's sign-in family is revoked (the attacker's rotated family dies
    with it) and the event is logged, then the request still fails with
    AuthError. Other families — other browsers, devices, origins — are untouched,
    so one location's stale or stolen token can no longer sign out every other
    location. A token that never existed (unknown jti, bad signature, expired)
    is NOT reuse evidence — it fails quietly as before, so random guesses can't
    mass-revoke sessions.

    A "Remember me" session keeps its long lifetime across rotations: the rotated
    token was issued with ~a year of life while a normal one gets
    settings.refresh_token_expire_days (default 30 days), so anything with far more
    than the normal lifetime left is re-issued as remember-me.
    """
    revoked = _load_revoked_record(db, refresh_token)
    if revoked is not None:
        logger.warning(
            "Revoked refresh token presented for user %s — revoking refresh tokens in its family",
            revoked.user_id,
        )
        _revoke_family(db, revoked.user_id, revoked.family_id)
        raise AuthError("Refresh token has been revoked")

    record, user = _load_active_refresh_token(db, refresh_token)

    record.revoked_at = datetime.now(UTC)
    db.flush()

    remember_me = (record.expires_at - datetime.now(UTC)) > timedelta(days=60)
    return issue_tokens(db, user, remember_me=remember_me, family_id=record.family_id)


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    try:
        record, _ = _load_active_refresh_token(db, refresh_token)
    except AuthError:
        return  # logout is idempotent: an already-invalid token is not an error

    record.revoked_at = datetime.now(UTC)
    db.commit()


def get_or_create_share_token(db: Session, user: User) -> str:
    if user.public_share_token is None:
        user.public_share_token = secrets.token_urlsafe(32)
        db.commit()
        db.refresh(user)
    return user.public_share_token


def regenerate_share_token(db: Session, user: User) -> str:
    # Regenerating immediately breaks every URL built from the old token — that's the
    # only way to revoke a leaked share link, since there's no per-link revocation.
    user.public_share_token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(user)
    return user.public_share_token


def get_user_by_share_token(db: Session, token: str) -> User:
    # 404, not 401/403 — a wrong/guessed token shouldn't be distinguishable from a
    # not-found route, so a bad guess can't tell an attacker they're "close."
    user = db.query(User).filter(User.public_share_token == token).first()
    if user is None:
        raise NotFoundError("Share link not found")
    return user


def _load_revoked_record(db: Session, refresh_token: str) -> RefreshToken | None:
    """The RefreshToken row for a token that was already revoked, or None.
    Undecodable tokens (bad signature, expired, wrong type) and unknown jtis
    return None — they are not reuse evidence, so they must not trigger the
    family-wide revocation in rotate_refresh_token."""
    try:
        payload = decode_token(refresh_token, TokenType.REFRESH)
    except TokenError:
        return None
    record = db.query(RefreshToken).filter(RefreshToken.jti == payload.get("jti")).first()
    if record is None or record.revoked_at is None:
        return None
    return record


def _load_active_refresh_token(db: Session, refresh_token: str) -> tuple[RefreshToken, User]:
    try:
        payload = decode_token(refresh_token, TokenType.REFRESH)
    except TokenError as exc:
        raise AuthError(str(exc)) from exc

    record = db.query(RefreshToken).filter(RefreshToken.jti == payload.get("jti")).first()
    if record is None or record.revoked_at is not None:
        raise AuthError("Refresh token has been revoked")

    user = db.get(User, record.user_id)
    if user is None:
        raise AuthError("User no longer exists")

    return record, user
