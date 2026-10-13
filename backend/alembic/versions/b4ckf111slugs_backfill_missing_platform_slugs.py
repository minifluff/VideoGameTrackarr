"""backfill missing platform slugs

Revision ID: b4ckf111slugs
Revises: c4d5e6f7a8b9
Create Date: 2026-10-13 17:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4ckf111slugs'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slugify(name: str) -> str:
    import re
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "platform"


def upgrade() -> None:
    conn = op.get_bind()
    # Find platforms with missing slugs
    result = conn.execute(sa.text("SELECT id, name FROM platforms WHERE slug IS NULL OR slug = ''"))
    rows = result.fetchall()

    # Get existing slugs to avoid collisions
    existing = set(
        r[0] for r in conn.execute(sa.text("SELECT slug FROM platforms WHERE slug IS NOT NULL AND slug != ''")).fetchall()
    )

    for platform_id, name in rows:
        base = _slugify(name)
        slug = base
        counter = 2
        while slug in existing:
            slug = f"{base}-{counter}"
            counter += 1
        existing.add(slug)
        conn.execute(
            sa.text("UPDATE platforms SET slug = :slug WHERE id = :id"),
            {"slug": slug, "id": platform_id},
        )
        print(f"Backfilled slug '{slug}' for platform '{name}'")


def downgrade() -> None:
    # Cannot reliably undo slug backfill
    pass
