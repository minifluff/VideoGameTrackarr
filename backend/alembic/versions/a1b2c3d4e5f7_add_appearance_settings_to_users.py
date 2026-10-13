"""add appearance settings to users

Revision ID: a1b2c3d4e5f7
Revises: c4d5e6f7a8b9
Create Date: 2026-10-13 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if columns already exist to make migration idempotent
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    
    if 'accent_color' not in columns:
        op.add_column('users', sa.Column('accent_color', sa.String(), nullable=True))
    if 'app_title' not in columns:
        op.add_column('users', sa.Column('app_title', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'app_title')
    op.drop_column('users', 'accent_color')
