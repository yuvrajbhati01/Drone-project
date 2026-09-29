from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class MissionCreate(BaseModel):
    name: str = Field(min_length=3, max_length=180)
    location_name: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    mission_type: str = Field(default="Infrastructure Survey", max_length=80)


class MissionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=180)
    location_name: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    mission_type: str | None = Field(default=None, max_length=80)


class MissionResponse(BaseModel):
    id: str
    name: str
    location_name: str | None
    description: str | None
    mission_type: str
    status: str
    coordinate_reference_system: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FileResponse(BaseModel):
    id: str
    kind: str
    original_filename: str
    mime_type: str | None
    size_bytes: int
    checksum: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProcessRequest(BaseModel):
    preset: Literal["FAST", "BALANCED", "HIGH_QUALITY"] = "BALANCED"
    engine: Literal["auto", "colmap", "two_view"] = "auto"


class JobResponse(BaseModel):
    id: str
    mission_id: str
    job_type: str
    status: str
    stage: str
    progress: int
    message: str
    engine: str
    preset: str
    error_code: str | None
    error_message: str | None
    metrics: dict[str, Any]
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetResponse(BaseModel):
    id: str
    asset_type: str
    format: str
    mime_type: str
    size_bytes: int
    url: str
    metadata: dict[str, Any]
    created_at: datetime


class ReconstructionResponse(BaseModel):
    id: str
    mission_id: str
    job_id: str
    status: str
    engine: str
    coordinate_reference_system: str
    scale_status: str
    point_count: int
    mesh_faces: int
    metrics: dict[str, Any]
    warnings: list[str]
    assets: list[AssetResponse]


class DefectCreate(BaseModel):
    label: str = Field(min_length=2, max_length=160)
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    confidence: float = Field(ge=0, le=1)
    description: str | None = Field(default=None, max_length=5000)
    recommendation: str | None = Field(default=None, max_length=5000)
    frame_reference: str | None = Field(default=None, max_length=120)
    geometry: dict[str, Any] = Field(default_factory=dict)


class DefectResponse(DefectCreate):
    id: str
    mission_id: str
    created_at: datetime


class MeasurementCreate(BaseModel):
    measurement_type: Literal["DISTANCE", "AREA", "HEIGHT", "COORDINATE"]
    value: float
    unit: str = Field(min_length=1, max_length=16)
    label: str | None = Field(default=None, max_length=160)
    geometry: dict[str, Any] = Field(default_factory=dict)
    source_asset_id: str | None = None


class MeasurementResponse(MeasurementCreate):
    id: str
    mission_id: str
    created_at: datetime
