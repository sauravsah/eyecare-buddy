import type {
  BlinkSignal,
  FaceLandmarkPoint,
  HeadOrientation,
  InstantSignalValues,
  LandmarkFrame,
  ProductSignalSnapshot
} from "./types";

const FOREHEAD_INDEX = 10;
const CHIN_INDEX = 152;
const IMAGE_LEFT_FACE_SIDE_INDEX = 234;
const IMAGE_RIGHT_FACE_SIDE_INDEX = 454;

// Stable points from the official MediaPipe eye contours, averaged to reduce
// sensitivity to one noisy landmark.
const IMAGE_LEFT_EYE_INDICES = [33, 133, 159, 145] as const;
const IMAGE_RIGHT_EYE_INDICES = [263, 362, 386, 374] as const;

const EYE_GEOMETRY = [
  { outer: 33, inner: 133, upperA: 159, lowerA: 145, upperB: 158, lowerB: 153 },
  { outer: 263, inner: 362, upperA: 386, lowerA: 374, upperB: 385, lowerB: 380 }
] as const;

const MAX_ORIENTATION_ANGLE = 90;

/**
 * Extracts the first compact product signals from worker-local landmarks.
 * The input contains raw landmarks but the returned value does not.
 */
export function extractProductSignals(
  frame: Pick<LandmarkFrame, "faces">
): ProductSignalSnapshot {
  const instantSignals = extractInstantSignals(frame);
  return createProductSignalSnapshot(instantSignals, {
    state: instantSignals.eyeOpenness === null ? "unavailable" : "open",
    observedBlinkCount: 0
  });
}

export function extractInstantSignals(
  frame: Pick<LandmarkFrame, "faces">
): InstantSignalValues {
  const faceCount = frame.faces.length;
  const landmarks = faceCount === 1 ? frame.faces[0] : null;
  const relativeFaceScale = landmarks !== null
    ? calculateRelativeFaceScale(landmarks)
    : null;
  const headOrientation = landmarks !== null
    ? estimateHeadOrientation(landmarks)
    : createEmptyHeadOrientation();

  return {
    facePresent: faceCount > 0,
    faceCount,
    relativeFaceScale,
    headOrientation,
    eyeOpenness: landmarks === null ? null : calculateEyeOpenness(landmarks)
  };
}

export function createProductSignalSnapshot(
  signals: InstantSignalValues,
  blink: BlinkSignal
): ProductSignalSnapshot {
  return {
    facePresent: signals.facePresent,
    faceCount: signals.faceCount,
    relativeFaceScale: signals.relativeFaceScale,
    headOrientation: signals.headOrientation,
    blink
  };
}

/**
 * Returns a normalized eye-aperture ratio for the current frame. This is a
 * worker-local scalar used by the blink state machine; it is not persisted or
 * published as a medical measurement.
 */
export function calculateEyeOpenness(
  landmarks: readonly FaceLandmarkPoint[]
): number | null {
  const ratios = EYE_GEOMETRY.map((eye) => {
    const outer = getLandmark(landmarks, eye.outer);
    const inner = getLandmark(landmarks, eye.inner);
    const upperA = getLandmark(landmarks, eye.upperA);
    const lowerA = getLandmark(landmarks, eye.lowerA);
    const upperB = getLandmark(landmarks, eye.upperB);
    const lowerB = getLandmark(landmarks, eye.lowerB);

    if (outer === null || inner === null || upperA === null || lowerA === null || upperB === null || lowerB === null) {
      return null;
    }

    const width = distance2D(outer, inner);
    if (width <= 0) {
      return null;
    }

    const aperture = (distance2D(upperA, lowerA) + distance2D(upperB, lowerB)) / 2;
    return aperture / width;
  });

  if (ratios.some((ratio) => ratio === null)) {
    return null;
  }

  const validRatios = ratios as number[];
  const average = validRatios.reduce((sum, ratio) => sum + ratio, 0) / validRatios.length;
  return Number.isFinite(average) ? average : null;
}

/**
 * Estimates camera-relative orientation from worker-local 3D landmark
 * geometry. The output is intentionally an orientation proxy, not a physical
 * pose or medical measurement.
 *
 * MediaPipe supplies image-normalized x/y and relative z coordinates. The
 * local calculation inverts image y to use a conventional y-up axis, then
 * derives a face-plane normal from the cheek-to-cheek and chin-to-forehead
 * axes. No landmark data leaves this module.
 */
function estimateHeadOrientation(
  landmarks: readonly FaceLandmarkPoint[]
): HeadOrientation {
  const forehead = getLandmark(landmarks, FOREHEAD_INDEX);
  const chin = getLandmark(landmarks, CHIN_INDEX);
  const imageLeftFaceSide = getLandmark(landmarks, IMAGE_LEFT_FACE_SIDE_INDEX);
  const imageRightFaceSide = getLandmark(landmarks, IMAGE_RIGHT_FACE_SIDE_INDEX);
  const imageLeftEye = averageLandmarks(landmarks, IMAGE_LEFT_EYE_INDICES);
  const imageRightEye = averageLandmarks(landmarks, IMAGE_RIGHT_EYE_INDICES);

  if (
    forehead === null ||
    chin === null ||
    imageLeftFaceSide === null ||
    imageRightFaceSide === null ||
    imageLeftEye === null ||
    imageRightEye === null
  ) {
    return createEmptyHeadOrientation();
  }

  const horizontalAxis = normalizeVector(
    subtractVectors(toCameraVector(imageRightFaceSide), toCameraVector(imageLeftFaceSide))
  );
  const verticalAxis = normalizeVector(
    subtractVectors(toCameraVector(forehead), toCameraVector(chin))
  );

  if (horizontalAxis === null || verticalAxis === null) {
    return createEmptyHeadOrientation();
  }

  const faceNormal = normalizeVector(crossProduct(horizontalAxis, verticalAxis));
  if (faceNormal === null) {
    return createEmptyHeadOrientation();
  }

  // Do not use the sign of MediaPipe's relative z as a product convention.
  // Orient the normal toward the camera-facing +z half-space instead.
  const cameraFacingNormal = faceNormal.z < 0
    ? scaleVector(faceNormal, -1)
    : faceNormal;
  const roll = radiansToDegrees(
    Math.atan2(imageRightEye.y - imageLeftEye.y, imageRightEye.x - imageLeftEye.x)
  );

  return {
    yaw: clampOrientationAngle(
      radiansToDegrees(Math.atan2(cameraFacingNormal.x, cameraFacingNormal.z))
    ),
    pitch: clampOrientationAngle(
      radiansToDegrees(Math.atan2(cameraFacingNormal.y, cameraFacingNormal.z))
    ),
    roll: clampOrientationAngle(roll)
  };
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

function createEmptyHeadOrientation(): HeadOrientation {
  return { yaw: null, pitch: null, roll: null };
}

function getLandmark(
  landmarks: readonly FaceLandmarkPoint[],
  index: number
): FaceLandmarkPoint | null {
  const landmark = landmarks[index];
  return landmark !== undefined && isFiniteLandmark(landmark) ? landmark : null;
}

function averageLandmarks(
  landmarks: readonly FaceLandmarkPoint[],
  indices: readonly number[]
): FaceLandmarkPoint | null {
  const points = indices.map((index) => getLandmark(landmarks, index));
  if (points.some((point) => point === null)) {
    return null;
  }

  const validPoints = points as FaceLandmarkPoint[];
  return {
    x: validPoints.reduce((sum, point) => sum + point.x, 0) / validPoints.length,
    y: validPoints.reduce((sum, point) => sum + point.y, 0) / validPoints.length,
    z: validPoints.reduce((sum, point) => sum + point.z, 0) / validPoints.length
  };
}

function toCameraVector(point: FaceLandmarkPoint): Vector3 {
  return { x: point.x, y: -point.y, z: point.z };
}

function distance2D(first: FaceLandmarkPoint, second: FaceLandmarkPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function subtractVectors(first: Vector3, second: Vector3): Vector3 {
  return { x: first.x - second.x, y: first.y - second.y, z: first.z - second.z };
}

function crossProduct(first: Vector3, second: Vector3): Vector3 {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x
  };
}

function normalizeVector(vector: Vector3): Vector3 | null {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return length > 0 && Number.isFinite(length)
    ? { x: vector.x / length, y: vector.y / length, z: vector.z / length }
    : null;
}

function scaleVector(vector: Vector3, scalar: number): Vector3 {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

function clampOrientationAngle(angle: number): number {
  return Math.max(-MAX_ORIENTATION_ANGLE, Math.min(MAX_ORIENTATION_ANGLE, angle));
}

/**
 * Uses the geometric mean of the normalized landmark-box width and height as
 * a stable scalar proxy for how large the face appears in the camera frame.
 * It is intentionally not converted to centimeters or any other distance.
 */
function calculateRelativeFaceScale(
  landmarks: readonly FaceLandmarkPoint[]
): number | null {
  const validLandmarks = landmarks.filter(isFiniteLandmark);
  if (validLandmarks.length === 0) {
    return null;
  }

  const xValues = validLandmarks.map((landmark) => landmark.x);
  const yValues = validLandmarks.map((landmark) => landmark.y);
  const width = Math.max(...xValues) - Math.min(...xValues);
  const height = Math.max(...yValues) - Math.min(...yValues);
  if (width <= 0 || height <= 0) {
    return null;
  }

  return Math.sqrt(width * height);
}

function isFiniteLandmark(landmark: FaceLandmarkPoint): boolean {
  return Number.isFinite(landmark.x) && Number.isFinite(landmark.y) && Number.isFinite(landmark.z);
}
