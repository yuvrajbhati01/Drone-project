from __future__ import annotations

import hashlib
import shutil
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import Settings
from app.core.errors import AeroTwinError


VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}
GPS_EXTENSIONS = {".csv", ".srt", ".json", ".txt"}


@dataclass(frozen=True)
class StoredUpload:
    storage_key: str
    original_filename: str
    mime_type: str | None
    size_bytes: int
    checksum: str


class StorageService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def mission_dir(self, mission_id: str) -> Path:
        directory = self.settings.storage_dir / "missions" / mission_id
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    def resolve_storage_key(self, storage_key: str) -> Path:
        candidate = (self.settings.storage_dir / storage_key).resolve()
        root = self.settings.storage_dir.resolve()
        if root not in candidate.parents and candidate != root:
            raise AeroTwinError("STORAGE_ERROR", "Invalid storage key.")
        return candidate

    async def save_upload(self, mission_id: str, kind: str, upload: UploadFile) -> StoredUpload:
        original_filename = Path(upload.filename or "upload.bin").name
        suffix = Path(original_filename).suffix.lower()
        allowed_extensions = VIDEO_EXTENSIONS if kind == "video" else GPS_EXTENSIONS
        if suffix not in allowed_extensions:
            raise AeroTwinError(
                "FILE_TYPE_INVALID",
                f"Unsupported {kind} file. Allowed extensions: {', '.join(sorted(allowed_extensions))}",
            )

        target_dir = self.mission_dir(mission_id) / "uploads"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_name = f"{kind}-{uuid4().hex}{suffix}"
        target_path = target_dir / target_name
        max_bytes = self.settings.max_upload_size_mb * 1024 * 1024
        size_bytes = 0
        digest = hashlib.sha256()

        try:
            with target_path.open("xb") as destination:
                while chunk := await upload.read(1024 * 1024):
                    size_bytes += len(chunk)
                    if size_bytes > max_bytes:
                        destination.close()
                        target_path.unlink(missing_ok=True)
                        raise AeroTwinError(
                            "VIDEO_TOO_LARGE",
                            f"File exceeds the {self.settings.max_upload_size_mb} MB upload limit.",
                        )
                    digest.update(chunk)
                    destination.write(chunk)
        except FileExistsError as exc:
            raise AeroTwinError("STORAGE_ERROR", "Could not allocate upload storage.") from exc
        finally:
            await upload.close()

        return StoredUpload(
            storage_key=target_path.relative_to(self.settings.storage_dir).as_posix(),
            original_filename=original_filename,
            mime_type=upload.content_type,
            size_bytes=size_bytes,
            checksum=digest.hexdigest(),
        )

    def publish_asset(self, mission_id: str, job_id: str, source: Path, asset_type: str) -> tuple[str, Path]:
        if not source.exists() or not source.is_file():
            raise AeroTwinError("STORAGE_ERROR", "Generated asset was not found.")
        target_dir = self.settings.public_assets_dir / "missions" / mission_id / job_id
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / source.name
        shutil.copy2(source, target)
        storage_key = target.relative_to(self.settings.public_assets_dir).as_posix()
        return storage_key, target
