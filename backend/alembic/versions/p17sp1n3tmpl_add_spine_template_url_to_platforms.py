"""add spine_template_url to platforms

Revision ID: p17sp1n3tmpl
Revises: sp1n3b00k5h3lf
Create Date: 2026-10-21

Bookshelf mode's platform dividers can carry a user-supplied blank spine
template: an image rendered behind every case of that platform. Stored like
games.spine_url — an uploaded /uploads/spines/... path or an external URL.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p17sp1n3tmpl'
down_revision: Union[str, None] = 'sp1n3b00k5h3lf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('platforms', sa.Column('spine_template_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column('platforms', 'spine_template_url')
