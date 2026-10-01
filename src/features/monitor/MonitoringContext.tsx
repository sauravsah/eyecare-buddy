import type { ReactNode } from "react";
import { useCameraMonitor } from "./useCameraMonitor";
import { MonitoringContext } from "./monitoring-context";

export function MonitoringProvider({ children }: { children: ReactNode }) {
  const monitor = useCameraMonitor();
  return <MonitoringContext.Provider value={monitor}>{children}</MonitoringContext.Provider>;
}
