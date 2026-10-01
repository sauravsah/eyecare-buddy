import { Eye, MoonStar, Sparkles } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";

export function VisualResetView() {
  return (
    <div className="view-stack">
      <section className="reset-intro">
        <div className="reset-intro-orb" aria-hidden="true"><Sparkles size={24} /></div>
        <p className="eyebrow eyebrow--lavender">Visual Reset</p>
        <h1>A softer landing for your eyes.</h1>
        <p>Short guided resets will live here—made for the space between deep work and your next thing.</p>
      </section>
      <EmptyState
        icon={<Eye size={23} />}
        eyebrow="Coming in the next milestone"
        title="Your reset space is ready"
        description="Guided visual resets will be available once the monitoring foundation is connected. No session has been started yet."
      />
      <section className="reset-preview-grid">
        <div className="mini-feature-card">
          <MoonStar size={18} />
          <strong>Low-stimulation</strong>
          <span>Quiet prompts for a busy day.</span>
        </div>
        <div className="mini-feature-card">
          <Sparkles size={18} />
          <strong>Easy to return to</strong>
          <span>Small enough to make a habit.</span>
        </div>
      </section>
    </div>
  );
}
