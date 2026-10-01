import type { FaceLandmarkerOptions } from "@mediapipe/tasks-vision";

export const VISION_WASM_PATH = "/mediapipe/wasm";
export const FACE_LANDMARKER_MODEL_PATH = "/models/face_landmarker.task";

/**
 * Two faces are evaluated so the UI can reliably distinguish the multiple-face
 * state. Only one face is accepted for consumer tracking in this milestone.
 */
export const FACE_LANDMARKER_OPTIONS: FaceLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: FACE_LANDMARKER_MODEL_PATH,
    delegate: "CPU"
  },
  numFaces: 2,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  runningMode: "VIDEO"
};
