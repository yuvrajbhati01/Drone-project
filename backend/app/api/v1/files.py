from __future__ import annotations

from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.common import mission_or_404, response
from app.core.config import get_settings
from app.db import get_db
from app.models import Mission, MissionFile
from app.schemas import FileResponse
from app.services.storage import StorageService


router = APIRouter(prefix="/missions/{mission_id}/files", tags=["Files"])


@router.get("")
def list_files(mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    files = db.scalars(select(MissionFile).where(MissionFile.mission_id == mission.id).order_by(MissionFile.created_at.desc())).all()
    return response([FileResponse.model_validate(file) for file in files], meta={"count": len(files)})


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_file(
    mission_id: str,
    kind: Literal["video", "gps"],
    upload: UploadFile = File(...),
    mission: Mission = Depends(mission_or_404),
    db: Session = Depends(get_db),
) -> dict:
    stored = await StorageService(get_settings()).save_upload(mission_id, kind, upload)
    record = MissionFile(id=str(uuid4()), mission_id=mission.id, kind=kind, **stored.__dict__)
    db.add(record)
    if kind == "video":
        mission.status = "UPLOADED"
    db.commit()
    db.refresh(record)
    return response(FileResponse.model_validate(record))
