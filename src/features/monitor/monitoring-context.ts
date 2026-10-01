import { createContext } from "react";
import type { CameraMonitorResult } from "./useCameraMonitor";

export const MonitoringContext = createContext<CameraMonitorResult | null>(null);
