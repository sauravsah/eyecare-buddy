import { useCallback, useEffect, useRef, useState } from "react";
import { CameraAccessError, cameraErrorToStatus, createCameraDiagnostic, queryCameraPermission, requestCameraStream, stopMediaStream, type CameraPermissionState } from "../../vision/camera";
import { appendDiagnosticEvent, applyFaceTrackerDiagnosticEvent, createInitialMonitoringDiagnostics, describeDiagnosticError, observeVideoElement, readVideoElementDiagnostic } from "../../vision/diagnostics";
import { FaceTracker } from "../../vision/FaceTracker";
import { createCameraState, createInitialMonitoringState } from "../../vision/tracking";
import type { CameraRequestDiagnostic, FaceTrackerDiagnosticEvent, MonitoringDiagnostics, MonitoringState, TrackingSnapshot, VideoElementDiagnostic } from "../../vision/types";
import { isCameraPermissionGrantedMessage, openCameraPermissionPage } from "../camera/permission-flow";

export interface CameraMonitorResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  state: MonitoringState;
  diagnostics: MonitoringDiagnostics;
  cameraPermissionState: CameraPermissionState | "unknown";
  enable: () => void;
  startWithStream: (stream: MediaStream) => void;
  stop: () => void;
  retry: () => void;
}

const UI_UPDATE_INTERVAL_MS = 200;

export function useCameraMonitor(): CameraMonitorResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<MonitoringState>(createInitialMonitoringState());
  const initialDiagnosticsRef = useRef(createInitialMonitoringDiagnostics());
  const [diagnostics, setDiagnostics] = useState<MonitoringDiagnostics>(initialDiagnosticsRef.current);
  const [cameraPermissionState, setCameraPermissionState] = useState<CameraPermissionState | "unknown">("unknown");
  const diagnosticsRef = useRef(initialDiagnosticsRef.current);
  const diagnosticsPublishedAtRef = useRef(0);
  const isMountedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sessionRef = useRef(0);
  const isStartingRef = useRef(false);
  const isRunningRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastUiUpdateRef = useRef(0);
  const lastStatusRef = useRef<MonitoringState["status"]>("camera-disabled");
  const permissionFlowInFlightRef = useRef(false);
  const videoDiagnosticsCleanupRef = useRef<(() => void) | null>(null);

  const updateDiagnostics = useCallback((update: (current: MonitoringDiagnostics) => MonitoringDiagnostics, immediate = true): void => {
    const next = update(diagnosticsRef.current);
    diagnosticsRef.current = next;
    const now = performance.now();
    if (isMountedRef.current && (immediate || now - diagnosticsPublishedAtRef.current >= UI_UPDATE_INTERVAL_MS)) {
      diagnosticsPublishedAtRef.current = now;
      setDiagnostics(next);
    }
  }, []);

  const resetDiagnostics = useCallback((): void => {
    const initial = createInitialMonitoringDiagnostics();
    diagnosticsRef.current = initial;
    diagnosticsPublishedAtRef.current = 0;
    if (isMountedRef.current) {
      setDiagnostics(initial);
    }
  }, []);

  const recordLifecycle = useCallback((event: string, detail?: string): void => {
    const at = performance.now();
    updateDiagnostics((current) => ({
      ...current,
      lifecycleEvents: appendDiagnosticEvent(current.lifecycleEvents, { at, event, ...(detail ? { detail } : {}) })
    }));
    console.debug("[EyeCare Buddy] monitoring lifecycle", { at, event, ...(detail ? { detail } : {}) });
  }, [updateDiagnostics]);

  const recordCameraRequest = useCallback((request: CameraRequestDiagnostic): void => {
    updateDiagnostics((current) => ({ ...current, cameraRequest: request }));
  }, [updateDiagnostics]);

  const updateVideoDiagnostic = useCallback((video: HTMLVideoElement | null, patch: Partial<VideoElementDiagnostic> = {}): void => {
    updateDiagnostics((current) => ({
      ...current,
      video: { ...readVideoElementDiagnostic(video, current.video), ...patch }
    }));
  }, [updateDiagnostics]);

  const markVideoFrameAvailable = useCallback((video: HTMLVideoElement, source: "video-frame-callback" | "image-bitmap", at = performance.now()): void => {
    const isFirstFrame = diagnosticsRef.current.video.firstFrameAvailableAt === null;
    if (!isFirstFrame) {
      return;
    }

    updateDiagnostics((current) => ({
      ...current,
      video: {
        ...readVideoElementDiagnostic(video, current.video),
        firstFrameAvailableAt: at,
        firstFrameSource: source
      }
    }));
    recordLifecycle("video-first-frame-available", `source=${source}`);
  }, [recordLifecycle, updateDiagnostics]);

  const recordTrackerDiagnostic = useCallback((event: FaceTrackerDiagnosticEvent): void => {
    updateDiagnostics((current) => ({
      ...current,
      tracker: applyFaceTrackerDiagnosticEvent(current.tracker, event)
    }), event.type !== "frame-submitted" && event.type !== "result-received");

    if (event.type === "worker-error" || event.type === "model-initialization-error" || event.type === "processing-error") {
      recordLifecycle(`face-tracker-${event.type}`, `${event.error.name}: ${event.error.message}`);
    } else if (event.type === "worker-created" || event.type === "model-initialization-started" || event.type === "model-initialization-completed" || event.type === "worker-terminated") {
      recordLifecycle(`face-tracker-${event.type}`, event.type === "worker-terminated" ? `reason=${event.reason}` : undefined);
    }
  }, [recordLifecycle, updateDiagnostics]);

  const stopResources = useCallback((reason = "cleanup"): void => {
    const hadStream = streamRef.current !== null;
    const hadTracker = trackerRef.current !== null;
    recordLifecycle(
      "cleanup-started",
      `reason=${reason}; starting=${isStartingRef.current}; running=${isRunningRef.current}; stream=${hadStream}; tracker=${hadTracker}`
    );
    sessionRef.current += 1;
    isStartingRef.current = false;
    isRunningRef.current = false;
    captureInFlightRef.current = false;
    lastVideoTimeRef.current = -1;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    trackerRef.current?.stop(reason);
    trackerRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      updateVideoDiagnostic(video);
      videoDiagnosticsCleanupRef.current?.();
      videoDiagnosticsCleanupRef.current = null;
      video.pause();
      video.srcObject = null;
      updateVideoDiagnostic(video);
    }
    recordLifecycle("cleanup-completed", `reason=${reason}`);
  }, [recordLifecycle, updateVideoDiagnostic]);

  const applySnapshot = useCallback(
    (snapshot: TrackingSnapshot) => {
      if (snapshot.status === "tracking-error") {
        recordLifecycle(
          "tracking-error-snapshot",
          `${snapshot.errorCode ?? "unknown"}${snapshot.diagnosticError ? `; ${snapshot.diagnosticError.name}: ${snapshot.diagnosticError.message}` : ""}`
        );
        stopResources("tracking-error-snapshot");
        setState({ ...snapshot, isMonitoring: false });
        return;
      }

      const now = performance.now();
      const isStatusChange = snapshot.status !== lastStatusRef.current;
      if (isStatusChange || now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastStatusRef.current = snapshot.status;
        lastUiUpdateRef.current = now;
        setState({ ...snapshot, isMonitoring: isRunningRef.current });
      }
    },
    [recordLifecycle, stopResources]
  );

  const captureFrame = useCallback(async (sessionId: number): Promise<void> => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (
      !video ||
      !tracker ||
      !isRunningRef.current ||
      sessionRef.current !== sessionId ||
      captureInFlightRef.current ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.currentTime === lastVideoTimeRef.current
    ) {
      return;
    }

    lastVideoTimeRef.current = video.currentTime;
    captureInFlightRef.current = true;
    try {
      const frame = await createImageBitmap(video);
      if (!isRunningRef.current || sessionRef.current !== sessionId) {
        frame.close();
        return;
      }
      tracker.processFrame(frame, performance.now());
      markVideoFrameAvailable(video, "image-bitmap");
    } catch (error: unknown) {
      const diagnostic = describeDiagnosticError(error, "FrameCaptureError", "The current camera frame could not be read.");
      recordLifecycle("video-frame-capture-error", `${diagnostic.name}: ${diagnostic.message}`);
      if (sessionRef.current === sessionId && isRunningRef.current) {
        applySnapshot({
          status: "tracking-error",
          facePresent: false,
          faceCount: 0,
          relativeFaceScale: null,
          headOrientation: { yaw: null, pitch: null, roll: null },
          blink: { state: "unavailable", observedBlinkCount: 0 },
          quality: "unavailable",
          errorCode: "processing-failed",
          diagnosticError: diagnostic
        });
      }
    } finally {
      captureInFlightRef.current = false;
    }
  }, [applySnapshot, markVideoFrameAvailable, recordLifecycle]);

  const startMonitoring = useCallback(async (providedStream?: MediaStream): Promise<void> => {
    if (isStartingRef.current || isRunningRef.current || !videoRef.current) {
      recordLifecycle("start-monitoring-ignored", `starting=${isStartingRef.current}; running=${isRunningRef.current}; video=${Boolean(videoRef.current)}`);
      if (providedStream) {
        stopMediaStream(providedStream);
      }
      return;
    }

    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    recordLifecycle("start-monitoring-requested", `session=${sessionId}; providedStream=${Boolean(providedStream)}`);
    const pendingStream = providedStream ? null : requestCameraStream({
      onStarted: recordCameraRequest,
      onCompleted: recordCameraRequest
    });
    isStartingRef.current = true;
    lastStatusRef.current = "camera-loading";
    setState(createCameraState("camera-loading", false));

    let stream: MediaStream | null = providedStream ?? null;
    try {
      if (!stream) {
        stream = await pendingStream!;
      }
      recordLifecycle("camera-stream-resolved", `session=${sessionId}; tracks=${stream.getTracks().length}`);
      if (sessionRef.current !== sessionId) {
        recordLifecycle("camera-stream-discarded", `session=${sessionId}; activeSession=${sessionRef.current}`);
        stopMediaStream(stream);
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      recordLifecycle("video-element-checked", `session=${sessionId}; exists=${Boolean(video)}`);
      if (!video) {
        throw new CameraAccessError("runtime-error", createCameraDiagnostic("runtime-error", {
          name: "VideoElementUnavailable",
          message: "The Live Monitor video element was unavailable after the camera stream resolved."
        }));
      }
      videoDiagnosticsCleanupRef.current?.();
      videoDiagnosticsCleanupRef.current = observeVideoElement(
        video,
        (event, at) => {
          const eventPatch: Partial<VideoElementDiagnostic> = event === "loadedmetadata"
            ? { loadedMetadataAt: at }
            : event === "canplay"
              ? { canPlayAt: at }
              : { playingAt: at };
          updateVideoDiagnostic(video, eventPatch);
          recordLifecycle(`video-${event}`);
        },
        (at) => markVideoFrameAvailable(video, "video-frame-callback", at)
      );
      recordLifecycle("video-src-object-assignment-started", `session=${sessionId}`);
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      updateVideoDiagnostic(video);
      recordLifecycle("video-src-object-assigned", `session=${sessionId}; readyState=${video.readyState}`);
      recordLifecycle("video-play-started", `session=${sessionId}`);
      await video.play();
      updateVideoDiagnostic(video);
      recordLifecycle("video-play-resolved", `session=${sessionId}; readyState=${video.readyState}; dimensions=${video.videoWidth}x${video.videoHeight}`);
      if (sessionRef.current !== sessionId) {
        recordLifecycle("video-play-discarded", `session=${sessionId}; activeSession=${sessionRef.current}`);
        return;
      }

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (sessionRef.current !== sessionId || !isRunningRef.current) {
            return;
          }
          recordLifecycle("video-track-ended", `session=${sessionId}; readyState=${track.readyState}; muted=${track.muted}`);
          stopResources("video-track-ended");
          setState({ ...createCameraState("camera-unavailable", false), errorCode: "stream-ended" });
        }, { once: true });
      });

      setState(createCameraState("model-loading", true));
      recordLifecycle("face-tracker-start-requested", `session=${sessionId}`);
      const tracker = new FaceTracker({ onSnapshot: applySnapshot, onDiagnostics: recordTrackerDiagnostic });
      trackerRef.current = tracker;
      await tracker.start();
      if (sessionRef.current !== sessionId) {
        recordLifecycle("face-tracker-ready-discarded", `session=${sessionId}; activeSession=${sessionRef.current}`);
        return;
      }

      isStartingRef.current = false;
      isRunningRef.current = true;
      lastStatusRef.current = "camera-active";
      setState(createCameraState("camera-active", true));
      recordLifecycle("monitoring-active", `session=${sessionId}`);
      const loop = (): void => {
        if (!isRunningRef.current || sessionRef.current !== sessionId) {
          return;
        }
        void captureFrame(sessionId);
        animationFrameRef.current = requestAnimationFrame(loop);
      };
      animationFrameRef.current = requestAnimationFrame(loop);
    } catch (error) {
      if (sessionRef.current !== sessionId) {
        recordLifecycle("start-monitoring-aborted", `session=${sessionId}; activeSession=${sessionRef.current}`);
        stopMediaStream(stream);
        return;
      }

      const diagnostic = describeDiagnosticError(error, "MonitoringStartError", "Monitoring could not be started.");
      recordLifecycle("start-monitoring-error", `${diagnostic.name}: ${diagnostic.message}`);
      stopResources("start-monitoring-error");
      if (error instanceof CameraAccessError) {
        const status = cameraErrorToStatus(error.code);
        setState({ ...createCameraState(status, false), errorCode: error.code, cameraDiagnostic: error.diagnostic });
      } else {
        setState({
          ...createCameraState("tracking-error", false),
          errorCode: "model-load-failed"
        });
      }
    }
  }, [applySnapshot, captureFrame, markVideoFrameAvailable, recordCameraRequest, recordLifecycle, recordTrackerDiagnostic, stopResources, updateVideoDiagnostic]);

  const requestPermissionAndStart = useCallback((): void => {
    if (permissionFlowInFlightRef.current) {
      recordLifecycle("permission-flow-ignored", "permission request already in flight");
      return;
    }

    permissionFlowInFlightRef.current = true;
    recordLifecycle("permission-query-started");
    void queryCameraPermission().then(async (permission) => {
      setCameraPermissionState(permission.state);
      recordLifecycle("permission-query-completed", `state=${permission.state}`);

      if (permission.state === "granted") {
        recordLifecycle("permission-granted-starting-monitoring");
        await startMonitoring();
        return;
      }

      if (permission.state === "prompt") {
        recordLifecycle("permission-prompt-opening-tab");
        lastStatusRef.current = "camera-permission-setup";
        setState(createCameraState("camera-permission-setup", false));
        try {
          await openCameraPermissionPage();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Chrome could not open the camera permission page.";
          recordLifecycle("permission-tab-open-error", message);
          setState({
            ...createCameraState("camera-unavailable", false),
            errorCode: "runtime-error",
            cameraDiagnostic: createCameraDiagnostic("runtime-error", {
              name: "CameraPermissionPageError",
              message
            })
          });
        }
        return;
      }

      if (permission.state === "denied") {
        recordLifecycle("permission-denied-state");
        lastStatusRef.current = "camera-permission-denied";
        setState({
          ...createCameraState("camera-permission-denied", false),
          errorCode: "not-allowed",
          cameraDiagnostic: createCameraDiagnostic("not-allowed", {
            name: "PermissionStateDenied",
            message: "Chrome reports that camera permission is denied for this extension. Review Chrome camera settings before trying again."
          })
        });
        return;
      }

      setState({
        ...createCameraState("camera-unavailable", false),
        errorCode: "unsupported-context",
        cameraDiagnostic: createCameraDiagnostic("unsupported-context", {
          name: permission.state === "unsupported" ? "PermissionQueryUnsupported" : "PermissionQueryError",
          message: permission.error?.message ?? "Chrome did not provide a usable camera permission state."
        })
      });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "The camera permission state could not be checked.";
      recordLifecycle("permission-query-error", message);
      setState({
        ...createCameraState("camera-unavailable", false),
        errorCode: "runtime-error",
        cameraDiagnostic: createCameraDiagnostic("runtime-error", {
          name: "PermissionQueryError",
          message
        })
      });
    }).finally(() => {
      permissionFlowInFlightRef.current = false;
      recordLifecycle("permission-flow-finished");
    });
  }, [recordLifecycle, startMonitoring]);

  const enable = useCallback((): void => {
    resetDiagnostics();
    recordLifecycle("enable-click");
    if (!videoRef.current) {
      lastStatusRef.current = "camera-loading";
      setState(createCameraState("camera-loading", false));
      return;
    }
    requestPermissionAndStart();
  }, [recordLifecycle, requestPermissionAndStart, resetDiagnostics]);

  const startWithStream = useCallback((stream: MediaStream): void => {
    void startMonitoring(stream);
  }, [startMonitoring]);

  const stop = useCallback((): void => {
    recordLifecycle("stop-click");
    stopResources("user-stop");
    lastStatusRef.current = "camera-stopped";
    setState(createCameraState("camera-stopped", false));
  }, [recordLifecycle, stopResources]);

  const retry = useCallback((): void => {
    resetDiagnostics();
    recordLifecycle("retry-click");
    stopResources("retry-before-start");
    requestPermissionAndStart();
  }, [recordLifecycle, requestPermissionAndStart, resetDiagnostics, stopResources]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return;
    }

    const handleMessage = (message: unknown): void => {
      if (!isCameraPermissionGrantedMessage(message)) {
        return;
      }

      setCameraPermissionState("granted");
      if (!isRunningRef.current && !isStartingRef.current) {
        lastStatusRef.current = "camera-disabled";
        setState(createCameraState("camera-disabled", false));
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    recordLifecycle("monitoring-hook-mounted");
    return () => {
      recordLifecycle("react-effect-cleanup");
      isMountedRef.current = false;
      stopResources("react-effect-cleanup");
    };
  }, [recordLifecycle, stopResources]);

  return { videoRef, canvasRef, state, diagnostics, cameraPermissionState, enable, startWithStream, stop, retry };
}
