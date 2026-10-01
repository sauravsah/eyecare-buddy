import { createProductSignalSnapshot } from "./signals";
import type {
  BlinkSignal,
  BlinkState,
  HeadOrientation,
  InstantSignalValues,
  ProductSignalSnapshot
} from "./types";

const SMOOTHING_ALPHA = 0.3;
const SMOOTHING_RESET_GAP_MS = 1000;
const BLINK_CLOSED_THRESHOLD = 0.12;
const BLINK_OPEN_THRESHOLD = 0.2;
const BLINK_MIN_CLOSURE_MS = 60;
const BLINK_MAX_CLOSURE_MS = 800;
const BLINK_MIN_CLOSED_SAMPLES = 2;
const BLINK_REFRACTORY_MS = 300;
const BLINK_MAX_OBSERVATION_GAP_MS = 500;

type BlinkPhase = Exclude<BlinkState, "unavailable">;

/**
 * Keeps only scalar signal history for one local monitoring session. Raw
 * landmarks never enter this class and are not retained between frames.
 */
export class TemporalSignalProcessor {
  private lastTimestampMs: number | null = null;
  private smoothedRelativeFaceScale: number | null = null;
  private smoothedOrientation: HeadOrientation = createEmptyHeadOrientation();

  private blinkPhase: BlinkPhase = "open";
  private blinkClosureStartedAt: number | null = null;
  private blinkClosedSamples = 0;
  private lastValidEyeTimestampMs: number | null = null;
  private lastBlinkTimestampMs: number | null = null;
  private observedBlinkCount = 0;

  process(signals: InstantSignalValues, timestampMs: number): ProductSignalSnapshot {
    if (!Number.isFinite(timestampMs)) {
      return createProductSignalSnapshot(signals, this.createBlinkSignal("unavailable"));
    }

    if (this.lastTimestampMs !== null && timestampMs <= this.lastTimestampMs) {
      return createProductSignalSnapshot(this.currentSmoothedValues(signals), this.createBlinkSignal(this.currentBlinkState()));
    }

    if (
      this.lastTimestampMs !== null &&
      timestampMs - this.lastTimestampMs > SMOOTHING_RESET_GAP_MS
    ) {
      this.smoothedRelativeFaceScale = null;
      this.smoothedOrientation = createEmptyHeadOrientation();
    }
    this.lastTimestampMs = timestampMs;

    const blink = this.updateBlink(signals, timestampMs);
    return createProductSignalSnapshot(this.withSmoothedValues(signals), blink);
  }

  reset(): void {
    this.lastTimestampMs = null;
    this.smoothedRelativeFaceScale = null;
    this.smoothedOrientation = createEmptyHeadOrientation();
    this.blinkPhase = "open";
    this.blinkClosureStartedAt = null;
    this.blinkClosedSamples = 0;
    this.lastValidEyeTimestampMs = null;
    this.lastBlinkTimestampMs = null;
    this.observedBlinkCount = 0;
  }

  private withSmoothedValues(signals: InstantSignalValues): InstantSignalValues {
    this.smoothedRelativeFaceScale = smoothNumber(
      this.smoothedRelativeFaceScale,
      signals.relativeFaceScale
    );
    this.smoothedOrientation = {
      yaw: smoothNumber(this.smoothedOrientation.yaw, signals.headOrientation.yaw),
      pitch: smoothNumber(this.smoothedOrientation.pitch, signals.headOrientation.pitch),
      roll: smoothNumber(this.smoothedOrientation.roll, signals.headOrientation.roll)
    };

    return this.currentSmoothedValues(signals);
  }

  private currentSmoothedValues(signals: InstantSignalValues): InstantSignalValues {
    return {
      ...signals,
      relativeFaceScale: this.smoothedRelativeFaceScale ?? signals.relativeFaceScale,
      headOrientation: {
        yaw: this.smoothedOrientation.yaw ?? signals.headOrientation.yaw,
        pitch: this.smoothedOrientation.pitch ?? signals.headOrientation.pitch,
        roll: this.smoothedOrientation.roll ?? signals.headOrientation.roll
      }
    };
  }

  private updateBlink(signals: InstantSignalValues, timestampMs: number): BlinkSignal {
    const eyeOpenness = signals.facePresent && signals.faceCount === 1
      ? signals.eyeOpenness
      : null;

    if (eyeOpenness === null) {
      if (
        this.lastValidEyeTimestampMs !== null &&
        timestampMs - this.lastValidEyeTimestampMs > BLINK_MAX_OBSERVATION_GAP_MS
      ) {
        this.resetBlinkPhase();
        this.lastValidEyeTimestampMs = null;
      }
      return this.createBlinkSignal("unavailable");
    }

    if (
      this.lastValidEyeTimestampMs !== null &&
      timestampMs - this.lastValidEyeTimestampMs > BLINK_MAX_OBSERVATION_GAP_MS
    ) {
      this.resetBlinkPhase();
      this.lastValidEyeTimestampMs = null;
    }
    this.lastValidEyeTimestampMs = timestampMs;

    if (eyeOpenness <= BLINK_CLOSED_THRESHOLD) {
      if (this.blinkPhase === "open") {
        this.blinkPhase = "closing";
        this.blinkClosureStartedAt = timestampMs;
        this.blinkClosedSamples = 1;
      } else {
        this.blinkClosedSamples += 1;
      }

      if (
        this.blinkPhase === "closing" &&
        this.blinkClosedSamples >= BLINK_MIN_CLOSED_SAMPLES &&
        this.blinkClosureStartedAt !== null &&
        timestampMs - this.blinkClosureStartedAt >= BLINK_MIN_CLOSURE_MS
      ) {
        this.blinkPhase = "closed";
      }
      return this.createBlinkSignal(this.blinkPhase);
    }

    if (eyeOpenness >= BLINK_OPEN_THRESHOLD) {
      if (this.blinkPhase === "closed" && this.blinkClosureStartedAt !== null) {
        const closureDurationMs = timestampMs - this.blinkClosureStartedAt;
        const outsideRefractoryPeriod =
          this.lastBlinkTimestampMs === null ||
          timestampMs - this.lastBlinkTimestampMs >= BLINK_REFRACTORY_MS;
        if (
          closureDurationMs >= BLINK_MIN_CLOSURE_MS &&
          closureDurationMs <= BLINK_MAX_CLOSURE_MS &&
          outsideRefractoryPeriod
        ) {
          this.observedBlinkCount += 1;
          this.lastBlinkTimestampMs = timestampMs;
        }
      }
      this.resetBlinkPhase();
      return this.createBlinkSignal("open");
    }

    return this.createBlinkSignal(this.blinkPhase);
  }

  private resetBlinkPhase(): void {
    this.blinkPhase = "open";
    this.blinkClosureStartedAt = null;
    this.blinkClosedSamples = 0;
  }

  private currentBlinkState(): BlinkState {
    return this.lastValidEyeTimestampMs === null ? "unavailable" : this.blinkPhase;
  }

  private createBlinkSignal(state: BlinkState): BlinkSignal {
    return { state, observedBlinkCount: this.observedBlinkCount };
  }
}

function smoothNumber(previous: number | null, current: number | null): number | null {
  if (current === null) {
    return null;
  }
  if (previous === null) {
    return current;
  }
  return previous + (current - previous) * SMOOTHING_ALPHA;
}

function createEmptyHeadOrientation(): HeadOrientation {
  return { yaw: null, pitch: null, roll: null };
}
