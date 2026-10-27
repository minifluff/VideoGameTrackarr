"""add overview_layout to users

Stores the Dashboard's section order/visibility, as a JSON list of
{key, hidden} entries — null until the user customises it (the frontend
falls back to the default order). Same batch pattern as the other
SQLite-friendly migrations.

Revision ID: ov3rv13wl4y0ut
Revises: mf5ub5cr1ptn
Create Date: 2026-10-27

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ov3rv13wl4y0ut'
down_revision: str | None = 'mf5ub5cr1ptn'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('overview_layout', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('overview_layout')
