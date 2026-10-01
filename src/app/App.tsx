import { useEffect } from "react";
import { StateScreen } from "../components/StateScreen";
import type { AppRoute, UserSettings } from "../domain/types";
import { DashboardView } from "../features/dashboard/DashboardView";
import { InsightsView } from "../features/insights/InsightsView";
import { LiveMonitorView } from "../features/monitor/LiveMonitorView";
import { MonitoringProvider } from "../features/monitor/MonitoringContext";
import { OnboardingShell } from "../features/onboarding/OnboardingShell";
import { VisualResetView } from "../features/reset/VisualResetView";
import { SettingsView } from "../features/settings/SettingsView";
import { useHashRoute } from "../shared/hooks/useHashRoute";
import { useSettings } from "../shared/hooks/useSettings";
import { AppShell } from "./components/AppShell";

function App() {
  const [route, navigate] = useHashRoute();
  const { settings, isLoading, error, reload, updateSettings } = useSettings();

  useEffect(() => {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const resolvedTheme = settings.theme === "system"
      ? (prefersLight ? "light" : "dark")
      : settings.theme;
    document.documentElement.dataset.theme = resolvedTheme;
  }, [settings.theme]);

  if (isLoading) {
    return <StateScreen kind="loading" title="Setting up your space" description="Loading your local preferences…" />;
  }

  if (error) {
    return <StateScreen kind="error" title="Your space needs a refresh" description={error} onRetry={reload} />;
  }

  if (!settings.onboardingComplete) {
    return <OnboardingShell onComplete={async () => updateSettings({ onboardingComplete: true })} />;
  }

  return (
    <MonitoringProvider>
      <AppShell route={route} onNavigate={navigate}>
        <RouteView route={route} settings={settings} onNavigate={navigate} onUpdateSettings={updateSettings} />
      </AppShell>
    </MonitoringProvider>
  );
}

interface RouteViewProps {
  route: AppRoute;
  settings: UserSettings;
  onNavigate: (route: AppRoute) => void;
  onUpdateSettings: (patch: Partial<UserSettings>) => Promise<void>;
}

function RouteView({ route, settings, onNavigate, onUpdateSettings }: RouteViewProps) {
  switch (route) {
    case "monitor":
      return <LiveMonitorView onNavigate={onNavigate} settings={settings} />;
    case "reset":
      return <VisualResetView />;
    case "insights":
      return <InsightsView />;
    case "settings":
      return <SettingsView settings={settings} onUpdateSettings={onUpdateSettings} onNavigate={onNavigate} />;
    case "dashboard":
    default:
      return <DashboardView onNavigate={onNavigate} />;
  }
}

export default App;
