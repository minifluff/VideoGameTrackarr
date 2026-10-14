"""Merge multiple heads (b4ckf111slugs and c7d4e5f6a8b9).

Revision ID: m3rg3h34ds001
Revises: b4ckf111slugs, c7d4e5f6a8b9
Create Date: 2026-10-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm3rg3h34ds001'
down_revision: Union[str, Sequence[str], None] = ('b4ckf111slugs', 'c7d4e5f6a8b9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge migration - no schema changes, just joins the two heads
    pass


def downgrade() -> None:
    # Merge migration - no schema changes to revert
    pass
