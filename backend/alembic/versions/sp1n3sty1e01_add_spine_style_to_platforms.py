"""add spine style (colour + icon) to platforms

Revision ID: sp1n3sty1e01
Revises: c4s3s1z3mm01
Create Date: 2026-10-21

Bookshelf mode's generic (non-template) spines can be styled per platform:
a hex colour override and an icon key rendered at the top of the spine.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'sp1n3sty1e01'
down_revision: Union[str, None] = 'c4s3s1z3mm01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('platforms', sa.Column('spine_color', sa.String(length=9), nullable=True))
    op.add_column('platforms', sa.Column('spine_icon', sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column('platforms', 'spine_icon')
    op.drop_column('platforms', 'spine_color')
