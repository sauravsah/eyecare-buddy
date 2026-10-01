export function clearTrackingOverlay(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
}
