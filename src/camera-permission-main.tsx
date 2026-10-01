import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CameraPermissionPage } from "./features/camera/CameraPermissionPage";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("EyeCare Buddy could not find the camera permission page root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <CameraPermissionPage />
  </StrictMode>
);
