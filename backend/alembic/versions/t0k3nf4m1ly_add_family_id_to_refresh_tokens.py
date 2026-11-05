"""add family_id to refresh_tokens

One sign-in family per login, carried across rotations, so reuse detection can
revoke just that family's tokens instead of every session the user has. NULL
until a row rotates — pre-existing rows graduate on their first rotation.

Revision ID: t0k3nf4m1ly
Revises: f1lt3rl4y0ut
Create Date: 2026-11-04

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 't0k3nf4m1ly'
down_revision: str | None = 'f1lt3rl4y0ut'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'refresh_tokens',
        sa.Column(
            'family_id',
            sa.String(length=36),
            nullable=True,
            comment="Sign-in family: one per login, carried across rotations; NULL for pre-family rows",
        ),
    )
    op.create_index('ix_refresh_tokens_family_id', 'refresh_tokens', ['family_id'])


def downgrade() -> None:
    op.drop_index('ix_refresh_tokens_family_id', table_name='refresh_tokens')
    op.drop_column('refresh_tokens', 'family_id')
