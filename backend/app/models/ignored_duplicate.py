from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.library import LibraryStatus, MediaFormat
from app.models.mixins import TimestampMixin, enum_column


class IgnoredDuplicateGroup(TimestampMixin, Base):
    """A duplicate group dismissed from Insights -> Duplicates. The key is exactly the
    grouping key find_duplicate_library_items uses (game, status, platform, region,
    format, edition) — ignoring is per group, not per game, so dismissing one game's
    PS5 duplicates doesn't also hide its Switch ones. NULL key columns are real values
    here (\"any platform\"), which is why matching is done on key tuples in Python
    rather than a UNIQUE constraint — SQLite treats NULLs as distinct in one."""

    __tablename__ = "ignored_duplicate_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    status: Mapped[LibraryStatus] = mapped_column(enum_column(LibraryStatus), nullable=False)
    platform_id: Mapped[int | None] = mapped_column(ForeignKey("platforms.id"))
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"))
    format: Mapped[MediaFormat | None] = mapped_column(enum_column(MediaFormat))
    edition: Mapped[str | None] = mapped_column(String(255))

    game: Mapped["Game"] = relationship()  # noqa: F821
    platform: Mapped["Platform | None"] = relationship()  # noqa: F821
    region: Mapped["Region | None"] = relationship()  # noqa: F821
