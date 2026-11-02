"""add ignored_duplicate_groups

Groups dismissed from Insights -> Duplicates. The key mirrors the duplicate grouping
exactly (game, status, platform, region, format, edition) so ignoring is per group,
not per game — no UNIQUE constraint, since SQLite treats NULL key columns as
distinct and matching is done on key tuples in Python instead.

Revision ID: ign0r3dup0001
Revises: d45hc4rd5123e
Create Date: 2026-11-02

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ign0r3dup0001'
down_revision: str | None = 'd45hc4rd5123e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'ignored_duplicate_groups',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('owned', 'wishlist', name='librarystatus', native_enum=False, create_constraint=True),
            nullable=False,
        ),
        sa.Column('platform_id', sa.Integer(), nullable=True),
        sa.Column('region_id', sa.Integer(), nullable=True),
        sa.Column(
            'format',
            sa.Enum(
                'physical', 'digital', 'iso', 'rom', 'abandonware', 'subscription', 'other',
                name='mediaformat', native_enum=False, create_constraint=True,
            ),
            nullable=True,
        ),
        sa.Column('edition', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['game_id'], ['games.id']),
        sa.ForeignKeyConstraint(['platform_id'], ['platforms.id']),
        sa.ForeignKeyConstraint(['region_id'], ['regions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ignored_duplicate_groups_game_id', 'ignored_duplicate_groups', ['game_id'])


def downgrade() -> None:
    op.drop_index('ix_ignored_duplicate_groups_game_id', table_name='ignored_duplicate_groups')
    op.drop_table('ignored_duplicate_groups')
