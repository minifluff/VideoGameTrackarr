"""add overview_card_size to users

Dashboard card-size scale saved from the Customize Overview dialog (0.5 small,
1.0 medium, 2.0 large) — null until the user moves the slider (the frontend
falls back to medium). Same batch pattern as the other SQLite-friendly migrations.

Revision ID: d45hc4rd5123e
Revises: ov3rv13wl4y0ut
Create Date: 2026-10-27

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd45hc4rd5123e'
down_revision: str | None = 'ov3rv13wl4y0ut'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('overview_card_size', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('overview_card_size')
