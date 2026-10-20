"""add platform indexes to library_items and game_progress

Revision ID: 1nd3xpl4tf0rm
Revises: 9t1m38e4tg4m3s
Create Date: 2026-10-20

library_items.platform_id is the join key for platform browse pages, the
PC-storefront scoping and the owned-platforms aggregation on the games list,
and was the one hot foreign key without an index. game_progress.platform_id
was only covered as the second column of the (game_id, platform_id) unique
constraint, which doesn't help platform-leading queries.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '1nd3xpl4tf0rm'
down_revision: Union[str, None] = '9t1m38e4tg4m3s'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_library_items_platform_id', 'library_items', ['platform_id'], unique=False)
    op.create_index('ix_game_progress_platform_id', 'game_progress', ['platform_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_game_progress_platform_id', table_name='game_progress')
    op.drop_index('ix_library_items_platform_id', table_name='library_items')
