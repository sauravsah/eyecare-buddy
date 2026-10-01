import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { FACE_LANDMARKER_OPTIONS, VISION_WASM_PATH } from "./model";
import { deriveTrackingSnapshot } from "./tracking";
import { TemporalSignalProcessor } from "./temporal";
import type { DiagnosticError, FaceLandmarkPoint, LandmarkFrame, TrackingSnapshot } from "./types";

type WorkerRequest =
  | { type: "initialize" }
  | { type: "frame"; frame: ImageBitmap; timestampMs: number }
  | { type: "dispose" };

type WorkerResponse =
  | { type: "ready" }
  | { type: "result"; snapshot: TrackingSnapshot }
  | {
      type: "error";
      errorCode: "model-load-failed" | "processing-failed";
      error: DiagnosticError;
    };

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

let faceLandmarker: FaceLandmarker | null = null;
let temporalSignalProcessor: TemporalSignalProcessor | null = null;
let disposed = false;

async function initialize(): Promise<void> {
  try {
    disposed = false;
    // Vite constructs this file as an ES-module worker. Tasks Vision's module
    // loader publishes ModuleFactory on globalThis, which is required by the
    // package's worker-side runtime initialization path.
    const vision = await FilesetResolver.forVisionTasks(VISION_WASM_PATH, true);
    if (disposed) {
      return;
    }

    faceLandmarker = await FaceLandmarker.createFromOptions(
      vision,
      FACE_LANDMARKER_OPTIONS
    );
    if (!disposed) {
      temporalSignalProcessor = new TemporalSignalProcessor();
      workerScope.postMessage({ type: "ready" });
    }
  } catch (error) {
    faceLandmarker = null;
    temporalSignalProcessor = null;
    if (!disposed) {
      workerScope.postMessage({
        type: "error",
        errorCode: "model-load-failed",
        error: describeError(error, "ModelInitializationError", "The local vision model could not be loaded.")
      });
    }
  }
}

function processFrame(frame: ImageBitmap, timestampMs: number): void {
  if (disposed || !faceLandmarker) {
    frame.close();
    return;
  }

  try {
    const startedAt = performance.now();
    const result = faceLandmarker.detectForVideo(frame, timestampMs);
    const inferenceTimeMs = performance.now() - startedAt;
    const landmarkFrame: LandmarkFrame = {
      faces: serializeFaces(result),
      timestampMs,
      inferenceTimeMs
    };
    workerScope.postMessage({
      type: "result",
      snapshot: deriveTrackingSnapshot(landmarkFrame, temporalSignalProcessor ?? undefined)
    });
  } catch (error) {
    if (!disposed) {
      workerScope.postMessage({
        type: "error",
        errorCode: "processing-failed",
        error: describeError(error, "ProcessingError", "The local vision model could not process this frame.")
      });
    }
  } finally {
    frame.close();
  }
}

function serializeFaces(result: FaceLandmarkerResult): FaceLandmarkPoint[][] {
  return result.faceLandmarks.map((face) =>
    face.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z
    }))
  );
}

workerScope.onmessage = (event) => {
  switch (event.data.type) {
    case "initialize":
      void initialize();
      break;
    case "frame":
      processFrame(event.data.frame, event.data.timestampMs);
      break;
    case "dispose":
      disposed = true;
      faceLandmarker?.close();
      faceLandmarker = null;
      temporalSignalProcessor = null;
      break;
  }
};

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
