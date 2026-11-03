import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Mic,
  Monitor,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Volume2,
} from "lucide-react";

import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import {
  DEFAULT_USER_PREFERENCES,
  readUserPreferences,
  saveUserPreferences,
} from "../data/userPreferences";

function PreferenceToggle({ checked, onChange, icon, title, description }) {
  return (
    <label className="settings-toggle-row">
      <span className="settings-toggle-icon">{icon}</span>
      <span className="settings-toggle-copy"><strong>{title}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="settings-switch" aria-hidden="true" />
    </label>
  );
}

function Settings() {
  const [preferences, setPreferences] = useState(readUserPreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
  }, [preferences.reduceMotion]);

  const updatePreference = (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const handleSave = (event) => {
    event.preventDefault();
    saveUserPreferences(preferences);
    setSaved(true);
  };

  const handleReset = () => {
    setPreferences({ ...DEFAULT_USER_PREFERENCES });
    saveUserPreferences({ ...DEFAULT_USER_PREFERENCES });
    setSaved(true);
  };

  return (
    <DashboardLayout>
      <div className="account-page settings-page">
        <div className="account-page-heading">
          <div>
            <p className="dashboard-eyebrow">PERSONALIZE YOUR WORKSPACE</p>
            <h1>Settings</h1>
            <p>Set your interview defaults and choose how MockMate works during practice.</p>
          </div>
          <span className="settings-heading-icon"><SettingsIcon size={20} />Preferences</span>
        </div>

        {saved && <div className="account-alert success"><CheckCircle2 size={17} />Your preferences are saved on this browser.</div>}

        <form className="settings-layout" onSubmit={handleSave}>
          <div className="settings-main">
            <Card className="account-panel">
              <div className="account-panel-heading">
                <span className="account-panel-icon violet"><Monitor size={18} /></span>
                <div><h2>Interview defaults</h2><p>Preselect these values when you set up a new interview.</p></div>
              </div>
              <div className="settings-select-grid">
                <label className="profile-field">
                  <span>Interview type</span>
                  <select value={preferences.interviewType} onChange={(event) => updatePreference("interviewType", event.target.value)}>
                    <option>Technical</option><option>HR</option><option>Behavioral</option><option>Mixed</option>
                  </select>
                </label>
                <label className="profile-field">
                  <span>Difficulty</span>
                  <select value={preferences.difficulty} onChange={(event) => updatePreference("difficulty", event.target.value)}>
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </label>
                <label className="profile-field">
                  <span>Questions per session</span>
                  <select value={preferences.questionCount} onChange={(event) => updatePreference("questionCount", Number(event.target.value))}>
                    {[5, 10, 15, 20].map((count) => <option value={count} key={count}>{count} questions</option>)}
                  </select>
                </label>
              </div>
            </Card>

            <Card className="account-panel">
              <div className="account-panel-heading">
                <span className="account-panel-icon teal"><Mic size={18} /></span>
                <div><h2>Interview experience</h2><p>Adjust media options used when a live interview starts.</p></div>
              </div>
              <div className="settings-toggle-list">
                <PreferenceToggle
                  checked={preferences.voicePlayback}
                  onChange={(event) => updatePreference("voicePlayback", event.target.checked)}
                  icon={<Volume2 size={17} />}
                  title="Read questions aloud"
                  description="Play interviewer questions using your browser's speech voice."
                />
                <PreferenceToggle
                  checked={preferences.cameraPreview}
                  onChange={(event) => updatePreference("cameraPreview", event.target.checked)}
                  icon={<Eye size={17} />}
                  title="Start with camera preview"
                  description="Request camera access when the live interview screen opens."
                />
              </div>
            </Card>

            <Card className="account-panel">
              <div className="account-panel-heading">
                <span className="account-panel-icon pink"><SettingsIcon size={18} /></span>
                <div><h2>Accessibility</h2><p>Reduce motion effects across MockMate.</p></div>
              </div>
              <div className="settings-toggle-list">
                <PreferenceToggle
                  checked={preferences.reduceMotion}
                  onChange={(event) => updatePreference("reduceMotion", event.target.checked)}
                  icon={<Monitor size={17} />}
                  title="Reduce animations"
                  description="Limit decorative transitions and motion in the interface."
                />
              </div>
            </Card>
          </div>

          <aside className="settings-side">
            <Card className="account-panel settings-summary-card">
              <span className="account-panel-icon violet"><SettingsIcon size={18} /></span>
              <h2>Your practice setup</h2>
              <div className="settings-summary-row"><span>Interview type</span><strong>{preferences.interviewType}</strong></div>
              <div className="settings-summary-row"><span>Difficulty</span><strong>{preferences.difficulty}</strong></div>
              <div className="settings-summary-row"><span>Session length</span><strong>{preferences.questionCount} questions</strong></div>
              <div className="settings-summary-row"><span>Voice playback</span><strong>{preferences.voicePlayback ? "On" : "Off"}</strong></div>
            </Card>
            <div className="settings-form-actions">
              <button type="button" className="account-secondary-action" onClick={handleReset}><RotateCcw size={15} />Reset defaults</button>
              <button type="submit" className="dashboard-primary-action"><Save size={15} />Save settings</button>
            </div>
          </aside>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default Settings;
