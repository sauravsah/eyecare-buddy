import { BarChart3, LockKeyhole, TrendingUp } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { PageIntro } from "../../components/PageIntro";

export function InsightsView() {
  return (
    <div className="view-stack">
      <PageIntro
        eyebrow="Insights"
        title="Notice patterns, not pressure."
        description="Your daily and weekly view will make screen habits easier to understand over time."
      />
      <EmptyState
        icon={<BarChart3 size={23} />}
        eyebrow="No local data yet"
        title="Your first insight is waiting"
        description="Insights will appear after real monitoring sessions are recorded. EyeCare Buddy will never fill this space with made-up metrics."
      />
      <section className="surface-card insight-principles">
        <div className="card-heading-row"><div><p className="eyebrow">How insights will feel</p><h2>Useful, private, human</h2></div><LockKeyhole size={18} /></div>
        <div className="principle-row"><TrendingUp size={17} /><span>See changes in your own rhythm, not a score.</span></div>
        <div className="principle-row"><LockKeyhole size={17} /><span>Keep daily and weekly data on this device.</span></div>
      </section>
    </div>
  );
}
