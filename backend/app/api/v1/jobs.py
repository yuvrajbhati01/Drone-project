from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.common import mission_or_404, response
from app.core.errors import AeroTwinError
from app.db import get_db
from app.models import Mission, MissionFile, ProcessingJob
from app.schemas import JobResponse, ProcessRequest
from app.services.jobs import runner


router = APIRouter(tags=["Processing"])


@router.post("/missions/{mission_id}/process", status_code=status.HTTP_202_ACCEPTED)
def start_processing(
    payload: ProcessRequest,
    mission: Mission = Depends(mission_or_404),
    db: Session = Depends(get_db),
) -> dict:
    video = db.scalar(select(MissionFile).where(MissionFile.mission_id == mission.id, MissionFile.kind == "video"))
    if video is None:
        raise AeroTwinError("VIDEO_REQUIRED", "Upload a drone video before starting reconstruction.", status_code=409)
    active_job = db.scalar(
        select(ProcessingJob).where(
            ProcessingJob.mission_id == mission.id,
            ProcessingJob.status.in_(("QUEUED", "RUNNING", "CANCELLING")),
        )
    )
    if active_job is not None:
        raise AeroTwinError("JOB_ALREADY_RUNNING", "A reconstruction job is already running for this mission.", status_code=409, details={"job_id": active_job.id})
    job = ProcessingJob(
        id=str(uuid4()),
        mission_id=mission.id,
        status="QUEUED",
        stage="QUEUED",
        progress=0,
        message="Queued for local reconstruction",
        engine=payload.engine,
        preset=payload.preset,
        metrics={},
    )
    mission.status = "QUEUED"
    db.add(job)
    db.commit()
    db.refresh(job)
    runner.enqueue(job.id)
    return response(JobResponse.model_validate(job))


@router.get("/missions/{mission_id}/jobs")
def list_jobs(mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    jobs = db.scalars(select(ProcessingJob).where(ProcessingJob.mission_id == mission.id).order_by(ProcessingJob.created_at.desc())).all()
    return response([JobResponse.model_validate(job) for job in jobs], meta={"count": len(jobs)})


@router.get("/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)) -> dict:
    job = db.get(ProcessingJob, job_id)
    if job is None:
        raise AeroTwinError("JOB_NOT_FOUND", "Processing job was not found.", status_code=404)
    return response(JobResponse.model_validate(job))


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, db: Session = Depends(get_db)) -> dict:
    job = db.get(ProcessingJob, job_id)
    if job is None:
        raise AeroTwinError("JOB_NOT_FOUND", "Processing job was not found.", status_code=404)
    if job.status not in {"QUEUED", "RUNNING"}:
        raise AeroTwinError("JOB_NOT_CANCELLABLE", "Only queued or running jobs can be cancelled.", status_code=409)
    # The local worker checks persisted status between pipeline stages. A future
    # Celery worker will revoke the task as well.
    job.status = "CANCELLING"
    job.stage = "CANCELLING"
    job.message = "Cancellation requested"
    db.commit()
    db.refresh(job)
    return response(JobResponse.model_validate(job))
