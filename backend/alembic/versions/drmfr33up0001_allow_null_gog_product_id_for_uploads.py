"""Allow uploaded DRM-Free installers in gog_downloads

Uploaded installers have no GOG product behind them, so gog_product_id is
nullable now — NULL marks an upload (stored under
gog-installers/uploads/<game_id>/, see gog_download_service), while a set
product id still means a GOG CDN download queued by the drainer. Batch mode:
plain ALTER COLUMN is not valid SQLite, and the app database is SQLite.

Revision ID: drmfr33up0001
Revises: g0g5ync0001
Create Date: 2026-11-12

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'drmfr33up0001'
down_revision: str | None = 'g0g5ync0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("gog_downloads", schema=None) as batch_op:
        batch_op.alter_column("gog_product_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("gog_downloads", schema=None) as batch_op:
        batch_op.alter_column("gog_product_id", existing_type=sa.Integer(), nullable=False)
