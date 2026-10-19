from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UTCDateTime


class GgDealsPriceCache(TimestampMixin, Base):
    """One row per game — same shape/reasoning as ItadPriceCache/PlatPricesCache. The
    current_*/historical_low_* field names are deliberately shared with those two models so
    schemas/insights.on_sale_item_from_orm works unchanged for GG.deals items.

    GG.deals reports no discount percentage, so current_cut is always None and
    current_shop_name is always the literal "GG.deals" (it is the data source, not a shop —
    this also serves as the visible attribution GG.deals' API terms require). The honest
    "on sale" signal is the current *retail* price sitting at or below the *historical
    retail* low (see ggdeals_service.list_on_sale_items) — keyshop prices are cached for
    reference only and never gate the sale flag."""

    __tablename__ = "ggdeals_price_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), unique=True, nullable=False)
    steam_app_id: Mapped[int | None] = mapped_column(
        Integer, comment="Steam AppID GG.deals was queried with; null = no match found"
    )
    ggdeals_url: Mapped[str | None] = mapped_column(String(255))
    ignored: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Set once no Steam AppID can be resolved for the game — stops permanent "
        "re-resolution churn on every job run until Retry clears it",
    )
    current_price_amount: Mapped[float | None] = mapped_column()
    current_price_currency: Mapped[str | None] = mapped_column(String(8))
    current_shop_name: Mapped[str | None] = mapped_column(String(100))
    current_cut: Mapped[int | None] = mapped_column(Integer, comment="Always null — GG.deals reports no discount %")
    current_keyshops_amount: Mapped[float | None] = mapped_column()
    historical_low_amount: Mapped[float | None] = mapped_column()
    historical_low_currency: Mapped[str | None] = mapped_column(String(8))
    historical_low_shop_name: Mapped[str | None] = mapped_column(String(100))
    historical_low_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    historical_retail_amount: Mapped[float | None] = mapped_column()
    historical_keyshops_amount: Mapped[float | None] = mapped_column()
    checked_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    game: Mapped["Game"] = relationship()  # noqa: F821
