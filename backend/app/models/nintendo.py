from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UTCDateTime


class NintendoPriceCache(TimestampMixin, Base):
    """One row per game — same shape/reasoning as PlatPricesCache. current_shop_name is
    always the literal "Nintendo eShop" (there is exactly one shop), and the historical low
    is SELF-BUILT: Nintendo's price API publishes no price history, so the lowest price
    this app has ever observed for the game (sale price when on sale, otherwise the regular
    price) is recorded on each refresh, with historical_low_at marking when that low was
    first seen. It starts empty and only ever goes down, so the first weeks after turning
    this on show a historical low equal to whatever the game cost at first sight — it
    becomes a real all-time low only after the app has watched the game through a sale.
    """

    __tablename__ = "nintendo_price_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), unique=True, nullable=False)
    nsuid: Mapped[str | None] = mapped_column(
        String(32), comment="Nintendo's 14-digit title id for this game in the tracked region; null = no match found"
    )
    ignored: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Set once a title search comes back with no exact match — stops permanent "
        "re-search churn on every job run until Retry clears it",
    )
    current_price_amount: Mapped[float | None] = mapped_column()
    current_price_currency: Mapped[str | None] = mapped_column(String(8))
    region: Mapped[str | None] = mapped_column(
        String(8), comment="eShop country the cached prices were fetched for; null = before this was tracked"
    )
    current_shop_name: Mapped[str | None] = mapped_column(String(100))
    current_cut: Mapped[int | None] = mapped_column(Integer, comment="Current discount percentage")
    historical_low_amount: Mapped[float | None] = mapped_column()
    historical_low_currency: Mapped[str | None] = mapped_column(String(8))
    historical_low_shop_name: Mapped[str | None] = mapped_column(String(100))
    historical_low_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    checked_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    game: Mapped["Game"] = relationship()  # noqa: F821
