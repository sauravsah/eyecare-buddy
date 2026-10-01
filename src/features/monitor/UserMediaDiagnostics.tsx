import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { stopMediaStream } from "../../vision/camera";
import { supportsUserMediaElement, USER_MEDIA_CONSTRAINTS, type UserMediaElement } from "../../vision/usermedia";

type MinimalStatus = "idle" | "requesting" | "stream-obtained" | "error";

interface MinimalState {
  status: MinimalStatus;
  setConstraintsCalls: number;
  setConstraintsAt: string | null;
  browserButtonClickedAt: string | null;
  error?: { name: string; message: string };
}

interface UserMediaDiagnosticsProps {
  targetSpecs: readonly { label: string; selector: string }[];
}

interface RectSnapshot {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ElementStyleSnapshot {
  display: string;
  position: string;
  width: string;
  height: string;
  minWidth: string;
  minHeight: string;
  maxWidth: string;
  maxHeight: string;
  margin: string;
  padding: string;
  opacity: string;
  visibility: string;
  overflow: string;
  overflowX: string;
  overflowY: string;
  transform: string;
  filter: string;
  clipPath: string;
  zIndex: string;
  pointerEvents: string;
  fontSize: string;
  lineHeight: string;
  color: string;
  backgroundColor: string;
  border: string;
  outline: string;
  outlineOffset: string;
}

interface ElementSnapshot {
  tagName: string;
  id: string;
  className: string;
  boundingClientRect: RectSnapshot;
  clientWidth: number;
  clientHeight: number;
  offsetWidth: number;
  offsetHeight: number;
  computedStyle: ElementStyleSnapshot;
}

interface ButtonSnapshot {
  tagName: string;
  text: string;
  boundingClientRect: RectSnapshot;
  computedStyle: ElementStyleSnapshot;
}

interface AncestorSnapshot {
  tagName: string;
  id: string;
  className: string;
  boundingClientRect: RectSnapshot;
  display: string;
  position: string;
  width: string;
  height: string;
  overflow: string;
  opacity: string;
  transform: string;
  filter: string;
  clipPath: string;
  zIndex: string;
}

interface UserMediaLayoutSnapshot {
  selector: string;
  measuredAt: string;
  element: ElementSnapshot | null;
  childButton: ButtonSnapshot | null;
  ancestors: AncestorSnapshot[];
  viewport: {
    width: number;
    height: number;
    fullyInsideViewport: boolean;
    partiallyOutsideViewport: boolean;
    clippedByAncestor: boolean;
    clippingAncestors: string[];
    occludedByAnotherElement: boolean;
    centerPoint: { x: number; y: number } | null;
    elementsFromPoint: string[];
  };
}

const VIDEO_ONLY_CONSTRAINT_SUMMARY = "video constraints; audio omitted";

export function MinimalUserMediaExperiment() {
  const supported = supportsUserMediaElement();
  const elementRef = useRef<UserMediaElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const constraintsConfiguredRef = useRef(false);
  const [state, setState] = useState<MinimalState>({
    status: supported ? "idle" : "error",
    setConstraintsCalls: 0,
    setConstraintsAt: null,
    browserButtonClickedAt: null,
    ...(supported ? {} : { error: { name: "HTMLUserMediaElementUnavailable", message: "The browser-controlled element is unavailable." } })
  });

  useEffect(() => {
    if (!supported) {
      return;
    }

    const element = elementRef.current;
    if (!element) {
      return;
    }

    const errorDetails = (fallbackName: string, fallbackMessage: string): { name: string; message: string } => ({
      name: element.error?.name ?? fallbackName,
      message: element.error?.message ?? fallbackMessage
    });

    const handleStream = (): void => {
      const stream = element.stream;
      if (!stream) {
        setState((current) => ({ ...current, status: "error", error: errorDetails("MediaStreamUnavailable", "The element signaled success without exposing a stream.") }));
        return;
      }

      streamRef.current = stream;
      setState((current) => ({ ...current, status: "stream-obtained", error: undefined }));
      stopMediaStream(stream);
      streamRef.current = null;
    };

    const handleError = (): void => {
      setState((current) => ({ ...current, status: "error", error: errorDetails("UserMediaError", "The minimal browser-controlled request failed.") }));
    };

    const handleCancel = (): void => {
      setState((current) => ({ ...current, status: "error", error: errorDetails("PermissionDismissed", "The browser dismissed the permission flow.") }));
    };

    element.addEventListener("stream", handleStream);
    element.addEventListener("error", handleError);
    element.addEventListener("cancel", handleCancel);

    if (!constraintsConfiguredRef.current) {
      try {
        element.setConstraints(USER_MEDIA_CONSTRAINTS);
        constraintsConfiguredRef.current = true;
        setState((current) => ({ ...current, setConstraintsCalls: current.setConstraintsCalls + 1, setConstraintsAt: new Date().toISOString() }));
      } catch (constraintError) {
        const name = constraintError instanceof Error ? constraintError.name : "ConstraintError";
        const message = constraintError instanceof Error ? constraintError.message : "The browser rejected the video-only constraints.";
        setState((current) => ({ ...current, status: "error", error: { name, message } }));
      }
    }

    return () => {
      element.removeEventListener("stream", handleStream);
      element.removeEventListener("error", handleError);
      element.removeEventListener("cancel", handleCancel);
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    };
  }, [supported]);

  function markRequesting(): void {
    setState((current) => ({ ...current, status: "requesting", browserButtonClickedAt: new Date().toISOString(), error: undefined }));
  }

  return (
    <div className="user-media-minimal-experiment">
      <p className="eyebrow">Minimal control experiment</p>
      <p className="diagnostics-note">Plain layout only. This test does not attach frames to MediaPipe; any received tracks are stopped immediately.</p>
      <div className="user-media-minimal-wrapper">
        {supported ? createElement(
          "usermedia",
          { id: "minimal-user-media", ref: elementRef, className: "user-media-minimal-element", "aria-label": "Minimal camera permission test" },
          createElement(
            "button",
            { className: "user-media-minimal-button", type: "button", onClick: markRequesting },
            "Enable camera"
          )
        ) : (
          <span className="diagnostics-note">HTMLUserMediaElement is unavailable.</span>
        )}
      </div>
      <div className="user-media-minimal-result">
        <span>Status: <strong>{formatMinimalStatus(state.status)}</strong></span>
        <span>setConstraints calls: <strong>{state.setConstraintsCalls}</strong></span>
        <span>setConstraints time: <strong>{state.setConstraintsAt ?? "not called"}</strong></span>
        <span>Browser button click: <strong>{state.browserButtonClickedAt ?? "not clicked"}</strong></span>
        <span>Constraints: <strong>{VIDEO_ONLY_CONSTRAINT_SUMMARY}</strong></span>
      </div>
      <pre className="user-media-constraint-summary">{JSON.stringify(USER_MEDIA_CONSTRAINTS, null, 2)}</pre>
      {state.error && <p className="user-media-diagnostic-error">{state.error.name}: {state.error.message}</p>}
    </div>
  );
}

export function UserMediaLayoutDiagnostics({ targetSpecs }: UserMediaDiagnosticsProps) {
  const [snapshots, setSnapshots] = useState<UserMediaLayoutSnapshot[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);

  useLayoutEffect(() => {
    const measure = (): void => {
      setSnapshots(targetSpecs.map(({ selector }) => captureLayoutSnapshot(selector)));
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [refreshToken, targetSpecs]);

  return (
    <section className="diagnostics-card surface-card user-media-runtime-diagnostics">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">Developer inspection</p>
          <h2>Rendered usermedia diagnostics</h2>
        </div>
        <div className="user-media-diagnostic-actions">
          <Button variant="secondary" type="button" onClick={scrollToMinimalTest}>
            Scroll to minimal test
          </Button>
          <Button variant="secondary" type="button" onClick={() => setRefreshToken((current) => current + 1)}>
            Refresh
          </Button>
        </div>
      </div>
      <p className="diagnostics-note">Geometry and computed-style data only. Scrolling does not request camera access. No camera frames, image data, canvas pixels, landmarks, or biometric data are collected.</p>
      {snapshots.map((snapshot, index) => (
        <details className="user-media-diagnostic-details" key={`${snapshot.selector}-${index}`} open={index === 0}>
          <summary>{targetSpecs[index]?.label ?? snapshot.selector}</summary>
          <pre>{JSON.stringify(snapshot, null, 2)}</pre>
        </details>
      ))}
    </section>
  );

  function scrollToMinimalTest(): void {
    const element = document.querySelector<HTMLElement>("#minimal-user-media");
    element?.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
    window.requestAnimationFrame(() => setRefreshToken((current) => current + 1));
  }
}

function captureLayoutSnapshot(selector: string): UserMediaLayoutSnapshot {
  const element = document.querySelector<UserMediaElement>(selector);
  if (!element) {
    return {
      selector,
      measuredAt: new Date().toISOString(),
      element: null,
      childButton: null,
      ancestors: [],
      viewport: emptyViewportSnapshot()
    };
  }

  const rect = element.getBoundingClientRect();
  const ancestorElements = getAncestorElements(element);
  const ancestors = ancestorElements.map(captureAncestorSnapshot);
  const centerPoint = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const centerIsInsideViewport = centerPoint.x >= 0 && centerPoint.x <= window.innerWidth && centerPoint.y >= 0 && centerPoint.y <= window.innerHeight;
  const elementsAtPoint = centerIsInsideViewport ? document.elementsFromPoint(centerPoint.x, centerPoint.y) : [];
  const topElement = elementsAtPoint[0];
  const clippingAncestors = ancestorElements.filter((ancestor) => {
    const style = getComputedStyle(ancestor);
    if (!isClippingOverflow(style)) {
      return false;
    }
    return !containsRect(serializeRect(ancestor.getBoundingClientRect()), serializeRect(rect));
  }).map(describeElement);

  return {
    selector,
    measuredAt: new Date().toISOString(),
    element: captureElementSnapshot(element),
    childButton: captureButtonSnapshot(element.querySelector("button")),
    ancestors,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      fullyInsideViewport: containsRect({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight }, rect),
      partiallyOutsideViewport: rect.left < 0 || rect.top < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight,
      clippedByAncestor: clippingAncestors.length > 0,
      clippingAncestors,
      occludedByAnotherElement: Boolean(topElement && topElement !== element && !element.contains(topElement)),
      centerPoint,
      elementsFromPoint: elementsAtPoint.slice(0, 8).map(describeElement)
    }
  };
}

function captureElementSnapshot(element: UserMediaElement): ElementSnapshot {
  const htmlElement = element as HTMLElement;
  return {
    tagName: element.tagName,
    id: element.id,
    className: htmlElement.className,
    boundingClientRect: serializeRect(element.getBoundingClientRect()),
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    offsetWidth: element.offsetWidth,
    offsetHeight: element.offsetHeight,
    computedStyle: captureElementStyle(element)
  };
}

function captureButtonSnapshot(button: Element | null): ButtonSnapshot | null {
  if (!(button instanceof HTMLButtonElement)) {
    return null;
  }
  return {
    tagName: button.tagName,
    text: button.textContent?.trim() ?? "",
    boundingClientRect: serializeRect(button.getBoundingClientRect()),
    computedStyle: captureElementStyle(button)
  };
}

function captureElementStyle(element: Element): ElementStyleSnapshot {
  const style = getComputedStyle(element);
  return {
    display: style.display,
    position: style.position,
    width: style.width,
    height: style.height,
    minWidth: style.minWidth,
    minHeight: style.minHeight,
    maxWidth: style.maxWidth,
    maxHeight: style.maxHeight,
    margin: style.margin,
    padding: style.padding,
    opacity: style.opacity,
    visibility: style.visibility,
    overflow: style.overflow,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
    transform: style.transform,
    filter: style.filter,
    clipPath: style.clipPath,
    zIndex: style.zIndex,
    pointerEvents: style.pointerEvents,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    color: style.color,
    backgroundColor: style.backgroundColor,
    border: style.border,
    outline: style.outline,
    outlineOffset: style.outlineOffset
  };
}

function getAncestorElements(element: Element): Element[] {
  const ancestors: Element[] = [];
  let ancestor = element.parentElement;
  while (ancestor) {
    ancestors.push(ancestor);
    if (ancestor === document.body) {
      break;
    }
    ancestor = ancestor.parentElement;
  }
  return ancestors;
}

function captureAncestorSnapshot(ancestor: Element): AncestorSnapshot {
  const style = getComputedStyle(ancestor);
  return {
    tagName: ancestor.tagName,
    id: ancestor.id,
    className: typeof ancestor.className === "string" ? ancestor.className : "",
    boundingClientRect: serializeRect(ancestor.getBoundingClientRect()),
    display: style.display,
    position: style.position,
    width: style.width,
    height: style.height,
    overflow: style.overflow,
    opacity: style.opacity,
    transform: style.transform,
    filter: style.filter,
    clipPath: style.clipPath,
    zIndex: style.zIndex
  };
}

function isClippingOverflow(style: CSSStyleDeclaration): boolean {
  return [style.overflow, style.overflowX, style.overflowY].some((value) => value === "hidden" || value === "clip" || value === "scroll" || value === "auto");
}

function containsRect(container: RectSnapshot, target: RectSnapshot): boolean {
  return target.left >= container.left && target.top >= container.top && target.right <= container.right && target.bottom <= container.bottom;
}

function serializeRect(rect: DOMRect): RectSnapshot {
  return {
    left: round(rect.left),
    top: round(rect.top),
    right: round(rect.right),
    bottom: round(rect.bottom),
    width: round(rect.width),
    height: round(rect.height)
  };
}

function describeElement(element: Element): string {
  const htmlElement = element as HTMLElement;
  const id = htmlElement.id ? `#${htmlElement.id}` : "";
  const className = typeof htmlElement.className === "string" && htmlElement.className.trim()
    ? `.${htmlElement.className.trim().split(/\s+/).join(".")}`
    : "";
  return `${element.tagName.toLowerCase()}${id}${className}`;
}

function emptyViewportSnapshot(): UserMediaLayoutSnapshot["viewport"] {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    fullyInsideViewport: false,
    partiallyOutsideViewport: false,
    clippedByAncestor: false,
    clippingAncestors: [],
    occludedByAnotherElement: false,
    centerPoint: null,
    elementsFromPoint: []
  };
}

function formatMinimalStatus(status: MinimalStatus): string {
  switch (status) {
    case "idle": return "idle";
    case "requesting": return "requesting";
    case "stream-obtained": return "stream obtained; tracks stopped";
    case "error": return "error";
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
