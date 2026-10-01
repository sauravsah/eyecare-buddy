import type { StorageSchema } from "../../domain/types";

export const DEFAULT_STORAGE: StorageSchema = {
  settings: {
    onboardingComplete: false,
    theme: "system",
    notificationsEnabled: true,
    outdoorHabitEnabled: false,
    trackingDetailsEnabled: false
  },
  calibration: {
    status: "not_started"
  },
  dailyMetrics: {},
  weeklyInsights: []
};
