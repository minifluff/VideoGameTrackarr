"""Merge multiple heads (98522d2c2e73 and 7r4ckf0rs4l3s).

Revision ID: m3rg3h34ds002
Revises: 98522d2c2e73, 7r4ckf0rs4l3s
Create Date: 2026-10-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm3rg3h34ds002'
down_revision: Union[str, Sequence[str], None] = ('98522d2c2e73', '7r4ckf0rs4l3s')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge migration - no schema changes, just joins the two heads
    pass


def downgrade() -> None:
    # Merge migration - nothing to undo
    pass
