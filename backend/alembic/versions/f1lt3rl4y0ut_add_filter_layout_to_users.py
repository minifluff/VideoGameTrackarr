"""add filter_layout to users

Games filter dialog field order/visibility, mirroring overview_layout — same
[{key, hidden}] shape, null until the user customises the filters.

Revision ID: f1lt3rl4y0ut
Revises: ign0r3dup0001
Create Date: 2026-11-03

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f1lt3rl4y0ut'
down_revision: str | None = 'ign0r3dup0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'filter_layout',
            sa.JSON(),
            nullable=True,
            comment="Games filter dialog field order/visibility, as [{key, hidden}] — null until customised",
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'filter_layout')
