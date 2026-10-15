"""auto-enable track_for_sales for wishlist items

Revision ID: 7r4ckf0rs4l3s
Revises: 3xp0rtb4ckup1
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7r4ckf0rs4l3s'
down_revision: Union[str, None] = '3xp0rtb4ckup1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New rows default to tracked (batch mode for SQLite compatibility)
    with op.batch_alter_table('library_items') as batch_op:
        batch_op.alter_column('track_for_sales', server_default='true')
    # Backfill: every existing wishlist row becomes tracked
    op.execute(
        sa.text("UPDATE library_items SET track_for_sales = 1 WHERE status = 'wishlist'")
    )


def downgrade() -> None:
    with op.batch_alter_table('library_items') as batch_op:
        batch_op.alter_column('track_for_sales', server_default='false')
    # Note: does not un-backfill; previously-tracked rows stay tracked.
