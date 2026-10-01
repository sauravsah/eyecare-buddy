import { ArrowUpRight, Camera, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "../../components/Button";
import type { AppRoute } from "../../domain/types";
import { useMonitoring } from "../monitor/useMonitoring";

interface DashboardViewProps {
  onNavigate: (route: AppRoute) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { state } = useMonitoring();
  const isMonitoring = state.isMonitoring;

  return (
    <div className="view-stack">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow eyebrow--mint">Your screen day, with more ease</p>
          <h1>Make room for a little more <span>wellbeing.</span></h1>
          <p>Small reminders. Clearer awareness. A screen routine that works with your day.</p>
        </div>
        <div className="hero-spark" aria-hidden="true"><Sparkles size={22} /></div>
      </section>

      <section className="surface-card status-card">
        <div className="card-heading-row">
          <div>
            <p className="eyebrow">Setup status</p>
            <h2>{isMonitoring ? "Monitoring is active" : "Ready when you are"}</h2>
          </div>
          <span className="badge badge--soft">{isMonitoring ? "On-device active" : "Foundation ready"}</span>
        </div>
        <div className="setup-progress" aria-label="Setup progress: 1 of 2 complete">
          <span className="setup-progress-fill" />
        </div>
        <div className="setup-status-row">
          <span className="setup-status-icon setup-status-icon--done">✓</span>
          <div><strong>Personal space created</strong><span>Preferences are stored locally.</span></div>
          <span className="setup-status-label">Done</span>
        </div>
        <div className="setup-status-row">
          <span className="setup-status-icon"><Camera size={15} /></span>
          <div><strong>Live monitor connection</strong><span>{isMonitoring ? "Local camera and face tracking are active." : "Enable local camera monitoring when you are ready."}</span></div>
          <span className={`setup-status-label ${isMonitoring ? "" : "setup-status-label--muted"}`}>{isMonitoring ? "Live" : "Next"}</span>
        </div>
      </section>

      <section className="section-heading-row">
        <div><p className="eyebrow">Your workspace</p><h2>Start with a clean slate</h2></div>
        <span className="neutral-count">No data yet</span>
      </section>

      <section className="surface-card empty-dashboard-card">
        <div className="empty-dashboard-icon"><LockKeyhole size={20} /></div>
        <div>
          <h3>Your insights will build here</h3>
          <p>Once monitoring is available, your screen-health signals and gentle patterns will stay on this device.</p>
        </div>
        <Button variant="secondary" icon={<ArrowUpRight size={16} />} onClick={() => onNavigate("monitor")}>
          Open monitor
        </Button>
      </section>

      <section className="feature-grid" aria-label="Coming capabilities">
        <article className="feature-tile feature-tile--mint">
          <span className="tile-icon"><Camera size={18} /></span>
          <span className="tile-kicker">Next milestone</span>
          <h3>Local awareness</h3>
          <p>Landmark-based signals, processed on-device.</p>
        </article>
        <article className="feature-tile feature-tile--lavender">
          <span className="tile-icon"><Sparkles size={18} /></span>
          <span className="tile-kicker">Always gentle</span>
          <h3>Thoughtful resets</h3>
          <p>Short visual breaks designed around real workdays.</p>
        </article>
      </section>
    </div>
  );
}
