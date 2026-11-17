"""Add nintendo_price_cache for Switch eShop sale tracking

One row per game, mirroring platprices_cache: the NSUID match for the game, the current
eShop price/discount, and a self-built historical low (Nintendo publishes no price
history — the low is the cheapest price this app has ever observed). No API key exists
for this provider; the price API and catalog search are public.

Revision ID: n1nt3nd0s4l3
Revises: drmfr33up0001
Create Date: 2026-11-17

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'n1nt3nd0s4l3'
down_revision: str | None = 'drmfr33up0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "nintendo_price_cache",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("nsuid", sa.String(length=32), nullable=True),
        sa.Column("ignored", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("current_price_amount", sa.Float(), nullable=True),
        sa.Column("current_price_currency", sa.String(length=8), nullable=True),
        sa.Column("region", sa.String(length=8), nullable=True),
        sa.Column("current_shop_name", sa.String(length=100), nullable=True),
        sa.Column("current_cut", sa.Integer(), nullable=True),
        sa.Column("historical_low_amount", sa.Float(), nullable=True),
        sa.Column("historical_low_currency", sa.String(length=8), nullable=True),
        sa.Column("historical_low_shop_name", sa.String(length=100), nullable=True),
        sa.Column("historical_low_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id"),
    )


def downgrade() -> None:
    op.drop_table("nintendo_price_cache")
