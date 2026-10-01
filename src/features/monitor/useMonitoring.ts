import { useContext } from "react";
import { MonitoringContext } from "./monitoring-context";
import type { CameraMonitorResult } from "./useCameraMonitor";

export function useMonitoring(): CameraMonitorResult {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error("useMonitoring must be used inside a MonitoringProvider.");
  }
  return context;
}
