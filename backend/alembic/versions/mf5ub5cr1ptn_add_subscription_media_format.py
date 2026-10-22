"""add subscription media format

Adds 'subscription' to the library_items.format CHECK constraint, between
'abandonware' and 'other' (the enum's display order). Same drop/recreate
pattern as e1c3a5c01835, which extended the constraint the same way.

Revision ID: mf5ub5cr1ptn
Revises: sp1n3ic0nupl
Create Date: 2026-10-22

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'mf5ub5cr1ptn'
down_revision: str | None = 'sp1n3ic0nupl'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('library_items', schema=None) as batch_op:
        # The live constraint is the one e1c3a5c01835 created under the naming
        # convention; op.f() keeps batch mode from re-applying the convention
        # to the already-qualified name (see that migration's comments).
        batch_op.drop_constraint(op.f('ck_library_items_mediaformat'), type_='check')
        batch_op.create_check_constraint(
            op.f('ck_library_items_mediaformat'),
            "format IN ('physical', 'digital', 'iso', 'rom', 'abandonware', 'subscription', 'other')",
        )


def downgrade() -> None:
    # Fails if any library_items row already uses 'subscription' — remove or
    # reformat those rows first. Same one-way-door caveat as e1c3a5c01835's
    # region changes.
    with op.batch_alter_table('library_items', schema=None) as batch_op:
        batch_op.drop_constraint(op.f('ck_library_items_mediaformat'), type_='check')
        batch_op.create_check_constraint(
            op.f('ck_library_items_mediaformat'),
            "format IN ('physical', 'digital', 'iso', 'rom', 'abandonware', 'other')",
        )
