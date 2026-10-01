import type { DiagnosticError, FaceTrackerDiagnosticEvent, TrackingSnapshot } from "./types";

export interface FaceTrackerOptions {
  onSnapshot: (snapshot: TrackingSnapshot) => void;
  onDiagnostics?: (event: FaceTrackerDiagnosticEvent) => void;
}

type WorkerResponse =
  | { type: "ready" }
  | { type: "result"; snapshot: TrackingSnapshot }
  | {
      type: "error";
      errorCode: "model-load-failed" | "processing-failed";
      error?: DiagnosticError;
    };

/** Owns one local Face Landmarker worker and one in-flight frame at a time. */
export class FaceTracker {
  private worker: Worker | null = null;
  private startupPromise: Promise<void> | null = null;
  private resolveStartup: (() => void) | null = null;
  private rejectStartup: ((error: Error) => void) | null = null;
  private isReady = false;
  private isStopped = false;
  private frameInFlight = false;
  private frameTimestamps: number[] = [];
  private lastSubmittedTimestampMs: number | null = null;

  constructor(private readonly options: FaceTrackerOptions) {}

  start(): Promise<void> {
    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.isStopped = false;
    try {
      this.worker = new Worker(
        new URL("./face-landmarker.worker.ts", import.meta.url),
        { type: "module" }
      );
    } catch (error) {
      const diagnostic = describeError(error, "WorkerCreationError", "The local vision worker could not be created.");
      this.options.onDiagnostics?.({ type: "worker-error", at: performance.now(), error: diagnostic });
      throw new Error(diagnostic.message);
    }
    this.options.onDiagnostics?.({ type: "worker-created", at: performance.now() });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const messageType = event.data?.type;
      if (messageType === "ready" || messageType === "result" || messageType === "error") {
        this.options.onDiagnostics?.({ type: "worker-message", at: performance.now(), messageType });
      }
      this.handleWorkerMessage(event.data);
    };
    this.worker.onerror = (event: ErrorEvent) => {
      const diagnostic = describeError(
        { name: "WorkerError", message: event.message || "The local vision worker stopped unexpectedly." },
        "WorkerError",
        "The local vision worker stopped unexpectedly."
      );
      this.options.onDiagnostics?.({ type: "worker-error", at: performance.now(), error: diagnostic });
      this.failStartup(new Error(diagnostic.message));
      this.options.onSnapshot({
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
    };

    this.startupPromise = new Promise<void>((resolve, reject) => {
      this.resolveStartup = resolve;
      this.rejectStartup = reject;
    });
    this.options.onDiagnostics?.({ type: "model-initialization-started", at: performance.now() });
    try {
      this.worker.postMessage({ type: "initialize" });
    } catch (error) {
      const diagnostic = describeError(error, "WorkerInitializationError", "The local vision worker could not be initialized.");
      this.options.onDiagnostics?.({ type: "model-initialization-error", at: performance.now(), error: diagnostic });
      this.failStartup(new Error(diagnostic.message));
    }
    return this.startupPromise;
  }

  processFrame(frame: ImageBitmap, timestampMs: number): void {
    if (!this.worker || !this.isReady || this.isStopped || this.frameInFlight) {
      frame.close();
      return;
    }

    this.frameInFlight = true;
    const previousTimestamp = this.lastSubmittedTimestampMs;
    const timestampsMonotonic = previousTimestamp === null || timestampMs > previousTimestamp;
    this.lastSubmittedTimestampMs = timestampMs;
    this.options.onDiagnostics?.({
      type: "frame-submitted",
      at: performance.now(),
      timestampMs,
      timestampsMonotonic
    });
    try {
      this.worker.postMessage({ type: "frame", frame, timestampMs }, [frame]);
    } catch (error) {
      this.frameInFlight = false;
      frame.close();
      const diagnostic = describeError(error, "FrameSubmissionError", "The local vision frame could not be submitted to the worker.");
      this.options.onDiagnostics?.({ type: "processing-error", at: performance.now(), error: diagnostic });
      this.options.onSnapshot({
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
  }

  stop(reason = "requested"): void {
    const hadWorker = this.worker !== null;
    this.isStopped = true;
    this.isReady = false;
    this.frameInFlight = false;
    this.frameTimestamps = [];
    this.lastSubmittedTimestampMs = null;
    this.worker?.postMessage({ type: "dispose" });
    this.worker?.terminate();
    if (hadWorker) {
      this.options.onDiagnostics?.({ type: "worker-terminated", at: performance.now(), reason });
    }
    this.worker = null;
    this.failStartup(new Error("The local vision tracker was stopped."));
    this.startupPromise = null;
  }

  private handleWorkerMessage(response: WorkerResponse): void {
    if (this.isStopped) {
      return;
    }

    if (response.type === "ready") {
      this.isReady = true;
      this.options.onDiagnostics?.({ type: "model-initialization-completed", at: performance.now() });
      this.resolveStartup?.();
      this.resolveStartup = null;
      this.rejectStartup = null;
      return;
    }

    if (response.type === "error") {
      this.frameInFlight = false;
      const diagnostic = response.error ?? {
        name: response.errorCode === "model-load-failed" ? "ModelInitializationError" : "ProcessingError",
        message: response.errorCode === "model-load-failed"
          ? "The local vision model could not be loaded."
          : "The local vision model could not process this frame."
      };
      const error = new Error(
        diagnostic.message
      );
      if (response.errorCode === "model-load-failed") {
        this.options.onDiagnostics?.({ type: "model-initialization-error", at: performance.now(), error: diagnostic });
      } else {
        this.options.onDiagnostics?.({ type: "processing-error", at: performance.now(), error: diagnostic });
      }
      this.failStartup(error);
      this.options.onSnapshot({
        status: "tracking-error",
        facePresent: false,
        faceCount: 0,
        relativeFaceScale: null,
        headOrientation: { yaw: null, pitch: null, roll: null },
        blink: { state: "unavailable", observedBlinkCount: 0 },
        quality: "unavailable",
        errorCode: response.errorCode,
        diagnosticError: diagnostic
      });
      return;
    }

    this.frameInFlight = false;
    const timestampMs = response.snapshot.timestampMs;
    this.options.onDiagnostics?.({
      type: "result-received",
      at: performance.now(),
      ...(timestampMs === undefined ? {} : { timestampMs }),
      ...(response.snapshot.inferenceTimeMs === undefined ? {} : { processingLatencyMs: response.snapshot.inferenceTimeMs })
    });
    if (timestampMs !== undefined) {
      this.frameTimestamps.push(timestampMs);
      const cutoff = timestampMs - 1000;
      this.frameTimestamps = this.frameTimestamps.filter((time) => time >= cutoff);
    }
    this.options.onSnapshot({
      ...response.snapshot,
      fps: this.frameTimestamps.length
    });
  }

  private failStartup(error: Error): void {
    this.rejectStartup?.(error);
    this.resolveStartup = null;
    this.rejectStartup = null;
  }
}

function describeError(error: unknown, fallbackName: string, fallbackMessage: string): DiagnosticError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { name?: unknown; message?: unknown };
    return {
      name: typeof candidate.name === "string" && candidate.name ? candidate.name : fallbackName,
      message: typeof candidate.message === "string" && candidate.message ? candidate.message : fallbackMessage
    };
  }

  return { name: fallbackName, message: fallbackMessage };
}
