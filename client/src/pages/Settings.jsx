import { useEffect, useRef, useState } from "react";
import { settingsChanged, validateSettings } from "../services/previewSettings.js";
import "../styles/settings.css";
import { rebaseSettingsDraft } from "../services/draftSync.js";

export default function Settings({ settings, onSave, loadError, preview = true, loading = false, mentorAccount = false, onEditState }) {
  const [draft, setDraft] = useState(() => ({ ...settings, notificationPreferences: { ...settings.notificationPreferences } }));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const form = useRef(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const saved = useRef(settings);
  useEffect(() => {
    const previous = saved.current;
    saved.current = settings;
    setDraft((current) => rebaseSettingsDraft(current, previous, settings));
  }, [settings]);
  const dirty = settingsChanged(draft, settings);
  useEffect(() => { onEditState?.({ dirty, pending }); }, [dirty, pending, onEditState]);
  const Root = mentorAccount ? "div" : "main";
  function change(event) {
    const { name, value } = event.target;
    setDraft((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
    setMessage("");
  }
  async function submit(event) {
    event.preventDefault();
    if (!dirty || submitting.current || loading) return;
    const nextErrors = validateSettings(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage(""); form.current.elements.namedItem(Object.keys(nextErrors)[0]).focus(); return;
    }
    submitting.current = true; setPending(true); setMessage(""); setSaveError("");
    try {
      const result = await onSave(draft);
      if (result.error) { setSaveError(result.error); return; }
      setDraft(result.settings);
      setMessage(preview ? "Preview settings saved in this browser. No server settings or email delivery were changed." : "Settings saved to your account.");
    } catch (failure) { setSaveError(`${failure.message} Your draft is still unsaved; please try again.`); }
    finally { submitting.current = false; setPending(false); }
  }
  return <Root className={mentorAccount ? "settings-page mentor-account-fields" : "content-container settings-page"}>
    {!mentorAccount && <h1>Settings</h1>}
    <p className="settings-preview-note">{preview ? "Development preview profile — use fictional details. " : ""}{mentorAccount ? "Email and role are read-only; you can update your name below." : "Email and role are read-only; save your name and notification preferences below."}</p>
    {loadError && <p role="status">{loadError}</p>}
    <form ref={form} onSubmit={submit} noValidate className={`settings-panels${mentorAccount ? " settings-panels--mentor" : ""}`} aria-busy={pending || loading}>
      <section className="card" aria-labelledby="profile-title">
        <h2 id="profile-title">Profile</h2>
        {[{ name: "name", label: "Full name", type: "text" }, { name: "email", label: "Email address", type: "email" }].map(({ name, label, type }) =>
          <div className="settings-field" key={name}><label htmlFor={`settings-${name}`}>{label}</label>
            <input id={`settings-${name}`} name={name} type={type} value={draft[name]} onChange={name === "name" ? change : undefined} readOnly={name === "email" || pending} required
              autoComplete={name === "name" ? "name" : "email"} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `settings-${name}-error` : undefined} />
            {errors[name] && <p id={`settings-${name}-error`} className="application-error" role="alert">{errors[name]}</p>}
          </div>)}
        <div className="settings-field"><label htmlFor="settings-role">Role</label><input id="settings-role" value={draft.role.charAt(0).toUpperCase() + draft.role.slice(1)} readOnly /></div>
        <button type="submit" className="button" disabled={!dirty || pending || loading}>{pending ? "Saving..." : "Save Changes"}</button>
        <p className="settings-draft-status">{dirty ? "You have unsaved changes." : "No unsaved changes."}</p>
        <p role="status">{message}</p>
        {saveError && <p role="alert">{saveError}</p>}
      </section>
      <section className="card" aria-labelledby="notifications-title">
        <h2 id="notifications-title">Notification Preferences</h2>
        {mentorAccount ? <p>No mentor-specific notification preferences are currently supported.</p> : <>{[{ name: "deadlineReminders", label: "Deadline email reminders" }, { name: "mentorFeedback", label: "Email me when a mentor leaves feedback" }].map(({ name, label }) =>
          <label className="settings-switch-row" key={name} htmlFor={`settings-${name}`}><span>{label}</span>
            <input id={`settings-${name}`} name={name} className="settings-switch" type="checkbox" role="switch" checked={draft.notificationPreferences[name]} disabled={pending}
              onChange={(event) => { const checked = event.target.checked; setDraft((previous) => ({ ...previous, notificationPreferences: { ...previous.notificationPreferences, [name]: checked } })); setMessage(""); }} />
          </label>)}
        <p className="settings-preview-note">{preview ? "Both preferences are saved with Save Changes. These browser-only preferences do not enable server emails or change individual application reminders." : "Both preferences are saved with Save Changes. Individual application reminder choices stay unchanged. Email delivery also depends on the server email service; deadline reminders require the application's reminder preference to be on."}</p></>}
      </section>
    </form>
  </Root>;
}
