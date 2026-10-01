import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { CAMERA_CONSTRAINTS, CameraAccessError, requestCameraStream, stopMediaStream } from "../../vision/camera";
import type { CameraRequestDiagnostic } from "../../vision/types";

type DiagnosticStatus = "idle" | "requesting" | "stream-obtained" | "error";

interface DiagnosticState {
  status: DiagnosticStatus;
  diagnostic: CameraRequestDiagnostic | null;
}

export function DirectGetUserMediaDiagnostic() {
  const requestInFlightRef = useRef(false);
  const [state, setState] = useState<DiagnosticState>({ status: "idle", diagnostic: null });

  function runDiagnostic(): void {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    const request = requestCameraStream({
      onStarted: (diagnostic) => {
        console.debug("[EyeCare Buddy] direct getUserMedia diagnostic started", diagnostic);
      },
      onCompleted: (diagnostic) => {
        setState((current) => ({ ...current, diagnostic }));
      }
    });

    // The request is started above before this state update; there is no await,
    // timeout, navigation, transition, or effect between the click and getUserMedia().
    setState({ status: "requesting", diagnostic: null });

    void request.then((stream) => {
      stopMediaStream(stream);
      setState((current) => ({ ...current, status: "stream-obtained" }));
    }).catch((error: unknown) => {
      const diagnostic = error instanceof CameraAccessError ? error.diagnostic.request ?? state.diagnostic : state.diagnostic;
      setState((current) => ({ ...current, status: "error", diagnostic: diagnostic ?? current.diagnostic }));
    }).finally(() => {
      requestInFlightRef.current = false;
    });
  }

  const diagnostic = state.diagnostic;

  return (
    <section className="diagnostics-card surface-card">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">Temporary diagnostic</p>
          <h2>Direct getUserMedia diagnostic</h2>
        </div>
        <span className="badge badge--outline">Camera only</span>
      </div>

      <p className="diagnostics-note">This control calls the normal local getUserMedia() path directly from this button and stops any returned stream immediately. It does not start MediaPipe and does not log camera frames.</p>

      <Button onClick={runDiagnostic} disabled={state.status === "requesting"}>
        {state.status === "requesting" ? "Waiting for Chrome…" : "Run direct camera test"}
      </Button>

      <div className="diagnostics-grid">
        <div className="diagnostic-row"><span>Status</span><strong>{formatStatus(state.status)}</strong></div>
        <div className="diagnostic-row"><span>Requested immediately before call</span><strong>{diagnostic?.requestedAt ?? "—"}</strong></div>
        <div className="diagnostic-row"><span>Permission query</span><strong>{diagnostic?.permissionState ?? "—"}</strong></div>
        <div className="diagnostic-row"><span>document.visibilityState</span><strong>{diagnostic?.visibilityState ?? "—"}</strong></div>
        <div className="diagnostic-row"><span>document.hasFocus()</span><strong>{formatNullableBoolean(diagnostic?.hasFocus)}</strong></div>
        <div className="diagnostic-row"><span>window.isSecureContext</span><strong>{formatNullableBoolean(diagnostic?.secureContext)}</strong></div>
        <div className="diagnostic-row"><span>navigator.mediaDevices</span><strong>{formatNullableBoolean(diagnostic?.mediaDevicesAvailable)}</strong></div>
        <div className="diagnostic-row"><span>getUserMedia</span><strong>{formatNullableBoolean(diagnostic?.getUserMediaAvailable)}</strong></div>
        <div className="diagnostic-row"><span>MediaStream returned</span><strong>{formatNullableBoolean(diagnostic?.streamReturned)}</strong></div>
        <div className="diagnostic-row"><span>Error name</span><strong>{diagnostic?.error?.name ?? "—"}</strong></div>
        <div className="diagnostic-row"><span>Error message</span><strong>{diagnostic?.error?.message ?? "—"}</strong></div>
      </div>

      {diagnostic?.permissionQueryError && (
        <p className="user-media-diagnostic-error">Permission query: {diagnostic.permissionQueryError.name}: {diagnostic.permissionQueryError.message}</p>
      )}

      <p className="diagnostics-note">Video track settings after acquisition:</p>
      <pre className="user-media-constraint-summary">{diagnostic?.videoTrackSettings ? JSON.stringify(diagnostic.videoTrackSettings, null, 2) : "No video track settings recorded."}</pre>

      <p className="diagnostics-note">Exact constraints passed to getUserMedia():</p>
      <pre className="user-media-constraint-summary">{JSON.stringify(CAMERA_CONSTRAINTS, null, 2)}</pre>
    </section>
  );
}

function formatStatus(status: DiagnosticStatus): string {
  switch (status) {
    case "idle": return "Not run";
    case "requesting": return "Requesting";
    case "stream-obtained": return "Stream obtained; tracks stopped";
    case "error": return "Error";
  }
}

function formatNullableBoolean(value: boolean | null | undefined): string {
  return value === undefined || value === null ? "—" : value ? "Yes" : "No";
}
