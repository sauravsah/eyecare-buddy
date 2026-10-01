import type { CameraPermissionQueryResult } from "../../vision/camera";

export const CAMERA_PERMISSION_PAGE = "camera-permission.html";
export const CAMERA_PERMISSION_GRANTED_MESSAGE = "eyecare-buddy:camera-permission-granted";

export interface CameraPermissionGrantedMessage {
  type: typeof CAMERA_PERMISSION_GRANTED_MESSAGE;
}

export function isCameraPermissionGrantedMessage(message: unknown): message is CameraPermissionGrantedMessage {
  return typeof message === "object" && message !== null && "type" in message && message.type === CAMERA_PERMISSION_GRANTED_MESSAGE;
}

export async function openCameraPermissionPage(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL || !chrome.tabs?.create) {
    throw new Error("Chrome cannot open the camera permission page from this extension context.");
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL(CAMERA_PERMISSION_PAGE) });
}

export async function returnToEyeCareBuddy(): Promise<void> {
  try {
    const currentTab = await chrome.tabs.getCurrent();
    if (currentTab?.id !== undefined) {
      await chrome.tabs.remove(currentTab.id);
      return;
    }
  } catch {
    // Fall through to the browser's normal close behavior when tab APIs are unavailable.
  }

  window.close();
}

export function permissionResultToLabel(result: CameraPermissionQueryResult): string {
  if (result.state === "query-error") {
    return "Permission state unavailable";
  }
  if (result.state === "unsupported") {
    return "Permission query unavailable";
  }
  return result.state;
}
