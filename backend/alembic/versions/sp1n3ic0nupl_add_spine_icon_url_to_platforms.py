"""add spine icon url to platforms

Revision ID: sp1n3ic0nupl
Revises: sp1n3sty1e01
Create Date: 2026-10-21

Bookshelf mode: a platform's generic-spine icon can be an uploaded image
(icon == "custom"); its URL is stored here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'sp1n3ic0nupl'
down_revision: Union[str, None] = 'sp1n3sty1e01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('platforms', sa.Column('spine_icon_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column('platforms', 'spine_icon_url')
