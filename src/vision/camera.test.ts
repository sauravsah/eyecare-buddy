import { describe, expect, it, vi } from "vitest";
import { CAMERA_CONSTRAINTS, cameraErrorToStatus, classifyCameraError, createCameraDiagnostic, stopMediaStream } from "./camera";

describe("camera lifecycle helpers", () => {
  it("maps browser permission errors to the permission-denied state", () => {
    expect(classifyCameraError({ name: "NotAllowedError" })).toBe("not-allowed");
    expect(cameraErrorToStatus("not-allowed")).toBe("camera-permission-denied");
  });

  it("maps unavailable devices to the unavailable state", () => {
    expect(classifyCameraError({ name: "NotFoundError" })).toBe("no-camera");
    expect(cameraErrorToStatus("no-camera")).toBe("camera-unavailable");
  });

  it("keeps distinct browser failure categories distinct for diagnostics", () => {
    expect(classifyCameraError({ name: "NotReadableError" })).toBe("camera-busy");
    expect(classifyCameraError({ name: "OverconstrainedError" })).toBe("constraints-unsatisfied");
    expect(classifyCameraError({ name: "InvalidStateError" })).toBe("unsupported-context");
    expect(classifyCameraError({ name: "UnexpectedError" })).toBe("runtime-error");
  });

  it("preserves browser diagnostic details without including camera data", () => {
    const diagnostic = createCameraDiagnostic("not-allowed", {
      name: "NotAllowedError",
      message: "Permission policy blocked the request."
    });

    expect(diagnostic.name).toBe("NotAllowedError");
    expect(diagnostic.message).toBe("Permission policy blocked the request.");
    expect(diagnostic.code).toBe("not-allowed");
    expect(diagnostic).not.toHaveProperty("frame");
  });

  it("stops every media stream track during cleanup", () => {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    const stream = { getTracks: () => tracks } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(tracks[0].stop).toHaveBeenCalledOnce();
    expect(tracks[1].stop).toHaveBeenCalledOnce();
  });

  it("requests front-facing video without a microphone", () => {
    expect(CAMERA_CONSTRAINTS.audio).toBe(false);
    expect(CAMERA_CONSTRAINTS.video.facingMode).toEqual({ ideal: "user" });
    expect(CAMERA_CONSTRAINTS.video.frameRate.max).toBe(30);
  });
});
