import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  eyebrow,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
