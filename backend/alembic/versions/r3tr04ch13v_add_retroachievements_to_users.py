"""add RetroAchievements username + API key to users

The Achievements page pulls from retroachievements.org with the user's own
credentials, pasted on the Integrations page — the username picks whose profile
is shown, the key authorizes the calls.

Revision ID: r3tr04ch13v
Revises: t0k3nf4m1ly
Create Date: 2026-11-06

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'r3tr04ch13v'
down_revision: str | None = 't0k3nf4m1ly'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'retroachievements_username',
            sa.String(length=64),
            nullable=True,
            comment="RetroAchievements username shown on the Achievements page",
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'retroachievements_api_key',
            sa.String(length=255),
            nullable=True,
            comment="RetroAchievements Web API key, pasted on the Integrations page",
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'retroachievements_api_key')
    op.drop_column('users', 'retroachievements_username')
