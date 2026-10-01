import type {
  DiagnosticError,
  FaceTrackerDiagnostic,
  FaceTrackerDiagnosticEvent,
  MonitoringDiagnosticEvent,
  MonitoringDiagnostics,
  VideoElementDiagnostic
} from "./types";

export function createInitialVideoElementDiagnostic(): VideoElementDiagnostic {
  return {
    elementExists: false,
    srcObjectAssigned: false,
    readyState: null,
    networkState: null,
    videoWidth: null,
    videoHeight: null,
    paused: null,
    ended: null,
    currentTime: null,
    loadedMetadataAt: null,
    canPlayAt: null,
    playingAt: null,
    firstFrameAvailableAt: null,
    firstFrameSource: null
  };
}

export function createInitialFaceTrackerDiagnostic(): FaceTrackerDiagnostic {
  return {
    workerCreatedAt: null,
    modelInitializationStartedAt: null,
    modelInitializationCompletedAt: null,
    modelInitializationError: null,
    workerMessageCount: 0,
    lastWorkerMessageType: null,
    lastWorkerMessageAt: null,
    workerErrorCount: 0,
    lastWorkerErrorAt: null,
    lastWorkerError: null,
    firstFrameSubmittedAt: null,
    frameSubmissionCount: 0,
    firstSuccessfulResultAt: null,
    successfulResultCount: 0,
    processingErrorAt: null,
    processingError: null,
    lastProcessingLatencyMs: null,
    timestampsMonotonic: null,
    lastSubmittedTimestampMs: null,
    lastResultTimestampMs: null,
    workerTerminatedAt: null,
    workerTerminationReason: null
  };
}

export function createInitialMonitoringDiagnostics(): MonitoringDiagnostics {
  return {
    cameraRequest: null,
    video: createInitialVideoElementDiagnostic(),
    tracker: createInitialFaceTrackerDiagnostic(),
    lifecycleEvents: []
  };
}

export function describeDiagnosticError(
  error: unknown,
  fallbackName: string,
  fallbackMessage: string
): DiagnosticError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { name?: unknown; message?: unknown };
    return {
      name: typeof candidate.name === "string" && candidate.name ? candidate.name : fallbackName,
      message: typeof candidate.message === "string" && candidate.message ? candidate.message : fallbackMessage
    };
  }

  return { name: fallbackName, message: fallbackMessage };
}

export function readVideoElementDiagnostic(
  video: HTMLVideoElement | null,
  previous: VideoElementDiagnostic
): VideoElementDiagnostic {
  if (!video) {
    return { ...previous, elementExists: false };
  }

  return {
    ...previous,
    elementExists: true,
    srcObjectAssigned: video.srcObject !== null,
    readyState: video.readyState,
    networkState: video.networkState,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    paused: video.paused,
    ended: video.ended,
    currentTime: video.currentTime
  };
}

type VideoDiagnosticEvent = "loadedmetadata" | "canplay" | "playing";

export function observeVideoElement(
  video: HTMLVideoElement,
  onEvent: (event: VideoDiagnosticEvent, at: number) => void,
  onFirstFrame: (at: number) => void
): () => void {
  const handlers: Array<[VideoDiagnosticEvent, EventListener]> = [
    ["loadedmetadata", () => onEvent("loadedmetadata", performance.now())],
    ["canplay", () => onEvent("canplay", performance.now())],
    ["playing", () => onEvent("playing", performance.now())]
  ];

  handlers.forEach(([event, handler]) => video.addEventListener(event, handler));

  const frameVideo = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
  };
  let frameCallbackHandle: number | null = null;
  if (typeof frameVideo.requestVideoFrameCallback === "function") {
    frameCallbackHandle = frameVideo.requestVideoFrameCallback(() => onFirstFrame(performance.now()));
  }

  return () => {
    handlers.forEach(([event, handler]) => video.removeEventListener(event, handler));
    if (frameCallbackHandle !== null && typeof frameVideo.cancelVideoFrameCallback === "function") {
      frameVideo.cancelVideoFrameCallback(frameCallbackHandle);
    }
  };
}

export function appendDiagnosticEvent(
  events: MonitoringDiagnosticEvent[],
  event: MonitoringDiagnosticEvent
): MonitoringDiagnosticEvent[] {
  return [...events, event].slice(-40);
}

export function applyFaceTrackerDiagnosticEvent(
  current: FaceTrackerDiagnostic,
  event: FaceTrackerDiagnosticEvent
): FaceTrackerDiagnostic {
  switch (event.type) {
    case "worker-created":
      return { ...current, workerCreatedAt: event.at };
    case "model-initialization-started":
      return { ...current, modelInitializationStartedAt: event.at };
    case "model-initialization-completed":
      return { ...current, modelInitializationCompletedAt: event.at };
    case "model-initialization-error":
      return { ...current, modelInitializationError: event.error };
    case "worker-message":
      return {
        ...current,
        workerMessageCount: current.workerMessageCount + 1,
        lastWorkerMessageType: event.messageType,
        lastWorkerMessageAt: event.at
      };
    case "worker-error":
      return {
        ...current,
        workerErrorCount: current.workerErrorCount + 1,
        lastWorkerErrorAt: event.at,
        lastWorkerError: event.error
      };
    case "frame-submitted":
      return {
        ...current,
        firstFrameSubmittedAt: current.firstFrameSubmittedAt ?? event.at,
        frameSubmissionCount: current.frameSubmissionCount + 1,
        timestampsMonotonic: current.timestampsMonotonic === false ? false : event.timestampsMonotonic,
        lastSubmittedTimestampMs: event.timestampMs
      };
    case "result-received":
      return {
        ...current,
        firstSuccessfulResultAt: current.firstSuccessfulResultAt ?? event.at,
        successfulResultCount: current.successfulResultCount + 1,
        lastProcessingLatencyMs: event.processingLatencyMs ?? current.lastProcessingLatencyMs,
        lastResultTimestampMs: event.timestampMs ?? current.lastResultTimestampMs
      };
    case "processing-error":
      return {
        ...current,
        processingErrorAt: event.at,
        processingError: event.error
      };
    case "worker-terminated":
      return {
        ...current,
        workerTerminatedAt: event.at,
        workerTerminationReason: event.reason
      };
  }
}
