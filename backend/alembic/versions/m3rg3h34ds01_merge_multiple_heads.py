"""merge multiple heads

Revision ID: m3rg3h34ds01
Revises: c4d5e6f7a8b9, a1b2c3d4e5f7, 51d02959d4c5
Create Date: 2026-10-13 15:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm3rg3h34ds01'
down_revision: Union[str, Sequence[str], None] = ('c4d5e6f7a8b9', 'a1b2c3d4e5f7', '51d02959d4c5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
