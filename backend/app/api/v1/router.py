from fastapi import APIRouter

from app.api.v1 import files, inspection, jobs, missions, reconstruction


router = APIRouter(prefix="/api/v1")
router.include_router(missions.router)
router.include_router(files.router)
router.include_router(jobs.router)
router.include_router(reconstruction.router)
router.include_router(inspection.router)
