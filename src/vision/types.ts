export type MonitoringStatus =
  | "camera-disabled"
  | "camera-loading"
  | "camera-active"
  | "camera-permission-denied"
  | "camera-permission-setup"
  | "camera-unavailable"
  | "camera-stopped"
  | "model-loading"
  | "tracking"
  | "no-face"
  | "multiple-faces"
  | "low-confidence"
  | "tracking-error";

export type TrackingQuality = "good" | "low" | "unavailable";

export type CameraErrorCode =
  | "not-allowed"
  | "no-camera"
  | "camera-busy"
  | "constraints-unsatisfied"
  | "aborted"
  | "unsupported-context"
  | "stream-ended"
  | "runtime-error";

export interface CameraDiagnostic {
  code: CameraErrorCode;
  name: string;
  message: string;
  constraint?: string;
  secureContext: boolean;
  mediaDevicesAvailable: boolean;
  getUserMediaAvailable: boolean;
  request?: CameraRequestDiagnostic;
}

export interface CameraRequestDiagnostic {
  requestedAt: string | null;
  resolvedAt: string | null;
  visibilityState: DocumentVisibilityState | "unavailable";
  hasFocus: boolean | null;
  secureContext: boolean;
  mediaDevicesAvailable: boolean;
  getUserMediaAvailable: boolean;
  permissionState: PermissionState | "pending" | "unsupported" | "query-error";
  permissionQueryError?: {
    name: string;
    message: string;
  };
  constraints: CameraConstraints;
  streamReturned: boolean;
  videoTrackCount: number | null;
  videoTrackReadyState: MediaStreamTrackState | null;
  videoTrackMuted: boolean | null;
  videoTrackSettings?: MediaTrackSettings;
  error?: {
    name: string;
    message: string;
  };
}

export interface FaceLandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface HeadOrientation {
  /** Camera-relative signed angle proxy. Positive points toward image-right. */
  yaw: number | null;
  /** Camera-relative signed angle proxy. Positive points toward image-up. */
  pitch: number | null;
  /** Image-plane angle. Positive rotates clockwise toward image-right. */
  roll: number | null;
}

export type BlinkState = "open" | "closing" | "closed" | "unavailable";

export interface BlinkSignal {
  state: BlinkState;
  observedBlinkCount: number;
}

/** Compact per-frame values used only inside the local vision worker. */
export interface InstantSignalValues {
  facePresent: boolean;
  faceCount: number;
  relativeFaceScale: number | null;
  headOrientation: HeadOrientation;
  eyeOpenness: number | null;
}

/**
 * The first product-signal contract. This compact shape is safe to publish
 * from the local vision worker to the main thread.
 */
export interface ProductSignalSnapshot {
  facePresent: boolean;
  faceCount: number;
  /** Normalized camera-relative face scale; never a physical distance. */
  relativeFaceScale: number | null;
  /** Camera-relative orientation proxies in degrees; never medical measurements. */
  headOrientation: HeadOrientation;
  /** Locally observed eye-closure events; never a dry-eye measurement. */
  blink: BlinkSignal;
}

export interface NormalizedBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/** Worker-local landmark data. This type must never cross the worker boundary. */
export interface LandmarkFrame {
  faces: readonly (readonly FaceLandmarkPoint[])[];
  timestampMs: number;
  inferenceTimeMs: number;
}

export interface TrackingSnapshot extends ProductSignalSnapshot {
  status: MonitoringStatus;
  quality: TrackingQuality;
  qualityScore?: number;
  fps?: number;
  inferenceTimeMs?: number;
  timestampMs?: number;
  errorCode?: CameraErrorCode | "model-load-failed" | "processing-failed";
  diagnosticError?: DiagnosticError;
  cameraDiagnostic?: CameraDiagnostic;
}

export interface MonitoringState extends TrackingSnapshot {
  isMonitoring: boolean;
}

export interface VideoElementDiagnostic {
  elementExists: boolean;
  srcObjectAssigned: boolean;
  readyState: number | null;
  networkState: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  paused: boolean | null;
  ended: boolean | null;
  currentTime: number | null;
  loadedMetadataAt: number | null;
  canPlayAt: number | null;
  playingAt: number | null;
  firstFrameAvailableAt: number | null;
  firstFrameSource: "video-frame-callback" | "image-bitmap" | null;
}

export interface DiagnosticError {
  name: string;
  message: string;
}

export interface FaceTrackerDiagnostic {
  workerCreatedAt: number | null;
  modelInitializationStartedAt: number | null;
  modelInitializationCompletedAt: number | null;
  modelInitializationError: DiagnosticError | null;
  workerMessageCount: number;
  lastWorkerMessageType: "ready" | "result" | "error" | null;
  lastWorkerMessageAt: number | null;
  workerErrorCount: number;
  lastWorkerErrorAt: number | null;
  lastWorkerError: DiagnosticError | null;
  firstFrameSubmittedAt: number | null;
  frameSubmissionCount: number;
  firstSuccessfulResultAt: number | null;
  successfulResultCount: number;
  processingErrorAt: number | null;
  processingError: DiagnosticError | null;
  lastProcessingLatencyMs: number | null;
  timestampsMonotonic: boolean | null;
  lastSubmittedTimestampMs: number | null;
  lastResultTimestampMs: number | null;
  workerTerminatedAt: number | null;
  workerTerminationReason: string | null;
}

export interface MonitoringDiagnosticEvent {
  at: number;
  event: string;
  detail?: string;
}

export interface MonitoringDiagnostics {
  cameraRequest: CameraRequestDiagnostic | null;
  video: VideoElementDiagnostic;
  tracker: FaceTrackerDiagnostic;
  lifecycleEvents: MonitoringDiagnosticEvent[];
}

export type FaceTrackerDiagnosticEvent =
  | { type: "worker-created"; at: number }
  | { type: "model-initialization-started"; at: number }
  | { type: "model-initialization-completed"; at: number }
  | { type: "model-initialization-error"; at: number; error: DiagnosticError }
  | { type: "worker-message"; at: number; messageType: "ready" | "result" | "error" }
  | { type: "worker-error"; at: number; error: DiagnosticError }
  | { type: "frame-submitted"; at: number; timestampMs: number; timestampsMonotonic: boolean }
  | { type: "result-received"; at: number; timestampMs?: number; processingLatencyMs?: number }
  | { type: "processing-error"; at: number; error: DiagnosticError }
  | { type: "worker-terminated"; at: number; reason: string };

export interface CameraConstraints {
  video: {
    facingMode: { ideal: "user" };
    width: { ideal: number; max: number };
    height: { ideal: number; max: number };
    frameRate: { ideal: number; max: number };
  };
  audio: false;
}
