import {
  BarChart3,
  Camera,
  LayoutDashboard,
  Settings2,
  Sparkles
} from "lucide-react";
import type { ReactNode } from "react";
import type { AppRoute } from "../../domain/types";
import { BrandMark } from "../../components/BrandMark";

interface AppShellProps {
  children: ReactNode;
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

const NAV_ITEMS: Array<{ route: AppRoute; label: string; icon: typeof LayoutDashboard }> = [
  { route: "dashboard", label: "Home", icon: LayoutDashboard },
  { route: "monitor", label: "Monitor", icon: Camera },
  { route: "reset", label: "Reset", icon: Sparkles },
  { route: "insights", label: "Insights", icon: BarChart3 },
  { route: "settings", label: "Settings", icon: Settings2 }
];

const PAGE_LABELS: Record<AppRoute, string> = {
  dashboard: "Today",
  monitor: "Live Monitor",
  reset: "Visual Reset",
  insights: "Insights",
  settings: "Settings"
};

export function AppShell({
  children,
  route,
  onNavigate
}: AppShellProps) {
  return (
    <div className={`app-shell ${route === "monitor" ? "app-shell--monitor" : ""}`}>
      <div className="ambient-orb ambient-orb--one" />
      <div className="ambient-orb ambient-orb--two" />
      <header className="topbar">
        <BrandMark />
        <div className="topbar-meta">
          <span className="local-status">
            <span className="status-dot" aria-hidden="true" />
            Local-first
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="Open settings"
            onClick={() => onNavigate("settings")}
          >
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <div className="shell-heading">
        <span>{PAGE_LABELS[route]}</span>
        <span className="shell-heading-line" aria-hidden="true" />
      </div>

      <main className="app-content">{children}</main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map(({ route: itemRoute, label, icon: Icon }) => (
          <button
            className={`nav-item ${route === itemRoute ? "nav-item--active" : ""}`}
            key={itemRoute}
            type="button"
            aria-current={route === itemRoute ? "page" : undefined}
            onClick={() => onNavigate(itemRoute)}
          >
            <span className="nav-icon"><Icon size={18} strokeWidth={route === itemRoute ? 2.4 : 1.9} /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
