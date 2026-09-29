from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import router as api_router
from app.core.config import get_settings
from app.core.errors import AeroTwinError
from app.db import Base, engine
from app.processing.reconstruction import colmap_available


settings = get_settings()
settings.ensure_directories()


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_directories()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="AeroTwin API",
    version="0.1.0",
    description="Drone-video ingestion, reconstruction jobs, 3D asset publishing, and inspection data.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.exception_handler(AeroTwinError)
async def aerotwin_error_handler(_: Request, exc: AeroTwinError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details or {}}},
    )


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "aerotwin-api",
        "environment": settings.app_env,
        "reconstruction": {"two_view_opencv": True, "colmap_available": colmap_available()},
    }


@app.get("/health/live")
def live() -> dict:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict:
    return {"status": "ready", "storage": str(settings.storage_dir.exists())}


app.include_router(api_router)
app.mount("/assets", StaticFiles(directory=settings.public_assets_dir), name="assets")
