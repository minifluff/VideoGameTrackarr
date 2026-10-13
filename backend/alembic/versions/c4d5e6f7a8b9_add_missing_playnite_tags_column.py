"""add missing playnite_tags column

Revision ID: c4d5e6f7a8b9
Revises: a1b2c3d4e5f6
Create Date: 2026-10-12

The playnite_library_entries table was created by an earlier version of the
a1b2c3d4e5f6 migration without the playnite_tags column. This adds it if missing.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table(table):
        return False
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    if not _column_exists("playnite_library_entries", "playnite_tags"):
        op.add_column('playnite_library_entries', sa.Column('playnite_tags', sa.String(1024), nullable=True))


def downgrade() -> None:
    if _column_exists("playnite_library_entries", "playnite_tags"):
        op.drop_column('playnite_library_entries', 'playnite_tags')
