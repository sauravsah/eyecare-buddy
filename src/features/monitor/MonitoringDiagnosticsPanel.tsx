import type { DiagnosticError, MonitoringDiagnostics } from "../../vision/types";

interface MonitoringDiagnosticsPanelProps {
  diagnostics: MonitoringDiagnostics;
}

export function MonitoringDiagnosticsPanel({ diagnostics }: MonitoringDiagnosticsPanelProps) {
  const { cameraRequest, video, tracker } = diagnostics;

  return (
    <div className="monitoring-diagnostics">
      <p className="diagnostics-note">Metadata-only runtime trace. No frames, pixels, landmarks, face geometry, or biometric data are recorded.</p>

      <DiagnosticSection title="Camera stream">
        <DiagnosticRow label="getUserMedia called" value={formatTimestamp(cameraRequest?.requestedAt)} />
        <DiagnosticRow label="getUserMedia resolved" value={formatTimestamp(cameraRequest?.resolvedAt)} />
        <DiagnosticRow label="MediaStream returned" value={formatBoolean(cameraRequest?.streamReturned)} />
        <DiagnosticRow label="Video track count" value={formatValue(cameraRequest?.videoTrackCount)} />
        <DiagnosticRow label="Video track readyState" value={formatValue(cameraRequest?.videoTrackReadyState)} />
        <DiagnosticRow label="Video track muted" value={formatBoolean(cameraRequest?.videoTrackMuted)} />
        <DiagnosticRow label="Video track settings" value={formatSettings(cameraRequest?.videoTrackSettings)} />
        <DiagnosticRow label="Exact camera error" value={formatError(cameraRequest?.error)} />
      </DiagnosticSection>

      <DiagnosticSection title="HTMLVideoElement">
        <DiagnosticRow label="Element exists" value={formatBoolean(video.elementExists)} />
        <DiagnosticRow label="srcObject assigned" value={formatBoolean(video.srcObjectAssigned)} />
        <DiagnosticRow label="readyState" value={formatValue(video.readyState)} />
        <DiagnosticRow label="networkState" value={formatValue(video.networkState)} />
        <DiagnosticRow label="video dimensions" value={video.videoWidth === null ? "—" : `${video.videoWidth} × ${video.videoHeight}`} />
        <DiagnosticRow label="paused / ended" value={`${formatBoolean(video.paused)} / ${formatBoolean(video.ended)}`} />
        <DiagnosticRow label="currentTime" value={formatValue(video.currentTime)} />
        <DiagnosticRow label="loadedmetadata" value={formatPerformanceTime(video.loadedMetadataAt)} />
        <DiagnosticRow label="canplay" value={formatPerformanceTime(video.canPlayAt)} />
        <DiagnosticRow label="playing" value={formatPerformanceTime(video.playingAt)} />
        <DiagnosticRow label="First frame available" value={video.firstFrameAvailableAt === null ? "—" : `${formatPerformanceTime(video.firstFrameAvailableAt)} via ${video.firstFrameSource}`} />
      </DiagnosticSection>

      <DiagnosticSection title="FaceTracker / worker">
        <DiagnosticRow label="Worker created" value={formatPerformanceTime(tracker.workerCreatedAt)} />
        <DiagnosticRow label="Model initialization started" value={formatPerformanceTime(tracker.modelInitializationStartedAt)} />
        <DiagnosticRow label="Model initialization completed" value={formatPerformanceTime(tracker.modelInitializationCompletedAt)} />
        <DiagnosticRow label="Model initialization error" value={formatError(tracker.modelInitializationError)} />
        <DiagnosticRow label="Worker messages" value={`${tracker.workerMessageCount} (last: ${tracker.lastWorkerMessageType ?? "—"})`} />
        <DiagnosticRow label="Worker errors" value={`${tracker.workerErrorCount} (last: ${formatError(tracker.lastWorkerError)})`} />
        <DiagnosticRow label="First frame submitted" value={formatPerformanceTime(tracker.firstFrameSubmittedAt)} />
        <DiagnosticRow label="Frame submissions" value={String(tracker.frameSubmissionCount)} />
        <DiagnosticRow label="First successful result" value={formatPerformanceTime(tracker.firstSuccessfulResultAt)} />
        <DiagnosticRow label="Successful results" value={String(tracker.successfulResultCount)} />
        <DiagnosticRow label="Processing error" value={formatError(tracker.processingError)} />
        <DiagnosticRow label="Last processing latency" value={tracker.lastProcessingLatencyMs === null ? "—" : `${tracker.lastProcessingLatencyMs.toFixed(2)} ms`} />
        <DiagnosticRow label="Landmarker timestamps monotonic" value={formatBoolean(tracker.timestampsMonotonic)} />
        <DiagnosticRow label="Worker terminated" value={`${formatPerformanceTime(tracker.workerTerminatedAt)}${tracker.workerTerminationReason ? ` (${tracker.workerTerminationReason})` : ""}`} />
      </DiagnosticSection>

      <details className="monitoring-diagnostics-events">
        <summary>Lifecycle event trace ({diagnostics.lifecycleEvents.length})</summary>
        {diagnostics.lifecycleEvents.length === 0 ? (
          <p className="diagnostics-note">No lifecycle events recorded yet.</p>
        ) : (
          <ol>
            {[...diagnostics.lifecycleEvents].reverse().map((event, index) => (
              <li key={`${event.at}-${event.event}-${index}`}>
                <span>{formatPerformanceTime(event.at)}</span>
                <strong>{event.event}</strong>
                {event.detail && <em>{event.detail}</em>}
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  );
}

function DiagnosticSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="monitoring-diagnostics-section">
      <h3>{title}</h3>
      <div className="diagnostics-grid">{children}</div>
    </section>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return <div className="diagnostic-row"><span>{label}</span><strong>{value}</strong></div>;
}

function formatBoolean(value: boolean | null | undefined): string {
  return value === null || value === undefined ? "—" : value ? "Yes" : "No";
}

function formatValue(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

function formatTimestamp(value: string | null | undefined): string {
  return value ?? "—";
}

function formatPerformanceTime(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} ms`;
}

function formatError(error: DiagnosticError | null | undefined): string {
  return error ? `${error.name}: ${error.message}` : "—";
}

function formatSettings(settings: MediaTrackSettings | undefined): string {
  if (!settings) {
    return "—";
  }

  try {
    return JSON.stringify(settings);
  } catch {
    return "Unavailable";
  }
}
