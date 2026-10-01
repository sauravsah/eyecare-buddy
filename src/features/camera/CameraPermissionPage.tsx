import { Camera, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/Button";
import { CameraAccessError, requestCameraStream, stopMediaStream } from "../../vision/camera";
import { CAMERA_PERMISSION_GRANTED_MESSAGE, returnToEyeCareBuddy } from "./permission-flow";

type PermissionPageStatus = "ready" | "requesting" | "granted" | "error";

interface PermissionPageError {
  name: string;
  message: string;
}

export function CameraPermissionPage() {
  const [status, setStatus] = useState<PermissionPageStatus>("ready");
  const [error, setError] = useState<PermissionPageError | null>(null);

  function allowCamera(): void {
    if (status === "requesting" || status === "granted") {
      return;
    }

    // Call getUserMedia before changing React state so this remains one direct,
    // explicit permission action in the normal extension tab.
    const request = requestCameraStream();
    setStatus("requesting");
    setError(null);

    void request.then((stream) => {
      stopMediaStream(stream);
      void notifyPermissionGranted();
      setStatus("granted");
    }).catch((cause: unknown) => {
      const diagnostic = cause instanceof CameraAccessError
        ? { name: cause.diagnostic.name, message: cause.diagnostic.message }
        : { name: getErrorName(cause), message: getErrorMessage(cause) };
      setStatus("error");
      setError(diagnostic);
    });
  }

  async function notifyPermissionGranted(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({ type: CAMERA_PERMISSION_GRANTED_MESSAGE });
    } catch (cause) {
      console.debug("[EyeCare Buddy] permission page could not notify the Side Panel.", cause);
    }
  }

  return (
    <main className="camera-permission-page">
      <header className="camera-permission-header">
        <BrandMark />
        <span className="local-status"><span className="status-dot" /> On-device setup</span>
      </header>

      <section className="camera-permission-card">
        <span className="camera-permission-icon" aria-hidden="true"><Camera size={26} /></span>
        <p className="eyebrow">Camera permission</p>
        <h1>Give your eyes a little more room.</h1>
        <p className="camera-permission-lead">Camera access is needed to analyze screen-health habits locally.</p>

        <div className="camera-permission-points">
          <PermissionPoint>Camera is used only while monitoring.</PermissionPoint>
          <PermissionPoint>Processing stays on this device.</PermissionPoint>
          <PermissionPoint>No camera frames are uploaded.</PermissionPoint>
          <PermissionPoint>No microphone is requested.</PermissionPoint>
          <PermissionPoint>You can revoke access in Chrome settings.</PermissionPoint>
        </div>

        {status === "ready" && (
          <Button onClick={allowCamera} icon={<Camera size={16} />}>
            Allow Camera Access
          </Button>
        )}

        {status === "requesting" && (
          <div className="camera-permission-state camera-permission-state--pending">
            <span className="status-dot" /> Waiting for Chrome to finish the camera permission request…
          </div>
        )}

        {status === "granted" && (
          <div className="camera-permission-state camera-permission-state--granted">
            <Check size={17} /> Camera access granted. Your stream was stopped after permission was confirmed.
          </div>
        )}

        {status === "error" && (
          <div className="camera-permission-error">
            <div className="camera-permission-state camera-permission-state--error">
              <ShieldCheck size={17} /> Camera access could not be granted.
            </div>
            {error && (
              <details>
                <summary>Technical detail</summary>
                <p>{error.name}: {error.message}</p>
              </details>
            )}
          </div>
        )}

        {(status === "granted" || status === "error") && (
          <Button variant="secondary" onClick={() => void returnToEyeCareBuddy()}>
            Return to EyeCare Buddy
          </Button>
        )}
      </section>

      <footer className="camera-permission-footer">
        <LockKeyhole size={15} /> Nothing is uploaded or stored by this permission check.
      </footer>
    </main>
  );
}

function PermissionPoint({ children }: { children: string }) {
  return <div className="camera-permission-point"><Check size={14} /> <span>{children}</span></div>;
}

function getErrorName(error: unknown): string {
  return typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"
    ? error.name
    : "CameraPermissionError";
}

function getErrorMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "Chrome did not grant camera access.";
}
