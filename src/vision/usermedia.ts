/**
 * Chrome 151+ exposes this capability element, but TypeScript's DOM library
 * does not declare it yet. Keep the browser-specific surface isolated here.
 */
export interface UserMediaConstraints {
  video: MediaTrackConstraintSet;
  audio?: MediaTrackConstraintSet;
}

export interface UserMediaElement extends HTMLElement {
  readonly stream: MediaStream | null;
  readonly error: DOMException | null;
  setConstraints(constraints: UserMediaConstraints): void;
}

declare global {
  interface HTMLElementTagNameMap {
    usermedia: UserMediaElement;
  }

  interface Window {
    HTMLUserMediaElement?: typeof HTMLElement;
  }

}

/** Video-only constraints for Chrome's browser-controlled capability element. */
export const USER_MEDIA_CONSTRAINTS: UserMediaConstraints = {
  video: {
    facingMode: { ideal: "user" },
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 30, max: 30 }
  }
};

/** Feature detection recommended by Chrome's usermedia documentation. */
export function supportsUserMediaElement(): boolean {
  return typeof window !== "undefined" && "HTMLUserMediaElement" in window;
}
