"""add export backup job config to users (merges multiple heads)

Revision ID: 3xp0rtb4ckup1
Revises: b4ckf111slugs, c7d4e5f6a8b9, h1d3fr0mpubl1c
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3xp0rtb4ckup1'
down_revision: Union[str, Sequence[str], None] = ('b4ckf111slugs', 'c7d4e5f6a8b9', 'h1d3fr0mpubl1c')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('export_smb_path', sa.String(1024), nullable=True,
        comment="SMB/network path to the folder where scheduled exports are written"))
    op.add_column('users', sa.Column('export_smb_username', sa.String(255), nullable=True,
        comment="Username for SMB authentication to the export share"))
    op.add_column('users', sa.Column('export_smb_password', sa.String(255), nullable=True,
        comment="Password for SMB authentication to the export share"))
    op.add_column('users', sa.Column('export_retention_count', sa.Integer(), nullable=True,
        comment="How many scheduled exports to keep on the share (oldest deleted first)"))
    op.add_column('users', sa.Column('export_include_files', sa.Boolean(), nullable=False,
        server_default='0',
        comment="Whether scheduled exports are full backups (JSON + ROMs/saves/BIOS)"))


def downgrade() -> None:
    op.drop_column('users', 'export_include_files')
    op.drop_column('users', 'export_retention_count')
    op.drop_column('users', 'export_smb_password')
    op.drop_column('users', 'export_smb_username')
    op.drop_column('users', 'export_smb_path')
