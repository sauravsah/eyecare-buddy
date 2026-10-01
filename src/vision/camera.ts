import type { CameraConstraints, CameraDiagnostic, CameraErrorCode, CameraRequestDiagnostic, MonitoringStatus } from "./types";

export const CAMERA_CONSTRAINTS: CameraConstraints = {
  video: {
    facingMode: { ideal: "user" },
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 30, max: 30 }
  },
  audio: false
};

export interface CameraRequestObserver {
  onStarted?: (diagnostic: CameraRequestDiagnostic) => void;
  onCompleted?: (diagnostic: CameraRequestDiagnostic) => void;
}

export type CameraPermissionState = PermissionState | "unsupported" | "query-error";

export interface CameraPermissionQueryResult {
  state: CameraPermissionState;
  error?: {
    name: string;
    message: string;
  };
}

export class CameraAccessError extends Error {
  constructor(public readonly code: CameraErrorCode, public readonly diagnostic: CameraDiagnostic) {
    super(diagnostic.message || code);
    this.name = "CameraAccessError";
  }
}

export function classifyCameraError(error: unknown): CameraErrorCode {
  const name = getErrorName(error);

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "not-allowed";
  }

  if (name === "NotFoundError") {
    return "no-camera";
  }

  if (name === "NotReadableError") {
    return "camera-busy";
  }

  if (name === "OverconstrainedError") {
    return "constraints-unsatisfied";
  }

  if (name === "AbortError") {
    return "aborted";
  }

  if (name === "TypeError" || name === "InvalidStateError") {
    return "unsupported-context";
  }

  return "runtime-error";
}

export function cameraErrorToStatus(code: CameraErrorCode): MonitoringStatus {
  return code === "not-allowed" ? "camera-permission-denied" : "camera-unavailable";
}

export async function requestCameraStream(observer?: CameraRequestObserver): Promise<MediaStream> {
  const mediaDevicesAvailable = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
  const getUserMediaAvailable = mediaDevicesAvailable && typeof navigator.mediaDevices.getUserMedia === "function";
  const requestDiagnostic = createRequestDiagnostic(mediaDevicesAvailable, getUserMediaAvailable);
  let requestSettled = false;

  const publishCompleted = (): void => {
    observer?.onCompleted?.({ ...requestDiagnostic });
  };

  const permissionQuery = queryCameraPermission();
  void permissionQuery.then((permission) => {
    requestDiagnostic.permissionState = permission.state;
    if (permission.error) {
      requestDiagnostic.permissionQueryError = permission.error;
    } else {
      delete requestDiagnostic.permissionQueryError;
    }
    logCameraRequestDiagnostic("permission-query", requestDiagnostic);
    if (requestSettled) {
      publishCompleted();
    }
  });

  if (!getUserMediaAvailable) {
    requestDiagnostic.error = {
      name: "UnsupportedContext",
      message: "navigator.mediaDevices.getUserMedia is not available in this extension page."
    };
    requestSettled = true;
    publishCompleted();
    const diagnostic = createCameraDiagnostic("unsupported-context", {
      name: "UnsupportedContext",
      message: "navigator.mediaDevices.getUserMedia is not available in this extension page."
    }, requestDiagnostic);
    throw new CameraAccessError("unsupported-context", diagnostic);
  }

  requestDiagnostic.requestedAt = new Date().toISOString();
  observer?.onStarted?.({ ...requestDiagnostic });
  logCameraRequestDiagnostic("before-getUserMedia", requestDiagnostic);

  try {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    const videoTracks = stream.getVideoTracks();
    const videoTrack = videoTracks[0];
    requestDiagnostic.resolvedAt = new Date().toISOString();
    requestDiagnostic.streamReturned = true;
    requestDiagnostic.videoTrackCount = videoTracks.length;
    requestDiagnostic.videoTrackReadyState = videoTrack?.readyState ?? null;
    requestDiagnostic.videoTrackMuted = videoTrack?.muted ?? null;
    requestDiagnostic.videoTrackSettings = videoTrack?.getSettings();
    requestSettled = true;
    publishCompleted();
    logCameraRequestDiagnostic("stream-returned", requestDiagnostic);
    return stream;
  } catch (error) {
    requestDiagnostic.resolvedAt = new Date().toISOString();
    requestDiagnostic.error = {
      name: getErrorName(error) || "UnknownError",
      message: getErrorMessage(error) || "The browser rejected the camera request."
    };
    requestSettled = true;
    publishCompleted();
    logCameraRequestDiagnostic("getUserMedia-error", requestDiagnostic);
    const diagnostic = createCameraDiagnostic(classifyCameraError(error), error, requestDiagnostic);
    throw new CameraAccessError(diagnostic.code, diagnostic);
  }
}

export function createCameraDiagnostic(code: CameraErrorCode, error?: unknown, request?: CameraRequestDiagnostic): CameraDiagnostic {
  const mediaDevicesAvailable = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
  const getUserMediaAvailable = mediaDevicesAvailable && typeof navigator.mediaDevices.getUserMedia === "function";
  const name = getErrorName(error) || getDefaultErrorName(code);
  const message = getErrorMessage(error) || getDefaultErrorMessage(code);
  const constraint = getErrorConstraint(error);

  return {
    code,
    name,
    message,
    ...(constraint ? { constraint } : {}),
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    mediaDevicesAvailable,
    getUserMediaAvailable,
    ...(request ? { request } : {})
  };
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function isNamedError(error: unknown): error is { name: string } {
  return typeof error === "object" && error !== null && "name" in error && typeof error.name === "string";
}

function isMessagedError(error: unknown): error is { message: string } {
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string";
}

function isConstrainedError(error: unknown): error is { constraint: string } {
  return typeof error === "object" && error !== null && "constraint" in error && typeof error.constraint === "string";
}

function getErrorName(error: unknown): string {
  return isNamedError(error) ? error.name : "";
}

function getErrorMessage(error: unknown): string {
  return isMessagedError(error) ? error.message : "";
}

function getErrorConstraint(error: unknown): string | undefined {
  return isConstrainedError(error) && error.constraint ? error.constraint : undefined;
}

function createRequestDiagnostic(mediaDevicesAvailable: boolean, getUserMediaAvailable: boolean): CameraRequestDiagnostic {
  return {
    requestedAt: null,
    resolvedAt: null,
    visibilityState: typeof document !== "undefined" ? document.visibilityState : "unavailable",
    hasFocus: typeof document !== "undefined" ? document.hasFocus() : null,
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    mediaDevicesAvailable,
    getUserMediaAvailable,
    permissionState: "pending",
    constraints: CAMERA_CONSTRAINTS,
    streamReturned: false,
    videoTrackCount: null,
    videoTrackReadyState: null,
    videoTrackMuted: null
  };
}

export function queryCameraPermission(): Promise<CameraPermissionQueryResult> {
  if (typeof navigator === "undefined" || !navigator.permissions || typeof navigator.permissions.query !== "function") {
    return Promise.resolve({ state: "unsupported" });
  }

  try {
    return navigator.permissions.query({ name: "camera" as PermissionName }).then(
      (status) => ({ state: status.state }),
      (error) => ({
        state: "query-error",
        error: {
          name: getErrorName(error) || "PermissionQueryError",
          message: getErrorMessage(error) || "The camera permission state could not be queried."
        }
      })
    );
  } catch (error) {
    return Promise.resolve({
      state: "query-error",
      error: {
        name: getErrorName(error) || "PermissionQueryError",
        message: getErrorMessage(error) || "The camera permission state could not be queried."
      }
    });
  }
}

function logCameraRequestDiagnostic(event: string, diagnostic: CameraRequestDiagnostic): void {
  console.debug(`[EyeCare Buddy] camera diagnostic: ${event}`, diagnostic);
}

function getDefaultErrorName(code: CameraErrorCode): string {
  switch (code) {
    case "not-allowed": return "NotAllowedError";
    case "no-camera": return "NotFoundError";
    case "camera-busy": return "NotReadableError";
    case "constraints-unsatisfied": return "OverconstrainedError";
    case "aborted": return "AbortError";
    case "unsupported-context": return "UnsupportedContext";
    case "stream-ended": return "MediaStreamTrackEnded";
    case "runtime-error": return "UnknownError";
  }
}

function getDefaultErrorMessage(code: CameraErrorCode): string {
  switch (code) {
    case "not-allowed": return "The browser did not allow camera access; this can include a stored denial or a browser/OS policy block.";
    case "no-camera": return "No camera matched the requested video constraints.";
    case "camera-busy": return "The camera could not be read; it may be in use by another application or unavailable at the OS level.";
    case "constraints-unsatisfied": return "No camera could satisfy the requested video constraints.";
    case "aborted": return "The browser aborted the camera request.";
    case "unsupported-context": return "This extension page cannot access the camera API in its current context.";
    case "stream-ended": return "The camera stream ended before monitoring could continue.";
    case "runtime-error": return "The camera request failed with an unexpected runtime error.";
  }
}
