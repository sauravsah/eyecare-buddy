import { describe, expect, it } from "vitest";
import { TemporalSignalProcessor } from "./temporal";
import type { HeadOrientation, InstantSignalValues } from "./types";

const neutralOrientation: HeadOrientation = { yaw: 0, pitch: 0, roll: 0 };

function signals(eyeOpenness: number | null, overrides: Partial<InstantSignalValues> = {}): InstantSignalValues {
  return {
    facePresent: true,
    faceCount: 1,
    relativeFaceScale: 0.3,
    headOrientation: neutralOrientation,
    eyeOpenness,
    ...overrides
  };
}

describe("TemporalSignalProcessor", () => {
  it("does not count a single closed-eye frame as a blink", () => {
    const processor = new TemporalSignalProcessor();

    processor.process(signals(0.28), 0);
    processor.process(signals(0.08), 100);
    const reopened = processor.process(signals(0.28), 200);

    expect(reopened.blink.state).toBe("open");
    expect(reopened.blink.observedBlinkCount).toBe(0);
  });

  it("counts a blink only after closure and confirmed reopening", () => {
    const processor = new TemporalSignalProcessor();

    processor.process(signals(0.28), 0);
    expect(processor.process(signals(0.08), 100).blink.state).toBe("closing");
    expect(processor.process(signals(0.08), 200).blink.state).toBe("closed");
    const reopened = processor.process(signals(0.28), 280);

    expect(reopened.blink.state).toBe("open");
    expect(reopened.blink.observedBlinkCount).toBe(1);
  });

  it("rejects closures that exceed the maximum blink duration", () => {
    const processor = new TemporalSignalProcessor();

    processor.process(signals(0.28), 0);
    processor.process(signals(0.08), 100);
    processor.process(signals(0.08), 200);
    const reopened = processor.process(signals(0.28), 1000);

    expect(reopened.blink.observedBlinkCount).toBe(0);
  });

  it("uses a refractory period between observed blinks", () => {
    const processor = new TemporalSignalProcessor();

    processor.process(signals(0.28), 0);
    processor.process(signals(0.08), 100);
    processor.process(signals(0.08), 200);
    expect(processor.process(signals(0.28), 280).blink.observedBlinkCount).toBe(1);

    processor.process(signals(0.08), 400);
    processor.process(signals(0.08), 500);
    const reopened = processor.process(signals(0.28), 550);

    expect(reopened.blink.observedBlinkCount).toBe(1);
  });

  it("marks eye signals unavailable and resets an interrupted closure", () => {
    const processor = new TemporalSignalProcessor();

    processor.process(signals(0.28), 0);
    processor.process(signals(0.08), 100);
    processor.process(signals(0.08), 200);
    expect(processor.process(signals(null, { facePresent: false, faceCount: 0 }), 300).blink.state).toBe("unavailable");
    const resumed = processor.process(signals(0.28), 900);

    expect(resumed.blink.state).toBe("open");
    expect(resumed.blink.observedBlinkCount).toBe(0);
  });

  it("smooths numeric signals while preserving face state", () => {
    const processor = new TemporalSignalProcessor();

    const first = processor.process(signals(0.28, {
      relativeFaceScale: 0.2,
      headOrientation: { yaw: 0, pitch: 0, roll: 0 }
    }), 0);
    const second = processor.process(signals(0.28, {
      relativeFaceScale: 0.4,
      headOrientation: { yaw: 30, pitch: -15, roll: 10 }
    }), 100);

    expect(first.relativeFaceScale).toBeCloseTo(0.2, 6);
    expect(second.relativeFaceScale).toBeCloseTo(0.26, 6);
    expect(second.headOrientation.yaw).toBeCloseTo(9, 6);
    expect(second.headOrientation.pitch).toBeCloseTo(-4.5, 6);
    expect(second.headOrientation.roll).toBeCloseTo(3, 6);
    expect(second.facePresent).toBe(true);
    expect(second.faceCount).toBe(1);
  });

  it("resets smoothing after a long frame gap", () => {
    const processor = new TemporalSignalProcessor();

    processor.process(signals(0.28, { relativeFaceScale: 0.2 }), 0);
    const afterGap = processor.process(signals(0.28, { relativeFaceScale: 0.4 }), 1200);

    expect(afterGap.relativeFaceScale).toBeCloseTo(0.4, 6);
  });
});
