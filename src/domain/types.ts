export const APP_ROUTES = [
  "dashboard",
  "monitor",
  "reset",
  "insights",
  "settings"
] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

export type ThemePreference = "system" | "light" | "dark";

export type OnboardingStep = "welcome" | "camera";

export interface UserSettings {
  onboardingComplete: boolean;
  theme: ThemePreference;
  notificationsEnabled: boolean;
  outdoorHabitEnabled: boolean;
  trackingDetailsEnabled: boolean;
}

export interface CalibrationProfile {
  status: "not_started" | "ready";
  referenceObject?: "credit_card" | "a4_paper";
  updatedAt?: string;
}

export interface DailyMetrics {
  date: string;
  focusMinutes: number;
  breakCount: number;
  blinkEvents: number;
  outdoorMinutes?: number;
}

export interface WeeklyInsight {
  weekStarting: string;
  summary: string;
  supportingMetrics: string[];
}

export interface StorageSchema {
  settings: UserSettings;
  calibration: CalibrationProfile;
  dailyMetrics: Record<string, DailyMetrics>;
  weeklyInsights: WeeklyInsight[];
}

export type StorageKey = keyof StorageSchema;
