from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.common import mission_or_404, response
from app.db import get_db
from app.models import Defect, Measurement, Mission
from app.schemas import DefectCreate, DefectResponse, MeasurementCreate, MeasurementResponse


router = APIRouter(prefix="/missions/{mission_id}", tags=["Inspection"])


@router.get("/defects")
def list_defects(mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    defects = db.scalars(select(Defect).where(Defect.mission_id == mission.id).order_by(Defect.created_at.desc())).all()
    return response([_defect_response(defect) for defect in defects], meta={"count": len(defects)})


@router.post("/defects", status_code=status.HTTP_201_CREATED)
def create_defect(payload: DefectCreate, mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    defect = Defect(id=str(uuid4()), mission_id=mission.id, **payload.model_dump(exclude={"geometry"}), geometry_json=payload.geometry)
    db.add(defect)
    db.commit()
    db.refresh(defect)
    return response(_defect_response(defect))


@router.get("/measurements")
def list_measurements(mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    measurements = db.scalars(select(Measurement).where(Measurement.mission_id == mission.id).order_by(Measurement.created_at.desc())).all()
    return response([_measurement_response(measurement) for measurement in measurements], meta={"count": len(measurements)})


@router.post("/measurements", status_code=status.HTTP_201_CREATED)
def create_measurement(payload: MeasurementCreate, mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    measurement = Measurement(id=str(uuid4()), mission_id=mission.id, **payload.model_dump(exclude={"geometry"}), geometry_json=payload.geometry)
    db.add(measurement)
    db.commit()
    db.refresh(measurement)
    return response(_measurement_response(measurement))


def _defect_response(defect: Defect) -> DefectResponse:
    return DefectResponse(
        id=defect.id,
        mission_id=defect.mission_id,
        label=defect.label,
        severity=defect.severity,
        confidence=defect.confidence,
        description=defect.description,
        recommendation=defect.recommendation,
        frame_reference=defect.frame_reference,
        geometry=defect.geometry_json or {},
        created_at=defect.created_at,
    )


def _measurement_response(measurement: Measurement) -> MeasurementResponse:
    return MeasurementResponse(
        id=measurement.id,
        mission_id=measurement.mission_id,
        measurement_type=measurement.measurement_type,
        value=measurement.value,
        unit=measurement.unit,
        label=measurement.label,
        geometry=measurement.geometry_json or {},
        source_asset_id=measurement.source_asset_id,
        created_at=measurement.created_at,
    )
