"""add igdb status, game modes, age ratings, time to beat to games

Revision ID: 9t1m38e4tg4m3s
Revises: 7r4ckf0rs4l3s
Create Date: 2026-10-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9t1m38e4tg4m3s'
down_revision: Union[str, None] = '7r4ckf0rs4l3s'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('games', sa.Column('igdb_status', sa.Integer(), nullable=True))
    op.add_column('games', sa.Column('game_modes', sa.JSON(), nullable=True))
    op.add_column('games', sa.Column('age_ratings', sa.JSON(), nullable=True))
    op.add_column('games', sa.Column('time_to_beat', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('games', 'time_to_beat')
    op.drop_column('games', 'age_ratings')
    op.drop_column('games', 'game_modes')
    op.drop_column('games', 'igdb_status')
