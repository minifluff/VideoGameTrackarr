from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UTCDateTime


class PlayniteLibraryEntry(TimestampMixin, Base):
    """One row per Playnite game ID found in the user's Playnite library (read from the
    SMB-shared Playnite data folder). Doubles as the Playnite game ID -> VGT game match
    cache (game_id null = not yet matched) and the review-queue bookkeeping for a matched
    game not yet added to the library (see app/services/playnite_service.py)."""

    __tablename__ = "playnite_library_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    playnite_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    playnite_name: Mapped[str] = mapped_column(String(255), nullable=False)
    playnite_platform: Mapped[str | None] = mapped_column(String(255))
    playnite_playtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    playnite_last_played_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    playnite_tags: Mapped[str | None] = mapped_column(String(1024))
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), index=True)
    dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    game: Mapped["Game | None"] = relationship()  # noqa: F821
