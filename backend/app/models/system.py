from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UTCDateTime


class User(TimestampMixin, Base):
    """Single admin account gatekeeping this instance — not a multi-tenant user model.
    Library/catalog tables are intentionally not scoped by user_id; see roadmap decision."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    public_share_token: Mapped[str | None] = mapped_column(
        String(64), unique=True, comment="Unlisted share-link token for the public Games/Hardware view"
    )
    overview_layout: Mapped[list | None] = mapped_column(
        JSON, comment="Dashboard section order/visibility, as [{key, hidden}] — null until customised"
    )
    filter_layout: Mapped[list | None] = mapped_column(
        JSON, comment="Games filter dialog field order/visibility, as [{key, hidden}] — null until customised"
    )
    overview_card_size: Mapped[float | None] = mapped_column(
        Float, comment="Dashboard card-size scale (0.5 small, 1.0 medium, 2.0 large) — null means medium"
    )
    steam_id_64: Mapped[str | None] = mapped_column(
        String(32), comment="Steam profile SteamID64, used for Steam Web API sync"
    )
    retroachievements_username: Mapped[str | None] = mapped_column(
        String(64), comment="RetroAchievements username shown on the Achievements page"
    )
    retroachievements_api_key: Mapped[str | None] = mapped_column(
        String(255),
        comment="RetroAchievements Web API key, pasted on the Integrations page; "
        "encrypted with the SMB Fernet key when one is configured, else plaintext like the SMB passwords",
    )
    gog_refresh_token: Mapped[str | None] = mapped_column(
        String(255),
        comment="GOG Galaxy OAuth refresh token, saved on connect from the Integrations page; "
        "encrypted with the SMB Fernet key when one is configured, else plaintext like the SMB passwords. "
        "The refresh token rotates on every use — the stored value is replaced whenever a refresh returns a new one",
    )
    gog_user_id: Mapped[str | None] = mapped_column(
        String(64), comment="GOG account id from the OAuth token response, used for the GOG Sync job"
    )
    gog_username: Mapped[str | None] = mapped_column(
        String(64), comment="GOG username shown on the Integrations page"
    )
    playnite_smb_path: Mapped[str | None] = mapped_column(
        String(1024), comment="SMB/network path to the Playnite data folder (e.g. \\\\server\\share\\Playnite)"
    )
    playnite_smb_username: Mapped[str | None] = mapped_column(
        String(255), comment="Username for SMB authentication to the Playnite share"
    )
    playnite_smb_password: Mapped[str | None] = mapped_column(
        String(255), comment="Password for SMB authentication to the Playnite share"
    )
    export_smb_path: Mapped[str | None] = mapped_column(
        String(1024), comment="SMB/network path to the folder where scheduled exports are written"
    )
    export_smb_username: Mapped[str | None] = mapped_column(
        String(255), comment="Username for SMB authentication to the export share"
    )
    export_smb_password: Mapped[str | None] = mapped_column(
        String(255), comment="Password for SMB authentication to the export share"
    )
    export_retention_count: Mapped[int | None] = mapped_column(
        Integer, comment="How many scheduled exports to keep on the share (oldest deleted first)"
    )
    export_include_files: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0",
        comment="Whether scheduled exports are full backups (JSON + ROMs/saves/BIOS)",
    )


class RefreshToken(Base):
    """Server-side record of issued refresh tokens, so they can be revoked before their
    natural expiry (logout, password change) — access tokens are short-lived and stateless
    and never get a table; only refresh tokens are dangerous enough for long to need this."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    jti: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    # Sign-in family: every login mints one family id, and rotations keep it, so each
    # browser/device is its own family. Reuse detection revokes only the presented
    # token's family — one location's stale or stolen token can no longer sign out
    # every other location. NULL for rows issued before families existed; those
    # graduate to a family on their first rotation after this lands.
    family_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship()
