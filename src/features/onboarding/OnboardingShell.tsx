import { ArrowRight, Camera, Check, LockKeyhole, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { BrandMark } from "../../components/BrandMark";
import type { OnboardingStep } from "../../domain/types";

interface OnboardingShellProps {
  onComplete: () => Promise<void>;
}

export function OnboardingShell({ onComplete }: OnboardingShellProps) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [isSaving, setIsSaving] = useState(false);

  async function finishOnboarding(): Promise<void> {
    setIsSaving(true);
    try {
      await onComplete();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-orbit onboarding-orbit--one" />
      <div className="onboarding-orbit onboarding-orbit--two" />
      <header className="onboarding-header">
        <BrandMark />
        <span className="step-count">{step === "welcome" ? "01" : "02"} / 02</span>
      </header>

      {step === "welcome" ? (
        <section className="onboarding-content onboarding-content--welcome">
          <div className="welcome-art" aria-hidden="true">
            <div className="welcome-art-ring welcome-art-ring--outer" />
            <div className="welcome-art-ring welcome-art-ring--inner" />
            <div className="welcome-art-core"><Sparkles size={26} /></div>
            <span className="art-dot art-dot--one" />
            <span className="art-dot art-dot--two" />
            <span className="art-dot art-dot--three" />
          </div>
          <p className="eyebrow">A better screen rhythm</p>
          <h1>Meet your calmer screen day.</h1>
          <p className="onboarding-description">
            EyeCare Buddy helps you build healthier screen habits with gentle, local-first awareness.
          </p>
          <div className="onboarding-points">
            <span><Check size={15} /> Nothing leaves this device</span>
            <span><Check size={15} /> Estimates stay clearly labeled</span>
          </div>
          <Button icon={<ArrowRight size={17} />} onClick={() => setStep("camera")}>
            Start setup
          </Button>
        </section>
      ) : (
        <section className="onboarding-content">
          <div className="onboarding-icon onboarding-icon--camera" aria-hidden="true">
            <Camera size={27} />
          </div>
          <p className="eyebrow">One small setup step</p>
          <h1>Camera awareness, on your terms.</h1>
          <p className="onboarding-description">
            Live monitoring is available when you choose it from the Live Monitor. This setup screen does not request camera access.
          </p>
          <div className="privacy-note">
            <LockKeyhole size={18} />
            <div>
              <strong>Local by design</strong>
              <span>Camera frames will be processed on-device. No uploads, accounts, or API keys.</span>
            </div>
          </div>
          <div className="onboarding-actions">
            <Button variant="ghost" type="button" onClick={() => setStep("welcome")}>
              Back
            </Button>
            <Button icon={<ArrowRight size={17} />} disabled={isSaving} onClick={() => void finishOnboarding()}>
              {isSaving ? "Saving…" : "Continue to dashboard"}
            </Button>
          </div>
        </section>
      )}

      <footer className="onboarding-footer">Built for focused work, study, and everything in between.</footer>
    </main>
  );
}
