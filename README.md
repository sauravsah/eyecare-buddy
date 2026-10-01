# EyeCare Buddy

EyeCare Buddy is a local-first Chrome Side Panel extension for building healthier screen habits. The current build includes the real camera, local face-landmark foundation, and the first worker-local signal engine while keeping all user-facing health signals conservative and non-diagnostic.

## Milestone B scope

- Manifest V3 Chrome Side Panel with a separate background service worker.
- React + TypeScript + Vite application with typed navigation for Dashboard, Live Monitor, Visual Reset, Insights, and Settings.
- Local settings backed by `chrome.storage.local`, with a browser-preview fallback for UI development.
- Explicit camera opt-in using a normal extension-tab permission page plus `navigator.mediaDevices.getUserMedia` with front-facing video preference and `audio: false`.
- MediaPipe Face Landmarker `VIDEO` processing in a dedicated Web Worker using local WASM and a local model asset.
- One-face consumer tracking with explicit no-face, multiple-faces, low-confidence, loading, permission, unavailable, and processing-error states.
- Worker-local signals for face presence, relative face scale, camera-relative orientation, observed blink events, and scalar temporal smoothing.
- Optional developer diagnostics for camera/video state, FPS, inference time, lifecycle, and compact signals; raw landmarks are never displayed or recorded.
- No camera-frame, landmark, biometric, metric, Gemini, Firebase, analytics, account, payment, or external API persistence.

Distance estimation, calibration, gaze/posture signals, health scores, 20-20-20 reminders, guided exercises, aggregate metrics, and Gemini are intentionally deferred to later milestones. No current value is a simulated distance or health metric.

## Requirements

- Node.js 20.19+ (Node 24 is supported)
- npm 10+
- Chrome 116+ for the configured extension build

If the PowerShell `npm` shim is unavailable, use the npm executable installed with Node.js, for example `C:\Program Files\nodejs\npm.cmd` on Windows.

## Install, develop, and build

From the repository root:

```bash
npm install
npm run dev
```

The Vite server is useful for UI iteration. Camera behavior and the extension action must be tested from the production build because Chrome needs the generated `dist/manifest.json` and service worker.

Run the required checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run build` runs type-checking and linting before producing `dist/`.

## Load as an unpacked extension

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this repository's `dist` directory.
6. Click the EyeCare Buddy extension action to open the Side Panel.
7. Open **Live Monitor** and click **Enable Camera**.
8. If Chrome reports the camera permission as `prompt`, EyeCare Buddy opens `camera-permission.html` in a normal extension tab. Click **Allow Camera Access** there, return to the Side Panel, and click **Start monitoring**.

After source changes, run `npm run build` again and press **Reload** on the extension card. If the service worker reports an error, open its **Service worker** link from the extension card for details.

## Privacy and permissions

The manifest requests only `sidePanel` and `storage`. Camera access is a runtime permission requested after an explicit user action in a normal same-origin extension tab; there is no microphone request. The permission page stops its test stream immediately and does not start MediaPipe. After permission is granted, the Side Panel requests the camera again only when the user explicitly chooses **Start monitoring**. Camera frames are transferred only between the side-panel page and its local worker, used in memory for inference, and then released. Individual landmarks are not written to storage or sent to a server. The extension page CSP allows connections only to its own origin, and all MediaPipe runtime/model assets are bundled locally. No app-owned external integration is present.

This milestone uses the official `@mediapipe/tasks-vision` package and the versioned official Face Landmarker asset. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for source and licensing notes.

## Architecture

```text
src/
  app/                 Shell and route selection
  background/          Manifest V3 service worker
  components/          Shared UI primitives
  domain/              Product/domain types
  features/            Route-level feature surfaces
    camera/            Same-origin full-tab camera permission flow
    monitor/           Camera hook, context, preview, and live status UI
  shared/hooks/        Settings and hash navigation hooks
  shared/storage/      Typed local storage abstraction and defaults
  styles/              Global design tokens and responsive UI styles
  vision/              Camera constraints, worker tracker, model config, signal extraction, and temporal logic
public/
  manifest.json        MV3 manifest copied to dist/
  models/              Local Face Landmarker model asset
  mediapipe/wasm/      Local MediaPipe WASM runtime files
vite.config.ts         Side-panel + permission-page + service-worker build entries
vitest.config.ts       Pure-logic test configuration
```

The next recommended milestone is a privacy/performance review followed by calibrated viewing-distance estimation and an aggregate-only session engine. That work should define its data-retention contract before any metrics are persisted.
