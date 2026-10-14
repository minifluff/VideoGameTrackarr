"""Add app_settings table for persistent appearance settings

Revision ID: c7d4e5f6a8b9
Revises: fda7168df178
Create Date: 2026-10-13

Creates a simple key-value store for app-wide settings like appearance
(accent color, app title, app icon). This replaces the previous localStorage-only
approach with server-backed persistence.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d4e5f6a8b9'
down_revision: Union[str, None] = 'fda7168df178'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'app_settings',
        sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('app_settings')
