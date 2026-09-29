from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "AeroTwin API"
    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'aerotwin.db').as_posix()}"
    storage_dir: Path = BACKEND_DIR / "data" / "storage"
    max_upload_size_mb: int = 4096
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"
    reconstruction_engine: str = "auto"
    frame_sample_fps: float = 1.5

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def data_dir(self) -> Path:
        return self.storage_dir.parent

    @property
    def public_assets_dir(self) -> Path:
        return self.storage_dir / "published"

    def ensure_directories(self) -> None:
        for directory in (self.data_dir, self.storage_dir, self.public_assets_dir):
            directory.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
