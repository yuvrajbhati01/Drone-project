from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

from app.core.errors import AeroTwinError
from app.processing.video import SelectedFrame, estimate_gps_baseline


@dataclass(frozen=True)
class ReconstructionOutput:
    ply_path: Path
    obj_path: Path
    point_count: int
    mesh_faces: int
    metrics: dict[str, object]
    coordinate_reference_system: str
    scale_status: str
    warnings: list[str]


def colmap_available() -> bool:
    return shutil.which("colmap") is not None


def run_two_view_reconstruction(
    selected_frames: list[SelectedFrame],
    output_dir: Path,
    gps_track: list[tuple[float, float, float, float]],
    progress: Callable[[int, str], None] | None = None,
) -> ReconstructionOutput:
    if len(selected_frames) < 2:
        raise AeroTwinError("INSUFFICIENT_FEATURES", "At least two selected frames are required for reconstruction.")

    output_dir.mkdir(parents=True, exist_ok=True)
    pair_candidates = _candidate_pairs(len(selected_frames))
    best: _PairResult | None = None
    for index, (first_index, second_index) in enumerate(pair_candidates, start=1):
        candidate = _reconstruct_pair(selected_frames[first_index], selected_frames[second_index])
        if candidate and (best is None or candidate.score > best.score):
            best = candidate
        if progress:
            progress(45 + int(index / len(pair_candidates) * 20), f"Matched candidate pair {index} of {len(pair_candidates)}")

    if best is None or len(best.points_3d) < 30:
        raise AeroTwinError(
            "INSUFFICIENT_FEATURES",
            "Frame overlap or visual texture was insufficient for stable triangulation.",
            details={"candidate_pairs": len(pair_candidates)},
        )

    baseline = estimate_gps_baseline(gps_track, best.first.timestamp_seconds, best.second.timestamp_seconds)
    scale = baseline if baseline is not None else 1.0
    points_3d = best.points_3d * scale
    scale_status = "GPS_ESTIMATED" if baseline is not None else "LOCAL_RELATIVE"
    crs = "EPSG:4326 + local ENU estimate" if baseline is not None else "LOCAL_RELATIVE"
    faces = _build_mesh_faces(best.points_2d, points_3d, best.width, best.height)

    ply_path = output_dir / "sparse_point_cloud.ply"
    obj_path = output_dir / "coarse_mesh.obj"
    _write_colored_ply(ply_path, points_3d, best.colors)
    _write_obj(obj_path, points_3d, faces)

    metrics: dict[str, object] = {
        "feature_detector": best.detector,
        "raw_matches": best.raw_matches,
        "geometric_inliers": best.inlier_count,
        "inlier_ratio": round(best.inlier_count / max(1, best.raw_matches), 4),
        "median_parallax_pixels": round(best.median_parallax, 3),
        "triangulated_points": int(len(points_3d)),
        "gps_baseline_m": round(baseline, 3) if baseline is not None else None,
        "quality_note": "Two-view fallback is a real sparse reconstruction, but it is not a replacement for full multi-view SfM/MVS.",
    }
    warnings = [
        "The local two-view fallback was used because COLMAP is not installed.",
        "Metric scale is estimated only when a time-synchronized GPS CSV is supplied.",
        "Use COLMAP or OpenDroneMap for production dense reconstruction and textured meshes.",
    ]
    return ReconstructionOutput(
        ply_path=ply_path,
        obj_path=obj_path,
        point_count=len(points_3d),
        mesh_faces=len(faces),
        metrics=metrics,
        coordinate_reference_system=crs,
        scale_status=scale_status,
        warnings=warnings,
    )


@dataclass(frozen=True)
class _PairResult:
    first: SelectedFrame
    second: SelectedFrame
    points_3d: np.ndarray
    points_2d: np.ndarray
    colors: np.ndarray
    raw_matches: int
    inlier_count: int
    median_parallax: float
    score: float
    width: int
    height: int
    detector: str


def _candidate_pairs(count: int) -> list[tuple[int, int]]:
    # A single drone pass often has usable overlap in neighbouring keyframes,
    # while first-to-last pairs can have no shared scene at all. Probe a small
    # spread of short and medium temporal baselines instead of assuming that
    # the widest baseline is geometrically matchable.
    anchors = {0, max(0, count // 4), max(0, count // 2), max(0, (3 * count) // 4), max(0, count - 4)}
    candidates: set[tuple[int, int]] = set()
    for anchor in anchors:
        for gap in (1, 2, 3):
            if anchor + gap < count:
                candidates.add((anchor, anchor + gap))
    return sorted(candidates)


def _reconstruct_pair(first: SelectedFrame, second: SelectedFrame) -> _PairResult | None:
    first_image = cv2.imread(str(first.path), cv2.IMREAD_COLOR)
    second_image = cv2.imread(str(second.path), cv2.IMREAD_COLOR)
    if first_image is None or second_image is None:
        return None
    first_image, scale = _resize_for_features(first_image)
    second_image, _ = _resize_for_features(second_image)
    height, width = first_image.shape[:2]
    first_gray = cv2.cvtColor(first_image, cv2.COLOR_BGR2GRAY)
    second_gray = cv2.cvtColor(second_image, cv2.COLOR_BGR2GRAY)
    detector, detector_name, norm = _create_detector()
    keypoints_1, descriptors_1 = detector.detectAndCompute(first_gray, None)
    keypoints_2, descriptors_2 = detector.detectAndCompute(second_gray, None)
    if descriptors_1 is None or descriptors_2 is None:
        return None
    matcher = cv2.BFMatcher(norm)
    knn_matches = matcher.knnMatch(descriptors_1, descriptors_2, k=2)
    good_matches = [pair[0] for pair in knn_matches if len(pair) == 2 and pair[0].distance < 0.74 * pair[1].distance]
    if len(good_matches) < 18:
        return None
    points_1 = np.float32([keypoints_1[match.queryIdx].pt for match in good_matches])
    points_2 = np.float32([keypoints_2[match.trainIdx].pt for match in good_matches])
    focal = 0.9 * max(width, height)
    camera_matrix = np.array([[focal, 0, width / 2], [0, focal, height / 2], [0, 0, 1]], dtype=np.float64)
    essential, essential_mask = cv2.findEssentialMat(points_1, points_2, camera_matrix, method=cv2.RANSAC, prob=0.999, threshold=1.25)
    if essential is None or essential_mask is None:
        return None
    recovered, rotation, translation, pose_mask = cv2.recoverPose(essential, points_1, points_2, camera_matrix, mask=essential_mask)
    if recovered < 18 or pose_mask is None:
        return None
    inlier_mask = pose_mask.ravel().astype(bool)
    inlier_points_1 = points_1[inlier_mask]
    inlier_points_2 = points_2[inlier_mask]
    if len(inlier_points_1) < 18:
        return None
    projection_1 = camera_matrix @ np.hstack((np.eye(3), np.zeros((3, 1))))
    projection_2 = camera_matrix @ np.hstack((rotation, translation))
    homogeneous = cv2.triangulatePoints(projection_1, projection_2, inlier_points_1.T, inlier_points_2.T)
    points_3d = (homogeneous[:3] / homogeneous[3]).T
    second_depth = (rotation @ points_3d.T + translation).T[:, 2]
    finite = np.isfinite(points_3d).all(axis=1) & (points_3d[:, 2] > 0) & (second_depth > 0)
    points_3d = points_3d[finite]
    points_2d = inlier_points_1[finite]
    if len(points_3d) < 18:
        return None
    depths = points_3d[:, 2]
    depth_limit = np.percentile(depths, 96)
    keep = depths < depth_limit
    points_3d = points_3d[keep]
    points_2d = points_2d[keep]
    pixels = np.round(points_2d).astype(int)
    pixels[:, 0] = np.clip(pixels[:, 0], 0, width - 1)
    pixels[:, 1] = np.clip(pixels[:, 1], 0, height - 1)
    colors = first_image[pixels[:, 1], pixels[:, 0]][:, ::-1]
    parallax = np.linalg.norm(inlier_points_1[finite][keep] - inlier_points_2[finite][keep], axis=1)
    score = float(len(points_3d) * max(1.0, np.median(parallax)))
    return _PairResult(
        first=first,
        second=second,
        points_3d=points_3d.astype(np.float32),
        points_2d=points_2d.astype(np.float32),
        colors=colors.astype(np.uint8),
        raw_matches=len(good_matches),
        inlier_count=int(len(points_3d)),
        median_parallax=float(np.median(parallax)),
        score=score,
        width=width,
        height=height,
        detector=detector_name,
    )


def _resize_for_features(image: np.ndarray) -> tuple[np.ndarray, float]:
    height, width = image.shape[:2]
    maximum = 1280
    if max(width, height) <= maximum:
        return image, 1.0
    scale = maximum / max(width, height)
    return cv2.resize(image, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA), scale


def _create_detector() -> tuple[cv2.Feature2D, str, int]:
    if hasattr(cv2, "SIFT_create"):
        return cv2.SIFT_create(nfeatures=5000), "SIFT", cv2.NORM_L2
    return cv2.ORB_create(nfeatures=5000), "ORB", cv2.NORM_HAMMING


def _build_mesh_faces(points_2d: np.ndarray, points_3d: np.ndarray, width: int, height: int) -> list[tuple[int, int, int]]:
    if len(points_2d) < 8:
        return []
    subdiv = cv2.Subdiv2D((0, 0, width, height))
    for point in points_2d:
        try:
            subdiv.insert((float(point[0]), float(point[1])))
        except cv2.error:
            continue
    faces: set[tuple[int, int, int]] = set()
    triangles = subdiv.getTriangleList()
    for triangle in triangles:
        vertices = triangle.reshape(3, 2)
        if np.any(vertices[:, 0] < 0) or np.any(vertices[:, 0] >= width) or np.any(vertices[:, 1] < 0) or np.any(vertices[:, 1] >= height):
            continue
        indexes = []
        for vertex in vertices:
            distances = np.sum((points_2d - vertex) ** 2, axis=1)
            index = int(np.argmin(distances))
            if distances[index] > 4.0:
                indexes = []
                break
            indexes.append(index)
        if len(set(indexes)) == 3:
            faces.add(tuple(indexes))
    if not faces:
        return []
    lengths = []
    for first, second, third in faces:
        lengths.extend((np.linalg.norm(points_3d[first] - points_3d[second]), np.linalg.norm(points_3d[second] - points_3d[third]), np.linalg.norm(points_3d[third] - points_3d[first])))
    maximum_edge = float(np.percentile(lengths, 75)) * 2.5
    return [face for face in faces if max(np.linalg.norm(points_3d[face[0]] - points_3d[face[1]]), np.linalg.norm(points_3d[face[1]] - points_3d[face[2]]), np.linalg.norm(points_3d[face[2]] - points_3d[face[0]])) <= maximum_edge]


def _write_colored_ply(path: Path, points: np.ndarray, colors: np.ndarray) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as destination:
        destination.write("ply\nformat ascii 1.0\n")
        destination.write(f"element vertex {len(points)}\n")
        destination.write("property float x\nproperty float y\nproperty float z\n")
        destination.write("property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n")
        for point, color in zip(points, colors, strict=True):
            destination.write(f"{point[0]:.7f} {point[1]:.7f} {point[2]:.7f} {int(color[0])} {int(color[1])} {int(color[2])}\n")


def _write_obj(path: Path, points: np.ndarray, faces: list[tuple[int, int, int]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as destination:
        destination.write("# AeroTwin two-view reconstruction mesh\n")
        for point in points:
            destination.write(f"v {point[0]:.7f} {point[1]:.7f} {point[2]:.7f}\n")
        for first, second, third in faces:
            destination.write(f"f {first + 1} {second + 1} {third + 1}\n")
