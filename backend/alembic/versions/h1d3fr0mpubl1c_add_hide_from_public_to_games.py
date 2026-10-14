"""add hide_from_public to games

Revision ID: h1d3fr0mpubl1c
Revises: m3rg3h34ds001
Create Date: 2026-10-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h1d3fr0mpubl1c'
down_revision: Union[str, None] = 'm3rg3h34ds001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('games', sa.Column('hide_from_public', sa.Boolean(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('games', 'hide_from_public')
