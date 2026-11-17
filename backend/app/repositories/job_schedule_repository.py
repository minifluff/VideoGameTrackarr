from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.jobs import JobSchedule


def get_by_job_id(db: Session, job_id: str) -> JobSchedule | None:
    return db.get(JobSchedule, job_id)


def list_all(db: Session) -> list[JobSchedule]:
    return list(db.scalars(select(JobSchedule)))


def upsert(
    db: Session,
    job_id: str,
    enabled: bool,
    cron_expression: str | None,
    timezone: str | None = None,
) -> JobSchedule:
    schedule = get_by_job_id(db, job_id)
    if schedule is None:
        schedule = JobSchedule(job_id=job_id)
        db.add(schedule)

    schedule.enabled = enabled
    schedule.cron_expression = cron_expression
    # A None timezone means "keep what's stored" (custom-cron saves don't touch it);
    # new rows start NULL, which the scheduler treats as UTC.
    if timezone is not None:
        schedule.timezone = timezone
    db.flush()
    return schedule
