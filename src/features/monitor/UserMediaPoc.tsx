import { createElement, useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { stopMediaStream } from "../../vision/camera";
import { supportsUserMediaElement, USER_MEDIA_CONSTRAINTS, type UserMediaElement } from "../../vision/usermedia";

type UserMediaPocStatus = "idle" | "requesting" | "stream-obtained" | "error" | "stopped";

interface UserMediaPocError {
  name: string;
  message: string;
}

interface UserMediaPocProps {
  monitorBusy: boolean;
  onFallback: () => void;
  onStartWithStream: (stream: MediaStream) => void;
  onStop: () => void;
}

export function UserMediaPoc({ monitorBusy, onFallback, onStartWithStream, onStop }: UserMediaPocProps) {
  const supported = supportsUserMediaElement();
  const elementRef = useRef<UserMediaElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const constraintsConfiguredRef = useRef(false);
  const [setConstraintsCalls, setSetConstraintsCalls] = useState(0);
  const [setConstraintsAt, setSetConstraintsAt] = useState<string | null>(null);
  const [browserButtonClickedAt, setBrowserButtonClickedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<UserMediaPocStatus>(supported ? "idle" : "error");
  const [error, setError] = useState<UserMediaPocError | null>(supported ? null : {
    name: "HTMLUserMediaElementUnavailable",
    message: "This browser context does not expose the browser-controlled camera element."
  });

  useEffect(() => {
    if (!supported) {
      return;
    }

    const element = elementRef.current;
    if (!element) {
      return;
    }

    const handleStream = (): void => {
      const stream = element.stream;
      if (!stream) {
        setStatus("error");
        setError({
          name: "MediaStreamUnavailable",
          message: "The usermedia element signaled success without exposing a stream."
        });
        return;
      }

      streamRef.current = stream;
      setError(null);
      setStatus("stream-obtained");
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (streamRef.current === stream) {
            streamRef.current = null;
            setStatus("stopped");
          }
        }, { once: true });
      });
      onStartWithStream(stream);
    };

    const readElementError = (fallbackName: string, fallbackMessage: string): UserMediaPocError => ({
      name: element.error?.name ?? fallbackName,
      message: element.error?.message ?? fallbackMessage
    });

    const handleError = (): void => {
      setError(readElementError("UserMediaError", "The browser-controlled camera request failed."));
      setStatus("error");
    };

    const handleCancel = (): void => {
      setError(readElementError("PermissionDismissed", "The browser dismissed the camera permission flow."));
      setStatus("error");
    };

    element.addEventListener("stream", handleStream);
    element.addEventListener("error", handleError);
    element.addEventListener("cancel", handleCancel);

    if (!constraintsConfiguredRef.current) {
      try {
        element.setConstraints(USER_MEDIA_CONSTRAINTS);
        constraintsConfiguredRef.current = true;
        setSetConstraintsCalls((current) => current + 1);
        setSetConstraintsAt(new Date().toISOString());
      } catch (constraintError) {
        const name = constraintError instanceof Error ? constraintError.name : "ConstraintError";
        const message = constraintError instanceof Error ? constraintError.message : "The browser rejected the video constraints.";
        setError({ name, message });
        setStatus("error");
      }
    }

    return () => {
      element.removeEventListener("stream", handleStream);
      element.removeEventListener("error", handleError);
      element.removeEventListener("cancel", handleCancel);
    };
  }, [onStartWithStream, supported]);

  useEffect(() => () => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
  }, []);

  const isActive = status === "stream-obtained";
  const isRequesting = status === "requesting";
  const statusCopy = getStatusCopy(status, supported, monitorBusy);

  function markRequesting(): void {
    setError(null);
    setStatus("requesting");
    setBrowserButtonClickedAt(new Date().toISOString());
  }

  function stopPocCamera(): void {
    onStop();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setStatus("stopped");
  }

  function useFallback(): void {
    setError(null);
    setStatus("requesting");
    onFallback();
  }

  return (
    <section className="diagnostics-card user-media-poc-card">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">Developer test</p>
          <h2>Camera permission test</h2>
        </div>
        <span className="badge badge--outline">Temporary POC</span>
      </div>

      <p className="diagnostics-note">Uses Chrome&apos;s browser-controlled <code>&lt;usermedia&gt;</code> element with video only. The received stream is handed to the existing local monitor pipeline.</p>

      <div className="user-media-poc-status">
        <span className={`status-tone status-tone--${statusCopy.tone}`}><span className="status-dot" /> {statusCopy.label}</span>
        <span>{statusCopy.description}</span>
      </div>

      <div className="user-media-poc-control">
        {supported ? (
          createElement(
            "usermedia",
            { id: "existing-user-media", ref: elementRef, className: "user-media-poc-element", "aria-label": "Browser-controlled camera permission test" },
            createElement(
              "button",
              {
                className: "user-media-poc-button",
                type: "button",
                disabled: monitorBusy || isRequesting || isActive,
                onClick: markRequesting
              },
              isRequesting ? "Waiting for Chrome…" : isActive ? "Camera connected" : "Enable camera"
            )
          )
        ) : (
          <Button variant="secondary" onClick={useFallback} disabled={monitorBusy || isRequesting}>
            Use standard camera flow
          </Button>
        )}
      </div>

      {isActive && (
        <Button variant="secondary" onClick={stopPocCamera}>
          Stop POC camera
        </Button>
      )}

      <div className="diagnostics-grid">
        <div className="diagnostic-row"><span>Browser</span><strong>{getBrowserLabel()}</strong></div>
        <div className="diagnostic-row"><span>HTMLUserMediaElement</span><strong>{supported ? "Available" : "Unavailable"}</strong></div>
        <div className="diagnostic-row"><span>MediaStream</span><strong>{isActive ? "Received" : "Not received"}</strong></div>
        <div className="diagnostic-row"><span>setConstraints calls</span><strong>{setConstraintsCalls}</strong></div>
        <div className="diagnostic-row"><span>setConstraints time</span><strong>{setConstraintsAt ?? "not called"}</strong></div>
        <div className="diagnostic-row"><span>Browser button click</span><strong>{browserButtonClickedAt ?? "not clicked"}</strong></div>
        <div className="diagnostic-row"><span>Audio constraint</span><strong>omitted</strong></div>
      </div>

      {error && (
        <div className="user-media-poc-error">
          <div className="diagnostic-row"><span>Error name</span><strong>{error.name}</strong></div>
          <div className="diagnostic-row"><span>Error message</span><strong>{error.message}</strong></div>
        </div>
      )}
    </section>
  );
}

function getStatusCopy(status: UserMediaPocStatus, supported: boolean, monitorBusy: boolean): {
  label: string;
  description: string;
  tone: "neutral" | "good" | "attention" | "error";
} {
  if (!supported) {
    return { label: "Fallback", description: "<usermedia> is unavailable here; the existing local getUserMedia flow remains available.", tone: "attention" };
  }
  if (status === "stream-obtained") {
    return { label: "Stream obtained", description: "The stream is attached to the existing preview and local MediaPipe path.", tone: "good" };
  }
  if (monitorBusy) {
    return { label: "Busy", description: "Stop the current monitor session before running this isolated permission test.", tone: "attention" };
  }
  switch (status) {
    case "requesting": return { label: "Requesting", description: "Chrome is handling the browser-controlled camera interaction.", tone: "attention" };
    case "error": return { label: "Error", description: "The browser-controlled request did not produce a usable stream.", tone: "error" };
    case "stopped": return { label: "Stopped", description: "The POC stream is stopped and no camera frames are being captured by this test.", tone: "neutral" };
    case "idle": return { label: "Ready", description: "Click the browser-controlled button to begin the camera permission test.", tone: "neutral" };
  }
}

function getBrowserLabel(): string {
  if (typeof navigator === "undefined") {
    return "Unavailable";
  }
  return navigator.userAgent.match(/(?:Chrome|Chromium|Edg|Brave)\/[^\s]+/)?.[0] ?? "Unknown";
}
