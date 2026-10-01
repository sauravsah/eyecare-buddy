import type {
  FaceLandmarkPoint,
  LandmarkFrame,
  MonitoringState,
  NormalizedBoundingBox,
  TrackingSnapshot
} from "./types";
import { extractInstantSignals, extractProductSignals } from "./signals";
import { TemporalSignalProcessor } from "./temporal";

const MIN_LANDMARKS_FOR_QUALITY = 20;
const MIN_FACE_AREA = 0.005;
const MAX_EDGE_OVERFLOW = 0.04;

export function createInitialMonitoringState(
  status: MonitoringState["status"] = "camera-disabled"
): MonitoringState {
  return {
    status,
    isMonitoring: false,
    facePresent: false,
    faceCount: 0,
    relativeFaceScale: null,
    headOrientation: { yaw: null, pitch: null, roll: null },
    blink: { state: "unavailable", observedBlinkCount: 0 },
    quality: "unavailable"
  };
}

export function createCameraState(
  status: MonitoringState["status"],
  isMonitoring: boolean
): MonitoringState {
  return {
    ...createInitialMonitoringState(status),
    isMonitoring
  };
}

export function assessLandmarkQuality(landmarks: readonly FaceLandmarkPoint[]): {
  quality: "good" | "low";
  qualityScore: number;
  boundingBox: NormalizedBoundingBox;
} {
  const validLandmarks = landmarks.filter(isFiniteLandmark);
  const completeness = landmarks.length === 0 ? 0 : validLandmarks.length / landmarks.length;
  const boundingBox = calculateBoundingBox(validLandmarks);
  const area = boundingBox.width * boundingBox.height;
  const edgeOverflow = Math.max(
    0,
    -boundingBox.minX,
    -boundingBox.minY,
    boundingBox.maxX - 1,
    boundingBox.maxY - 1
  );
  const inFrameScore = Math.max(0, 1 - edgeOverflow / MAX_EDGE_OVERFLOW);
  const sizeScore = Math.min(1, area / MIN_FACE_AREA);
  const qualityScore = Math.max(
    0,
    Math.min(1, completeness * 0.65 + inFrameScore * 0.25 + sizeScore * 0.1)
  );
  const quality =
    landmarks.length < MIN_LANDMARKS_FOR_QUALITY ||
    completeness < 0.98 ||
    edgeOverflow > MAX_EDGE_OVERFLOW ||
    area < MIN_FACE_AREA
      ? "low"
      : "good";

  return { quality, qualityScore, boundingBox };
}

export function deriveTrackingSnapshot(
  frame: LandmarkFrame,
  temporalProcessor?: TemporalSignalProcessor
): TrackingSnapshot {
  const faces = frame.faces;
  const productSignals = temporalProcessor
    ? temporalProcessor.process(extractInstantSignals(frame), frame.timestampMs)
    : extractProductSignals(frame);
  const base = {
    ...productSignals,
    inferenceTimeMs: frame.inferenceTimeMs,
    timestampMs: frame.timestampMs
  };

  if (faces.length === 0) {
    return { ...base, status: "no-face", quality: "unavailable" };
  }

  if (faces.length > 1) {
    return { ...base, status: "multiple-faces", quality: "unavailable" };
  }

  const quality = assessLandmarkQuality(faces[0]);
  return {
    ...base,
    status: quality.quality === "good" ? "tracking" : "low-confidence",
    quality: quality.quality,
    qualityScore: quality.qualityScore
  };
}

export function calculateBoundingBox(
  landmarks: readonly FaceLandmarkPoint[]
): NormalizedBoundingBox {
  if (landmarks.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const xValues = landmarks.map((landmark) => landmark.x);
  const yValues = landmarks.map((landmark) => landmark.y);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function isFiniteLandmark(landmark: FaceLandmarkPoint): boolean {
  return Number.isFinite(landmark.x) && Number.isFinite(landmark.y) && Number.isFinite(landmark.z);
}
