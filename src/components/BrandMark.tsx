import { Eye } from "lucide-react";

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <Eye size={19} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="brand-name">
          EyeCare <em>Buddy</em>
        </span>
      )}
    </div>
  );
}
