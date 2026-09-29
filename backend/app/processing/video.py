from __future__ import annotations

import csv
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

from app.core.errors import AeroTwinError


@dataclass(frozen=True)
class VideoMetadata:
    width: int
    height: int
    fps: float
    frame_count: int
    duration_seconds: float
    codec: str


@dataclass(frozen=True)
class SelectedFrame:
    frame_number: int
    timestamp_seconds: float
    path: Path
    sharpness: float
    brightness: float
    contrast: float
    difference: float


@dataclass(frozen=True)
class FrameSelectionResult:
    metadata: VideoMetadata
    sampled_count: int
    selected_frames: list[SelectedFrame]
    rejected_blurry: int
    rejected_exposure: int
    rejected_duplicate: int

    def metrics(self) -> dict[str, object]:
        return {
            "video": asdict(self.metadata),
            "sampled_frame_count": self.sampled_count,
            "selected_frame_count": len(self.selected_frames),
            "frame_acceptance_rate": round(len(self.selected_frames) / max(1, self.sampled_count), 4),
            "rejected": {
                "blurry_or_low_contrast": self.rejected_blurry,
                "exposure": self.rejected_exposure,
                "duplicate": self.rejected_duplicate,
            },
        }


def _codec_name(value: float) -> str:
    integer = int(value)
    return "".join(chr((integer >> (8 * index)) & 0xFF) for index in range(4)).strip() or "unknown"


def inspect_video(video_path: Path) -> VideoMetadata:
    capture = cv2.VideoCapture(str(video_path))
    try:
        if not capture.isOpened():
            raise AeroTwinError("VIDEO_INVALID", "The uploaded video could not be opened.")
        success, _ = capture.read()
        if not success:
            raise AeroTwinError("VIDEO_INVALID", "The uploaded video contains no readable frames.")
        capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        return VideoMetadata(
            width=int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0),
            height=int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0),
            fps=round(fps, 3),
            frame_count=frame_count,
            duration_seconds=round(frame_count / fps, 3) if fps else 0.0,
            codec=_codec_name(capture.get(cv2.CAP_PROP_FOURCC)),
        )
    finally:
        capture.release()


def extract_selected_frames(
    video_path: Path,
    output_dir: Path,
    sample_fps: float,
    preset: str,
    progress: Callable[[int, str], None] | None = None,
) -> FrameSelectionResult:
    metadata = inspect_video(video_path)
    if metadata.frame_count <= 0 or metadata.fps <= 0:
        raise AeroTwinError("VIDEO_INVALID", "Video frame-rate or frame count is unavailable.")

    output_dir.mkdir(parents=True, exist_ok=True)
    for old_frame in output_dir.glob("*.jpg"):
        old_frame.unlink()

    target_fps = {"FAST": min(1.0, sample_fps), "BALANCED": sample_fps, "HIGH_QUALITY": min(4.0, sample_fps * 2)}[preset]
    interval = max(1, round(metadata.fps / max(0.25, target_fps)))
    max_selected = {"FAST": 80, "BALANCED": 220, "HIGH_QUALITY": 500}[preset]
    capture = cv2.VideoCapture(str(video_path))
    selected: list[SelectedFrame] = []
    sampled_count = 0
    rejected_blurry = 0
    rejected_exposure = 0
    rejected_duplicate = 0
    last_thumbnail: np.ndarray | None = None
    frame_number = 0
    last_reported = -1

    try:
        while True:
            success, frame = capture.read()
            if not success:
                break
            if frame_number % interval != 0:
                frame_number += 1
                continue

            sampled_count += 1
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            brightness = float(gray.mean())
            contrast = float(gray.std())
            if sharpness < 24 or contrast < 10:
                rejected_blurry += 1
            elif brightness < 18 or brightness > 245:
                rejected_exposure += 1
            else:
                thumbnail = cv2.resize(gray, (96, 54), interpolation=cv2.INTER_AREA)
                difference = 0.0 if last_thumbnail is None else float(cv2.absdiff(last_thumbnail, thumbnail).mean())
                if last_thumbnail is not None and difference < 2.3:
                    rejected_duplicate += 1
                elif len(selected) < max_selected:
                    target = output_dir / f"selected_{len(selected) + 1:05d}.jpg"
                    cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 93])
                    selected.append(
                        SelectedFrame(
                            frame_number=frame_number,
                            timestamp_seconds=round(frame_number / metadata.fps, 3),
                            path=target,
                            sharpness=round(sharpness, 3),
                            brightness=round(brightness, 3),
                            contrast=round(contrast, 3),
                            difference=round(difference, 3),
                        )
                    )
                    last_thumbnail = thumbnail
                else:
                    rejected_duplicate += 1

            current_progress = int((frame_number / max(1, metadata.frame_count)) * 100)
            if progress and current_progress >= last_reported + 10:
                progress(current_progress, f"Selected {len(selected)} high-quality frames")
                last_reported = current_progress
            frame_number += 1
    finally:
        capture.release()

    if sampled_count < 8 or len(selected) < 4:
        raise AeroTwinError(
            "NO_USABLE_FRAMES",
            "Too few sharp, distinct frames passed the quality gate.",
            details={"sampled_frames": sampled_count, "selected_frames": len(selected)},
        )

    return FrameSelectionResult(
        metadata=metadata,
        sampled_count=sampled_count,
        selected_frames=selected,
        rejected_blurry=rejected_blurry,
        rejected_exposure=rejected_exposure,
        rejected_duplicate=rejected_duplicate,
    )


def read_gps_track(gps_path: Path | None) -> list[tuple[float, float, float, float]]:
    if gps_path is None or not gps_path.exists() or gps_path.suffix.lower() != ".csv":
        return []
    records: list[tuple[float, float, float, float]] = []
    with gps_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames:
            return records
        normalized = {name.lower().strip(): name for name in reader.fieldnames}
        lat_key = next((normalized[key] for key in ("lat", "latitude") if key in normalized), None)
        lon_key = next((normalized[key] for key in ("lon", "lng", "longitude") if key in normalized), None)
        alt_key = next((normalized[key] for key in ("alt", "altitude", "height") if key in normalized), None)
        time_key = next((normalized[key] for key in ("time", "timestamp", "timestamp_seconds", "seconds") if key in normalized), None)
        if not lat_key or not lon_key or not time_key:
            return records
        for row in reader:
            try:
                records.append((float(row[time_key]), float(row[lat_key]), float(row[lon_key]), float(row.get(alt_key) or 0)))
            except (TypeError, ValueError):
                continue
    return sorted(records, key=lambda record: record[0])


def estimate_gps_baseline(track: list[tuple[float, float, float, float]], start: float, end: float) -> float | None:
    if len(track) < 2:
        return None
    first = min(track, key=lambda record: abs(record[0] - start))
    second = min(track, key=lambda record: abs(record[0] - end))
    latitude = np.radians((first[1] + second[1]) / 2)
    delta_lat = np.radians(second[1] - first[1])
    delta_lon = np.radians(second[2] - first[2])
    haversine = np.sin(delta_lat / 2) ** 2 + np.cos(np.radians(first[1])) * np.cos(np.radians(second[1])) * np.sin(delta_lon / 2) ** 2
    horizontal_m = 6_371_000 * 2 * np.arctan2(np.sqrt(haversine), np.sqrt(max(0, 1 - haversine)))
    vertical_m = second[3] - first[3]
    baseline = float(np.hypot(horizontal_m, vertical_m))
    return baseline if baseline >= 0.05 else None
