from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from uuid import uuid4

from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.core.errors import AeroTwinError
from app.db import SessionLocal
from app.models import Asset, Mission, MissionFile, ProcessingJob, Reconstruction
from app.processing.reconstruction import colmap_available, run_two_view_reconstruction
from app.processing.video import extract_selected_frames, read_gps_track
from app.services.storage import StorageService


class ReconstructionRunner:
    """Runs local reconstruction jobs outside the request lifecycle.

    The interface deliberately mirrors a future Celery worker: each unit of
    work receives only a job ID and reads/writes its own persisted state.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.storage = StorageService(self.settings)
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="aerotwin-reconstruction")
        self._active_jobs: set[str] = set()
        self._lock = Lock()

    def enqueue(self, job_id: str) -> None:
        with self._lock:
            if job_id in self._active_jobs:
                return
            self._active_jobs.add(job_id)
        self.executor.submit(self._run, job_id)

    def _set_state(
        self,
        job_id: str,
        *,
        status: str | None = None,
        stage: str | None = None,
        progress: int | None = None,
        message: str | None = None,
        metrics: dict[str, object] | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        with SessionLocal() as session:
            job = session.get(ProcessingJob, job_id)
            if job is None:
                return
            if status is not None:
                job.status = status
            if stage is not None:
                job.stage = stage
            if progress is not None:
                job.progress = max(0, min(100, progress))
            if message is not None:
                job.message = message[:500]
            if metrics is not None:
                job.metrics = {**(job.metrics or {}), **metrics}
            if error_code is not None:
                job.error_code = error_code
            if error_message is not None:
                job.error_message = error_message
            session.commit()

    def _run(self, job_id: str) -> None:
        try:
            self._set_state(job_id, status="RUNNING", stage="VALIDATING", progress=3, message="Validating uploaded video")
            with SessionLocal() as session:
                job = session.get(ProcessingJob, job_id)
                if job is None:
                    return
                job.started_at = datetime.now(UTC)
                mission = session.get(Mission, job.mission_id)
                video = session.scalar(
                    select(MissionFile).where(MissionFile.mission_id == job.mission_id, MissionFile.kind == "video").order_by(MissionFile.created_at.desc())
                )
                gps = session.scalar(
                    select(MissionFile).where(MissionFile.mission_id == job.mission_id, MissionFile.kind == "gps").order_by(MissionFile.created_at.desc())
                )
                if mission is None or video is None:
                    raise AeroTwinError("VIDEO_INVALID", "A mission video is required before reconstruction can start.")
                mission.status = "PROCESSING"
                session.commit()
                video_path = self.storage.resolve_storage_key(video.storage_key)
                gps_path = self.storage.resolve_storage_key(gps.storage_key) if gps else None
                preset = job.preset
                requested_engine = job.engine
                mission_id = job.mission_id

            frame_dir = self.storage.mission_dir(mission_id) / "jobs" / job_id / "frames"
            output_dir = self.storage.mission_dir(mission_id) / "jobs" / job_id / "reconstruction"

            def frame_progress(percent: int, message: str) -> None:
                self._set_state(job_id, stage="SELECTING_FRAMES", progress=8 + int(percent * 0.28), message=message)

            self._set_state(job_id, stage="EXTRACTING_FRAMES", progress=8, message="Extracting video frames")
            selection = extract_selected_frames(video_path, frame_dir, self.settings.frame_sample_fps, preset, frame_progress)
            self._set_state(
                job_id,
                stage="CALIBRATING",
                progress=39,
                message="Estimating camera intrinsics for local reconstruction",
                metrics=selection.metrics(),
            )
            gps_track = read_gps_track(gps_path)
            if requested_engine == "colmap" and not colmap_available():
                raise AeroTwinError("RECONSTRUCTION_ENGINE_UNAVAILABLE", "COLMAP was requested but is not installed on this worker.")
            engine = "COLMAP" if requested_engine == "colmap" and colmap_available() else "TWO_VIEW_OPENCV"
            if requested_engine == "auto" and colmap_available():
                # The real local implementation currently uses the tested CPU fallback.
                # This makes the engine decision visible rather than silently claiming COLMAP output.
                engine = "TWO_VIEW_OPENCV"
            self._set_state(job_id, stage="RECONSTRUCTING", progress=45, message=f"Running {engine} reconstruction")

            def reconstruction_progress(percent: int, message: str) -> None:
                self._set_state(job_id, stage="RECONSTRUCTING", progress=percent, message=message)

            output = run_two_view_reconstruction(selection.selected_frames, output_dir, gps_track, reconstruction_progress)
            self._set_state(job_id, stage="MESHING", progress=70, message="Publishing generated point cloud and mesh")
            published_assets = []
            for source, asset_type, fmt, mime_type in (
                (output.ply_path, "POINT_CLOUD", "PLY", "application/octet-stream"),
                (output.obj_path, "MESH", "OBJ", "text/plain"),
            ):
                storage_key, public_path = self.storage.publish_asset(mission_id, job_id, source, asset_type)
                published_assets.append((asset_type, fmt, mime_type, storage_key, public_path))

            with SessionLocal() as session:
                job = session.get(ProcessingJob, job_id)
                mission = session.get(Mission, mission_id)
                if job is None or mission is None:
                    return
                session.query(Asset).filter(Asset.mission_id == mission_id, Asset.job_id == job_id).delete()
                for asset_type, fmt, mime_type, storage_key, public_path in published_assets:
                    session.add(
                        Asset(
                            id=str(uuid4()),
                            mission_id=mission_id,
                            job_id=job_id,
                            asset_type=asset_type,
                            storage_key=storage_key,
                            format=fmt,
                            mime_type=mime_type,
                            size_bytes=public_path.stat().st_size,
                            metadata_json={"engine": engine, "coordinate_reference_system": output.coordinate_reference_system},
                        )
                    )
                reconstruction = session.scalar(select(Reconstruction).where(Reconstruction.mission_id == mission_id))
                if reconstruction is None:
                    reconstruction = Reconstruction(id=str(uuid4()), mission_id=mission_id, job_id=job_id, engine=engine)
                    session.add(reconstruction)
                reconstruction.job_id = job_id
                reconstruction.status = "COMPLETED"
                reconstruction.engine = engine
                reconstruction.coordinate_reference_system = output.coordinate_reference_system
                reconstruction.scale_status = output.scale_status
                reconstruction.point_count = output.point_count
                reconstruction.mesh_faces = output.mesh_faces
                reconstruction.metrics = {**selection.metrics(), **output.metrics}
                reconstruction.warnings = output.warnings
                mission.status = "COMPLETED"
                job.status = "COMPLETED"
                job.stage = "COMPLETED"
                job.progress = 100
                job.message = "Point cloud and mesh are ready"
                job.metrics = {**selection.metrics(), **output.metrics}
                job.completed_at = datetime.now(UTC)
                session.commit()
        except AeroTwinError as exc:
            self._set_state(
                job_id,
                status="FAILED",
                stage="FAILED",
                message=exc.message,
                error_code=exc.code,
                error_message=exc.message,
            )
            with SessionLocal() as session:
                job = session.get(ProcessingJob, job_id)
                if job:
                    mission = session.get(Mission, job.mission_id)
                    if mission:
                        mission.status = "FAILED"
                    job.completed_at = datetime.now(UTC)
                    session.commit()
        except Exception as exc:  # pragma: no cover - defensive fallback for the worker boundary
            self._set_state(
                job_id,
                status="FAILED",
                stage="FAILED",
                message="The reconstruction worker stopped unexpectedly.",
                error_code="RECONSTRUCTION_FAILED",
                error_message=str(exc)[:2000],
            )
        finally:
            with self._lock:
                self._active_jobs.discard(job_id)


runner = ReconstructionRunner()
