import { Check, Info, Settings2 } from "lucide-react";
import { Button } from "../../components/Button";
import { PageIntro } from "../../components/PageIntro";
import type { AppRoute, UserSettings } from "../../domain/types";
import type { MonitoringStatus } from "../../vision/types";
import { CameraPreview } from "./CameraPreview";
import { MonitoringDiagnosticsPanel } from "./MonitoringDiagnosticsPanel";
import { useMonitoring } from "./useMonitoring";

interface LiveMonitorViewProps {
  onNavigate: (route: AppRoute) => void;
  settings: UserSettings;
}

export function LiveMonitorView({ onNavigate, settings }: LiveMonitorViewProps) {
  const { state, diagnostics, cameraPermissionState, videoRef, canvasRef, enable, stop, retry } = useMonitoring();
  const isAvailable = state.status !== "camera-disabled" && state.status !== "camera-stopped";

  return (
    <div className="view-stack">
      <PageIntro
        eyebrow="Live Monitor"
        title="Awareness without the noise."
        description="When enabled, local vision helps you notice screen habits in real time, with gentle guidance instead of judgment."
      />

      <CameraPreview
        state={state}
        cameraPermissionState={cameraPermissionState}
        videoRef={videoRef}
        canvasRef={canvasRef}
        showDiagnostics={settings.trackingDetailsEnabled}
        onEnable={enable}
        onStop={stop}
        onRetry={retry}
      />

      <section className="surface-card status-overview">
        <div className="card-heading-row">
          <div>
            <p className="eyebrow">Session status</p>
            <h2>{getSessionTitle(state.status)}</h2>
          </div>
          <span className={`status-tone status-tone--${state.isMonitoring ? "good" : "neutral"}`}>
            <span className="status-dot" /> {state.isMonitoring ? "On device" : "Standby"}
          </span>
        </div>
        <div className="status-overview-grid">
          <div><span>Tracking quality</span><strong>{getQualityLabel(state)}</strong></div>
          <div><span>Faces in view</span><strong>{state.faceCount}</strong></div>
          <div><span>Camera frames</span><strong>{state.isMonitoring ? "Live" : "Off"}</strong></div>
        </div>
      </section>

      {settings.trackingDetailsEnabled && isAvailable && (
        <section className="diagnostics-card surface-card">
          <div className="card-heading-row">
            <div><p className="eyebrow">Diagnostics</p><h2>Local tracking details</h2></div>
            <span className="badge badge--outline">Developer view</span>
          </div>
          <div className="diagnostics-grid">
            <div className="diagnostic-row"><span>Processing rate</span><strong>{state.fps ? `${state.fps} fps` : "—"}</strong></div>
            <div className="diagnostic-row"><span>Inference time</span><strong>{state.inferenceTimeMs ? `${Math.round(state.inferenceTimeMs)} ms` : "—"}</strong></div>
            <div className="diagnostic-row"><span>Confidence signal</span><strong>{state.qualityScore !== undefined ? `${Math.round(state.qualityScore * 100)}%` : "—"}</strong></div>
            <div className="diagnostic-row"><span>Camera-relative face scale</span><strong>{state.relativeFaceScale === null ? "—" : state.relativeFaceScale.toFixed(3)}</strong></div>
            <div className="diagnostic-row"><span>Head orientation · yaw</span><strong>{state.headOrientation.yaw === null ? "—" : `${state.headOrientation.yaw.toFixed(1)}°`}</strong></div>
            <div className="diagnostic-row"><span>Head orientation · pitch</span><strong>{state.headOrientation.pitch === null ? "—" : `${state.headOrientation.pitch.toFixed(1)}°`}</strong></div>
            <div className="diagnostic-row"><span>Head orientation · roll</span><strong>{state.headOrientation.roll === null ? "—" : `${state.headOrientation.roll.toFixed(1)}°`}</strong></div>
            <div className="diagnostic-row"><span>Observed blinks</span><strong>{state.blink.observedBlinkCount}</strong></div>
          </div>
          {state.cameraDiagnostic && (
            <div className="camera-diagnostic">
              <p className="diagnostics-note"><strong>Camera request diagnostic</strong> — development detail; no camera frames are included.</p>
              <div className="diagnostics-grid">
                <div className="diagnostic-row"><span>Browser error</span><strong>{state.cameraDiagnostic.name}</strong></div>
                <div className="diagnostic-row"><span>Message</span><strong>{state.cameraDiagnostic.message}</strong></div>
                <div className="diagnostic-row"><span>Classifier</span><strong>{state.cameraDiagnostic.code}</strong></div>
                <div className="diagnostic-row"><span>Secure context</span><strong>{state.cameraDiagnostic.secureContext ? "Yes" : "No"}</strong></div>
                <div className="diagnostic-row"><span>MediaDevices API</span><strong>{state.cameraDiagnostic.mediaDevicesAvailable ? "Available" : "Missing"}</strong></div>
                <div className="diagnostic-row"><span>getUserMedia API</span><strong>{state.cameraDiagnostic.getUserMediaAvailable ? "Available" : "Missing"}</strong></div>
                {state.cameraDiagnostic.constraint && <div className="diagnostic-row"><span>Failed constraint</span><strong>{state.cameraDiagnostic.constraint}</strong></div>}
              </div>
            </div>
          )}
          <p className="diagnostics-note">Raw landmarks are processed only in the local worker and are not saved as biometric data.</p>
          <MonitoringDiagnosticsPanel diagnostics={diagnostics} />
        </section>
      )}

      <section className="surface-card info-card">
        <div className="info-card-icon"><Info size={18} /></div>
        <div>
          <h2>What will happen next</h2>
          <p>This foundation uses MediaPipe Face Landmarker for local facial and eye landmarks. Distance remains an estimate—not a medical measurement.</p>
        </div>
      </section>

      <section className="checklist-card">
        <div className="section-heading-row"><div><p className="eyebrow">Designed around trust</p><h2>Before you turn it on</h2></div></div>
        <div className="checklist-item"><span><Check size={14} /></span><div><strong>You stay in control</strong><p>Start, pause, and stop monitoring whenever you want.</p></div></div>
        <div className="checklist-item"><span><Check size={14} /></span><div><strong>Signals stay on-device</strong><p>Camera frames and individual landmarks are not uploaded or saved.</p></div></div>
        <div className="checklist-item"><span><Check size={14} /></span><div><strong>Clear boundaries</strong><p>This is a habit companion, not a diagnostic tool.</p></div></div>
      </section>

      <Button variant="secondary" icon={<Settings2 size={16} />} onClick={() => onNavigate("settings")}>
        Review settings
      </Button>
    </div>
  );
}

function getSessionTitle(status: MonitoringStatus): string {
  switch (status) {
    case "tracking": return "Tracking is ready";
    case "no-face": return "Waiting for a face";
    case "multiple-faces": return "Multiple faces detected";
    case "low-confidence": return "Tracking needs a clearer view";
    case "model-loading": return "Preparing local vision";
    case "camera-active": return "Camera is ready";
    case "camera-loading": return "Starting camera";
    case "camera-permission-denied": return "Camera permission needed";
    case "camera-permission-setup": return "Camera permission setup";
    case "camera-unavailable": return "Camera unavailable";
    case "tracking-error": return "Tracking stopped";
    case "camera-stopped": return "Monitoring is paused";
    default: return "Ready when you are";
  }
}

function getQualityLabel(state: { quality: "good" | "low" | "unavailable" }): string {
  if (state.quality === "good") return "Good";
  if (state.quality === "low") return "Low confidence";
  return "Not available";
}
