import { Camera, CircleAlert, LockKeyhole, RefreshCw, ScanFace, Square } from "lucide-react";
import { useEffect } from "react";
import { Button } from "../../components/Button";
import type { CameraPermissionState } from "../../vision/camera";
import type { MonitoringState } from "../../vision/types";
import { clearTrackingOverlay } from "../../vision/overlay";

interface CameraPreviewProps {
  state: MonitoringState;
  cameraPermissionState: CameraPermissionState | "unknown";
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  showDiagnostics: boolean;
  onEnable: () => void;
  onStop: () => void;
  onRetry: () => void;
}

export function CameraPreview({
  state,
  cameraPermissionState,
  videoRef,
  canvasRef,
  onEnable,
  onStop,
  onRetry
}: CameraPreviewProps) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    clearTrackingOverlay(canvas);
  }, [canvasRef, state.isMonitoring]);

  const isActive = state.isMonitoring;
  const isStarting = state.status === "camera-loading" || state.status === "model-loading";
  const hasError = state.status === "camera-permission-denied" || state.status === "camera-unavailable" || state.status === "tracking-error";
  const status = getStatusCopy(state, cameraPermissionState);
  const primaryActionLabel = cameraPermissionState === "granted"
    ? "Start monitoring"
    : state.status === "camera-permission-setup"
      ? "Open permission page"
      : isStarting
        ? status.title
        : "Enable Camera";

  return (
    <section className="camera-panel surface-card">
      <div className="camera-panel-topline">
        <div>
          <p className="eyebrow">Local camera</p>
          <h2 className="camera-panel-title">Live awareness</h2>
        </div>
        <span className={`camera-stage-badge camera-stage-badge--${status.tone}`}>
          <span className="badge-dot" /> {status.label}
        </span>
      </div>

      <div className={`camera-stage ${isActive ? "camera-stage--active" : "camera-stage--off"}`}>
        <video ref={videoRef} autoPlay muted playsInline aria-label="Local camera preview" />
        <canvas ref={canvasRef} aria-hidden="true" />
        {!isActive && (
          <div className="camera-off-state">
            <span className="camera-off-state-icon">{hasError ? <CircleAlert size={24} /> : <Camera size={24} />}</span>
            <strong>{status.title}</strong>
            <span>{status.description}</span>
          </div>
        )}
        {isActive && (
          <div className="camera-status-message">
            <span className={`status-tone status-tone--${status.tone}`}><span className="status-dot" /> {status.title}</span>
          </div>
        )}
      </div>

      <div className="camera-controls">
        {!isActive && !hasError && (
          <Button onClick={onEnable} disabled={isStarting} icon={isStarting ? <RefreshCw size={16} className="spin" /> : <ScanFace size={16} />}>
            {primaryActionLabel}
          </Button>
        )}
        {!isActive && hasError && (
          <Button onClick={onRetry} icon={<RefreshCw size={16} />}>
            Try again
          </Button>
        )}
        {isActive && (
          <Button variant="secondary" onClick={onStop} icon={<Square size={14} />}>Stop monitoring</Button>
        )}
      </div>

      <div className="camera-privacy">
        <LockKeyhole size={15} />
        <span>Frames stay on this device and are not uploaded. Camera access starts only when you choose Enable Camera.</span>
      </div>
    </section>
  );
}

function getStatusCopy(state: MonitoringState, cameraPermissionState: CameraPermissionState | "unknown"): {
  label: string;
  title: string;
  description: string;
  tone: "neutral" | "good" | "attention" | "error";
} {
  switch (state.status) {
    case "camera-loading":
      return { label: "Starting", title: "Starting camera…", description: "Waiting for your camera permission.", tone: "attention" };
    case "model-loading":
      return { label: "Preparing", title: "Preparing local vision…", description: "Loading the on-device model. Nothing is uploaded.", tone: "attention" };
    case "camera-active":
      return { label: "Active", title: "Camera is ready", description: "Preparing local face signals for this session.", tone: "good" };
    case "camera-permission-setup":
      return { label: "Setup needed", title: "Finish camera permission in Chrome", description: "A dedicated EyeCare Buddy tab is open. Choose Allow Camera Access there, then return and start monitoring.", tone: "attention" };
    case "tracking":
      return { label: "Active", title: "Face detected", description: "Face presence is being processed locally.", tone: "good" };
    case "no-face":
      return { label: "Active", title: "Position yourself in view", description: "Keep your face visible to continue local tracking.", tone: "attention" };
    case "multiple-faces":
      return { label: "Needs attention", title: "One person at a time", description: "Only one face is supported for tracking right now.", tone: "attention" };
    case "low-confidence":
      return { label: "Needs attention", title: "Move into better light", description: "The local face signal is not confident enough yet.", tone: "attention" };
    case "camera-permission-denied":
      return { label: "Permission needed", title: "Camera access was not allowed", description: "Allow camera access for this extension in Chrome, then try again.", tone: "error" };
    case "camera-unavailable":
      return { label: "Unavailable", title: "Camera is unavailable", description: "Check that a camera is connected and not being used by another app.", tone: "error" };
    case "tracking-error":
      return { label: "Error", title: "Local tracking stopped", description: "The model could not finish processing. Try starting a fresh session.", tone: "error" };
    case "camera-stopped":
      return { label: "Stopped", title: "Monitoring is paused", description: "No camera frames are being captured.", tone: "neutral" };
    case "camera-disabled":
    default:
      if (cameraPermissionState === "granted") {
        return { label: "Ready", title: "Camera permission granted", description: "Start monitoring when you are ready. Camera access begins only after that action.", tone: "good" };
      }
      return { label: "Off", title: "Camera is off", description: "Enable the camera when you are ready to begin.", tone: "neutral" };
  }
}
