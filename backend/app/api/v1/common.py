from __future__ import annotations

from typing import Any

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.errors import AeroTwinError
from app.db import get_db
from app.models import Mission


def response(data: Any, *, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"data": data}
    if meta:
        payload["meta"] = meta
    return payload


def mission_or_404(mission_id: str, db: Session = Depends(get_db)) -> Mission:
    mission = db.get(Mission, mission_id)
    if mission is None:
        raise AeroTwinError("MISSION_NOT_FOUND", "Mission was not found.", status_code=404)
    return mission
