"""add spine_url to games

Revision ID: sp1n3b00k5h3lf
Revises: 1nd3xpl4tf0rm
Create Date: 2026-10-21

Bookshelf mode renders game cases by their spine. spine_url holds either an
uploaded local file (/uploads/spines/...) or an external URL, mirroring
cover_url's role for the front of the box.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'sp1n3b00k5h3lf'
down_revision: Union[str, None] = '1nd3xpl4tf0rm'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('games', sa.Column('spine_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column('games', 'spine_url')
