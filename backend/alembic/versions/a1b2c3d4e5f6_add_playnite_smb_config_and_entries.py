"""add playnite smb config and playnite library entries

Revision ID: a1b2c3d4e5f6
Revises: b7e2c4f9a1d3
Create Date: 2026-10-12

Adds playnite_smb_path/username/password columns to users and the
playnite_library_entries table for caching the Playnite library scan.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'b7e2c4f9a1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('playnite_smb_path', sa.String(1024), nullable=True))
    op.add_column('users', sa.Column('playnite_smb_username', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('playnite_smb_password', sa.String(255), nullable=True))
    op.add_column('playnite_library_entries', sa.Column('playnite_tags', sa.String(1024), nullable=True))

    op.create_table(
        'playnite_library_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('playnite_id', sa.String(64), nullable=False),
        sa.Column('playnite_name', sa.String(255), nullable=False),
        sa.Column('playnite_platform', sa.String(255), nullable=True),
        sa.Column('playnite_playtime_minutes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('playnite_last_played_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('game_id', sa.Integer(), nullable=True),
        sa.Column('dismissed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['game_id'], ['games.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_playnite_library_entries_playnite_id', 'playnite_library_entries', ['playnite_id'], unique=True)
    op.create_index('ix_playnite_library_entries_game_id', 'playnite_library_entries', ['game_id'])


def downgrade() -> None:
    op.drop_index('ix_playnite_library_entries_game_id', table_name='playnite_library_entries')
    op.drop_index('ix_playnite_library_entries_playnite_id', table_name='playnite_library_entries')
    op.drop_table('playnite_library_entries')
    op.drop_column('users', 'playnite_smb_password')
    op.drop_column('users', 'playnite_smb_username')
    op.drop_column('users', 'playnite_smb_path')
