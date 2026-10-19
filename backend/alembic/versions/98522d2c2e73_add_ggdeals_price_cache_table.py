"""add ggdeals price cache table

Revision ID: 98522d2c2e73
Revises: h1d3fr0mpubl1c
Create Date: 2026-10-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '98522d2c2e73'
down_revision: Union[str, None] = 'h1d3fr0mpubl1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ggdeals_price_cache",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("steam_app_id", sa.Integer(), nullable=True),
        sa.Column("ggdeals_url", sa.String(length=255), nullable=True),
        sa.Column("ignored", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("current_price_amount", sa.Float(), nullable=True),
        sa.Column("current_price_currency", sa.String(length=8), nullable=True),
        sa.Column("current_shop_name", sa.String(length=100), nullable=True),
        sa.Column("current_cut", sa.Integer(), nullable=True),
        sa.Column("current_keyshops_amount", sa.Float(), nullable=True),
        sa.Column("historical_low_amount", sa.Float(), nullable=True),
        sa.Column("historical_low_currency", sa.String(length=8), nullable=True),
        sa.Column("historical_low_shop_name", sa.String(length=100), nullable=True),
        sa.Column("historical_low_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("historical_retail_amount", sa.Float(), nullable=True),
        sa.Column("historical_keyshops_amount", sa.Float(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_ggdeals_price_cache_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ggdeals_price_cache")),
        sa.UniqueConstraint("game_id", name=op.f("uq_ggdeals_price_cache_game_id")),
    )


def downgrade() -> None:
    op.drop_table("ggdeals_price_cache")
