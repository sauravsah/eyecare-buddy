import { describe, expect, it } from "vitest";
import { createCameraState, deriveTrackingSnapshot } from "./tracking";
import type { FaceLandmarkPoint, LandmarkFrame } from "./types";

function makeFace(offsetX = 0): FaceLandmarkPoint[] {
  return Array.from({ length: 24 }, (_, index) => ({
    x: 0.35 + offsetX + (index % 6) * 0.04,
    y: 0.25 + Math.floor(index / 6) * 0.08,
    z: 0
  }));
}

interface OrientedFaceOptions {
  leftFaceSideZ?: number;
  rightFaceSideZ?: number;
  foreheadZ?: number;
  chinZ?: number;
  leftEyeY?: number;
  rightEyeY?: number;
}

function makeOrientedFace(options: OrientedFaceOptions = {}): FaceLandmarkPoint[] {
  const landmarks = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[10] = { x: 0.5, y: 0.2, z: options.foreheadZ ?? 0 };
  landmarks[152] = { x: 0.5, y: 0.8, z: options.chinZ ?? 0 };
  landmarks[234] = { x: 0.3, y: 0.5, z: options.leftFaceSideZ ?? 0 };
  landmarks[454] = { x: 0.7, y: 0.5, z: options.rightFaceSideZ ?? 0 };
  for (const index of [33, 133, 159, 145]) {
    landmarks[index] = { x: 0.4, y: options.leftEyeY ?? 0.4, z: 0 };
  }
  for (const index of [263, 362, 386, 374]) {
    landmarks[index] = { x: 0.6, y: options.rightEyeY ?? 0.4, z: 0 };
  }
  return landmarks;
}

function frame(faces: FaceLandmarkPoint[][]): LandmarkFrame {
  return { faces, timestampMs: 1000, inferenceTimeMs: 8 };
}

describe("deriveTrackingSnapshot", () => {
  it("creates explicit camera lifecycle states", () => {
    expect(createCameraState("model-loading", true)).toMatchObject({
      status: "model-loading",
      isMonitoring: true,
      facePresent: false,
      faceCount: 0,
      relativeFaceScale: null,
      headOrientation: { yaw: null, pitch: null, roll: null },
      quality: "unavailable"
    });
  });

  it("returns no-face when the model detects nothing", () => {
    const snapshot = deriveTrackingSnapshot(frame([]));
    expect(snapshot.status).toBe("no-face");
    expect(snapshot.facePresent).toBe(false);
    expect(snapshot.faceCount).toBe(0);
    expect(snapshot.relativeFaceScale).toBeNull();
    expect(snapshot.headOrientation).toEqual({ yaw: null, pitch: null, roll: null });
  });

  it("returns multiple-faces when more than one face is present", () => {
    const snapshot = deriveTrackingSnapshot(frame([makeFace(), makeFace(0.1)]));
    expect(snapshot.status).toBe("multiple-faces");
    expect(snapshot.facePresent).toBe(true);
    expect(snapshot.faceCount).toBe(2);
    expect(snapshot.relativeFaceScale).toBeNull();
    expect(snapshot.headOrientation).toEqual({ yaw: null, pitch: null, roll: null });
  });

  it("returns low-confidence for incomplete landmark data", () => {
    const snapshot = deriveTrackingSnapshot(frame([makeFace().slice(0, 4)]));
    expect(snapshot.status).toBe("low-confidence");
    expect(snapshot.quality).toBe("low");
  });

  it("returns tracking for a complete in-frame face", () => {
    const snapshot = deriveTrackingSnapshot(frame([makeFace()]));
    expect(snapshot.status).toBe("tracking");
    expect(snapshot.quality).toBe("good");
    expect(snapshot.facePresent).toBe(true);
    expect(snapshot.relativeFaceScale).toBeCloseTo(Math.sqrt(0.2 * 0.24), 6);
    expect(snapshot.headOrientation).toEqual({ yaw: null, pitch: null, roll: null });
    expect(snapshot).not.toHaveProperty("faces");
    expect(snapshot).not.toHaveProperty("boundingBoxes");
  });

  it("extracts camera-relative orientation from worker-local geometry", () => {
    const snapshot = deriveTrackingSnapshot(frame([makeOrientedFace()]));

    expect(snapshot.headOrientation.yaw).toBeCloseTo(0, 6);
    expect(snapshot.headOrientation.pitch).toBeCloseTo(0, 6);
    expect(snapshot.headOrientation.roll).toBeCloseTo(0, 6);
  });

  it("keeps the documented orientation signs in camera coordinates", () => {
    const snapshot = deriveTrackingSnapshot(frame([makeOrientedFace({
      leftFaceSideZ: 0.1,
      rightFaceSideZ: -0.1,
      foreheadZ: -0.1,
      chinZ: 0.1,
      leftEyeY: 0.38,
      rightEyeY: 0.42
    })]));

    expect(snapshot.headOrientation.yaw).toBeGreaterThan(0);
    expect(snapshot.headOrientation.pitch).toBeGreaterThan(0);
    expect(snapshot.headOrientation.roll).toBeGreaterThan(0);
  });
});
