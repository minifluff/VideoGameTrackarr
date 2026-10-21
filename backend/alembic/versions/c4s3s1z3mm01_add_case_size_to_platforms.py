"""add case size (mm) to platforms

Revision ID: c4s3s1z3mm01
Revises: p17sp1n3tmpl
Create Date: 2026-10-21

Bookshelf mode renders a platform's cases at a fixed 40% of the platform's
ACTUAL physical case size. When the app has no known size for a system, the
user picks one in the spine-template dialog; the choice (height x spine
thickness, in millimetres) is stored here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4s3s1z3mm01'
down_revision: Union[str, None] = 'p17sp1n3tmpl'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('platforms', sa.Column('case_height_mm', sa.Float(), nullable=True))
    op.add_column('platforms', sa.Column('case_spine_mm', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('platforms', 'case_spine_mm')
    op.drop_column('platforms', 'case_height_mm')
