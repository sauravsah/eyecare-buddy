import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

interface StateScreenProps {
  kind: "loading" | "error";
  title: string;
  description: string;
  onRetry?: () => void;
}

export function StateScreen({
  kind,
  title,
  description,
  onRetry
}: StateScreenProps) {
  return (
    <main className="state-screen">
      <div className={`state-icon state-icon--${kind}`}>
        {kind === "loading" ? (
          <LoaderCircle className="spin" size={24} />
        ) : (
          <AlertCircle size={24} />
        )}
      </div>
      <p className="eyebrow">EyeCare Buddy</p>
      <h1>{title}</h1>
      <p className="state-description">{description}</p>
      {kind === "error" && onRetry && (
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </main>
  );
}
