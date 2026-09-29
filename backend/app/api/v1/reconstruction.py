from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.common import mission_or_404, response
from app.core.errors import AeroTwinError
from app.db import get_db
from app.models import Asset, Mission, Reconstruction
from app.schemas import AssetResponse, ReconstructionResponse


router = APIRouter(prefix="/missions/{mission_id}", tags=["Reconstruction"])


def asset_response(asset: Asset) -> AssetResponse:
    return AssetResponse(
        id=asset.id,
        asset_type=asset.asset_type,
        format=asset.format,
        mime_type=asset.mime_type,
        size_bytes=asset.size_bytes,
        url=f"/assets/{asset.storage_key}",
        metadata=asset.metadata_json or {},
        created_at=asset.created_at,
    )


@router.get("/assets")
def list_assets(mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    assets = db.scalars(select(Asset).where(Asset.mission_id == mission.id).order_by(Asset.created_at.desc())).all()
    return response([asset_response(asset) for asset in assets], meta={"count": len(assets)})


@router.get("/reconstruction")
def get_reconstruction(mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    reconstruction = db.scalar(select(Reconstruction).where(Reconstruction.mission_id == mission.id))
    if reconstruction is None:
        raise AeroTwinError("RECONSTRUCTION_NOT_FOUND", "No completed reconstruction is available for this mission.", status_code=404)
    assets = db.scalars(select(Asset).where(Asset.mission_id == mission.id, Asset.job_id == reconstruction.job_id)).all()
    payload = ReconstructionResponse(
        id=reconstruction.id,
        mission_id=reconstruction.mission_id,
        job_id=reconstruction.job_id,
        status=reconstruction.status,
        engine=reconstruction.engine,
        coordinate_reference_system=reconstruction.coordinate_reference_system,
        scale_status=reconstruction.scale_status,
        point_count=reconstruction.point_count,
        mesh_faces=reconstruction.mesh_faces,
        metrics=reconstruction.metrics or {},
        warnings=reconstruction.warnings or [],
        assets=[asset_response(asset) for asset in assets],
    )
    return response(payload)


@router.get("/scene")
def get_scene(mission: Mission = Depends(mission_or_404), db: Session = Depends(get_db)) -> dict:
    reconstruction = db.scalar(select(Reconstruction).where(Reconstruction.mission_id == mission.id))
    assets = db.scalars(select(Asset).where(Asset.mission_id == mission.id).order_by(Asset.created_at.desc())).all()
    return response(
        {
            "mission_id": mission.id,
            "status": reconstruction.status if reconstruction else "NOT_GENERATED",
            "coordinate_reference_system": reconstruction.coordinate_reference_system if reconstruction else None,
            "scale_status": reconstruction.scale_status if reconstruction else None,
            "assets": [asset_response(asset).model_dump() for asset in assets],
            "layers": {"point_cloud": any(asset.asset_type == "POINT_CLOUD" for asset in assets), "mesh": any(asset.asset_type == "MESH" for asset in assets)},
        }
    )
