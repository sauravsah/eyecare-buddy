# Third-party notices

## MediaPipe Tasks Vision

EyeCare Buddy uses `@mediapipe/tasks-vision` version `1.0.1` from the official MediaPipe Tasks web package. The package is distributed under the Apache License 2.0. Its JavaScript package, TypeScript declarations, and local WASM runtime are installed from npm; the WASM files used by the extension are copied into `public/mediapipe/wasm/` so the built extension does not depend on a runtime CDN.

References:

- [MediaPipe Face Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [MediaPipe Tasks Vision npm package](https://www.npmjs.com/package/@mediapipe/tasks-vision)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

## Face Landmarker model

The local model at `public/models/face_landmarker.task` was downloaded from the official versioned MediaPipe model asset URL:

`https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`

The model is used locally by the MediaPipe Face Landmarker task and is not uploaded by EyeCare Buddy. The model asset is separate from the Apache-licensed npm package; review the current model card and distribution terms before publishing the extension to a store.

Reference: [MediaPipe Face Mesh model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf).

## Privacy boundary

The extension does not send camera frames or landmark data to a server. It does not include Gemini, API keys, authentication, Firebase, analytics, or app-owned external integrations. The upstream MediaPipe package contains a performance/usage metrics path in its distributed runtime; EyeCare Buddy's MV3 CSP restricts `connect-src` to `'self'`, so that external endpoint cannot be reached from the extension. MediaPipe's bundled WASM/model loader uses same-origin requests for the bundled runtime/model assets. Preserve this CSP boundary and re-audit the dependency before any release or upgrade.
