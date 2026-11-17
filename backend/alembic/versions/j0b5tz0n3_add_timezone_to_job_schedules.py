"""Add timezone to job_schedules so a schedule's cron means wall time in a named zone

Before this, CronTrigger inherited the scheduler's local zone — UTC inside the NAS
container, but whatever the host sets anywhere else — so the same stored cron fired at
different local times depending on where the app ran. The trigger now always gets an
explicit zone. Rows saved before timezones existed keep timezone NULL and are treated
as UTC, which matches the container default, so existing schedules keep firing when
they did.

Revision ID: j0b5tz0n3
Revises: n1nt3nd0s4l3
Create Date: 2026-11-17

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'j0b5tz0n3'
down_revision: str | None = 'n1nt3nd0s4l3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("job_schedules") as batch_op:
        batch_op.add_column(sa.Column("timezone", sa.String(length=100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("job_schedules") as batch_op:
        batch_op.drop_column("timezone")
