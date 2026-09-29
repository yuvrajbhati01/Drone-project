from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.common import mission_or_404, response
from app.db import get_db
from app.models import Mission
from app.schemas import MissionCreate, MissionResponse, MissionUpdate


router = APIRouter(prefix="/missions", tags=["Missions"])


@router.get("")
def list_missions(db: Session = Depends(get_db)) -> dict:
    missions = db.scalars(select(Mission).order_by(Mission.created_at.desc())).all()
    return response([MissionResponse.model_validate(mission) for mission in missions], meta={"count": len(missions)})


@router.post("", status_code=status.HTTP_201_CREATED)
def create_mission(payload: MissionCreate, db: Session = Depends(get_db)) -> dict:
    mission = Mission(id=str(uuid4()), **payload.model_dump())
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return response(MissionResponse.model_validate(mission))


@router.get("/{mission_id}")
def get_mission(mission: Mission = Depends(mission_or_404)) -> dict:
    return response(MissionResponse.model_validate(mission))


@router.patch("/{mission_id}")
def update_mission(payload: MissionUpdate, mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(mission, field, value)
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return response(MissionResponse.model_validate(mission))


@router.delete("/{mission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mission(mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> Response:
    db.delete(mission)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
