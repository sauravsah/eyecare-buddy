import { Bell, Camera, Check, ChevronRight, CloudOff, Leaf, Monitor, Moon, Palette, ScanFace, Sun } from "lucide-react";
import type { ReactNode } from "react";
import type { ThemePreference, UserSettings } from "../../domain/types";
import { useMonitoring } from "../monitor/useMonitoring";
import type { MonitoringStatus } from "../../vision/types";

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  onNavigate: (route: "monitor") => void;
}

export function SettingsView({ settings, onUpdateSettings, onNavigate }: SettingsViewProps) {
  const { state: monitorState, stop } = useMonitoring();
  function update(patch: Partial<UserSettings>): void {
    void onUpdateSettings(patch).catch(() => undefined);
  }

  return (
    <div className="view-stack">
      <div className="page-intro">
        <p className="eyebrow">Settings</p>
        <h1>Make it feel like yours.</h1>
        <p className="page-description">Simple controls, local preferences, and clear boundaries.</p>
      </div>

      <section className="settings-group">
        <p className="settings-group-label">Preferences</p>
        <div className="surface-card settings-card">
          <SettingRow icon={<Bell size={17} />} title="Gentle reminders" description="Allow future break prompts." control={<Toggle checked={settings.notificationsEnabled} onChange={() => update({ notificationsEnabled: !settings.notificationsEnabled })} />} />
          <SettingRow icon={<Leaf size={17} />} title="Outdoor-time habit" description="Keep an optional outdoor habit when tracking arrives." control={<Toggle checked={settings.outdoorHabitEnabled} onChange={() => update({ outdoorHabitEnabled: !settings.outdoorHabitEnabled })} />} />
          <SettingRow icon={<ScanFace size={17} />} title="Tracking details" description="Show local FPS, confidence, and signal diagnostics in Live Monitor." control={<Toggle checked={settings.trackingDetailsEnabled} onChange={() => update({ trackingDetailsEnabled: !settings.trackingDetailsEnabled })} ariaLabel="Show tracking details" />} />
        </div>
      </section>

      <section className="settings-group">
        <p className="settings-group-label">Appearance</p>
        <div className="surface-card settings-card">
          <div className="setting-row setting-row--stacked">
            <div className="setting-row-main"><span className="setting-icon"><Palette size={17} /></span><div><strong>Theme</strong><span>Choose a comfortable visual tone.</span></div></div>
            <div className="theme-options" role="group" aria-label="Theme preference">
              <ThemeOption value="system" label="System" icon={<Monitor size={14} />} selected={settings.theme} onSelect={(theme) => update({ theme })} />
              <ThemeOption value="light" label="Light" icon={<Sun size={14} />} selected={settings.theme} onSelect={(theme) => update({ theme })} />
              <ThemeOption value="dark" label="Dark" icon={<Moon size={14} />} selected={settings.theme} onSelect={(theme) => update({ theme })} />
            </div>
          </div>
        </div>
      </section>

      <section className="settings-group">
        <p className="settings-group-label">Monitor setup</p>
        <div className="surface-card settings-card">
          <div className="setting-row setting-row--static">
            <span className="setting-icon"><Camera size={17} /></span>
            <div className="setting-row-main"><div><strong>Camera</strong><span>{getCameraDescription(monitorState.status, monitorState.isMonitoring)}</span></div></div>
            <button className="setting-action" type="button" disabled={isCameraStarting(monitorState.status)} onClick={() => {
              if (monitorState.isMonitoring) {
                stop();
              } else {
                onNavigate("monitor");
              }
            }}>{getCameraActionLabel(monitorState.status, monitorState.isMonitoring)}</button>
          </div>
          <div className="setting-row setting-row--static">
            <span className="setting-icon"><Check size={17} /></span>
            <div className="setting-row-main"><div><strong>Calibration</strong><span>Distance estimate calibration is not available yet.</span></div></div>
            <ChevronRight size={16} className="setting-chevron" />
          </div>
        </div>
      </section>

      <section className="privacy-card">
        <CloudOff size={18} />
        <div><strong>Local-only foundation</strong><span>Settings, calibration, and future metrics use chrome.storage.local.</span></div>
      </section>
    </div>
  );
}

interface SettingRowProps {
  icon: ReactNode;
  title: string;
  description: string;
  control: ReactNode;
}

function SettingRow({ icon, title, description, control }: SettingRowProps) {
  return (
    <div className="setting-row">
      <span className="setting-icon">{icon}</span>
      <div className="setting-row-main"><div><strong>{title}</strong><span>{description}</span></div></div>
      {control}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel?: string;
}

function Toggle({ checked, onChange, ariaLabel }: ToggleProps) {
  return <button className={`toggle ${checked ? "toggle--on" : ""}`} type="button" role="switch" aria-label={ariaLabel} aria-checked={checked} onClick={onChange}><span /></button>;
}

function isCameraStarting(status: MonitoringStatus): boolean {
  return status === "camera-loading" || status === "model-loading";
}

function getCameraActionLabel(status: MonitoringStatus, isMonitoring: boolean): string {
  if (isMonitoring) return "Disable";
  if (isCameraStarting(status)) return "Starting…";
  return "Open monitor";
}

function getCameraDescription(status: MonitoringStatus, isMonitoring: boolean): string {
  if (isMonitoring) return "Monitoring is active and processed locally on this device.";
  if (status === "camera-permission-denied") return "Chrome did not grant camera access. Try again from Live Monitor.";
  if (status === "camera-unavailable") return "No usable camera is available right now.";
  return "Only starts when you choose to enable it; no microphone is requested.";
}

interface ThemeOptionProps {
  value: ThemePreference;
  label: string;
  icon: ReactNode;
  selected: ThemePreference;
  onSelect: (theme: ThemePreference) => void;
}

function ThemeOption({ value, label, icon, selected, onSelect }: ThemeOptionProps) {
  return <button className={`theme-option ${selected === value ? "theme-option--selected" : ""}`} type="button" aria-pressed={selected === value} onClick={() => onSelect(value)}>{icon}<span>{label}</span></button>;
}
