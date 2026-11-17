from unittest.mock import MagicMock

from app.models.jobs import JobSchedule
from app.services import job_scheduler


def test_start_schedules_every_enabled_row(db_session):
    db_session.add(JobSchedule(job_id="resync_collections", enabled=True, cron_expression="0 3 * * *"))
    db_session.add(JobSchedule(job_id="disabled_job", enabled=False, cron_expression="0 4 * * *"))
    db_session.commit()

    job_scheduler.start(db_session, MagicMock)

    assert job_scheduler._scheduler.get_job("resync_collections") is not None
    assert job_scheduler._scheduler.get_job("disabled_job") is None


def test_reschedule_disable_removes_the_job(db_session):
    job_scheduler.reschedule("resync_collections", True, "0 3 * * *", MagicMock)
    assert job_scheduler._scheduler.get_job("resync_collections") is not None

    job_scheduler.reschedule("resync_collections", False, None, MagicMock)
    assert job_scheduler._scheduler.get_job("resync_collections") is None


def test_get_next_run_time_reflects_a_scheduled_job():
    assert job_scheduler.get_next_run_time("resync_collections") is None

    job_scheduler.reschedule("resync_collections", True, "0 3 * * *", MagicMock)

    assert job_scheduler.get_next_run_time("resync_collections") is not None


def test_reschedule_with_timezone_runs_in_that_zone():
    job_scheduler.reschedule(
        "resync_collections", True, "0 3 * * *", MagicMock(), timezone="America/Halifax"
    )

    job = job_scheduler._scheduler.get_job("resync_collections")
    assert job is not None
    assert str(job.trigger.timezone) == "America/Halifax"
    next_run = job_scheduler.get_next_run_time("resync_collections")
    assert next_run is not None
    # 3am wall time in Halifax, whatever the host zone is.
    assert next_run.astimezone(job.trigger.timezone).hour == 3


def test_start_uses_the_stored_timezone(db_session):
    db_session.add(
        JobSchedule(
            job_id="resync_collections",
            enabled=True,
            cron_expression="0 3 * * *",
            timezone="America/Halifax",
        )
    )
    db_session.commit()

    job_scheduler.start(db_session, MagicMock)

    job = job_scheduler._scheduler.get_job("resync_collections")
    assert job is not None
    assert str(job.trigger.timezone) == "America/Halifax"
