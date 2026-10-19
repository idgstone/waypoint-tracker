import { useEffect, useRef, useState } from "react";
import ActionNotice, { useActionNotice } from "./ActionNotice.jsx";
import useAuthenticatedSettings from "../services/useAuthenticatedSettings.js";
import "../styles/settings.css";

export default function MentorAccountPanel({ api, user, onProfile, onClose, onLogout, logoutPending, logoutError, warning }) {
  const { state, save, retry } = useAuthenticatedSettings({ api, accountId: user.id, active: true, onProfile });
  const [name, setName] = useState(user.name);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, showNotice, dismissNotice] = useActionNotice();
  const [discardAction, setDiscardAction] = useState(null);
  const dialog = useRef(null), nameInput = useRef(null), keepEditing = useRef(null);
  const previousName = useRef(user.name), returnFocus = useRef(null), locked = useRef(false);
  const alive = useRef(false), backdropPress = useRef(false);
  const profile = state.settings || user;
  const dirty = name.trim() !== profile.name;
  const invalid = !name.trim();
  const busy = saving || logoutPending;
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current;
    alive.current = true;
    element.showModal(); nameInput.current.focus();
    return () => { alive.current = false; element.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  useEffect(() => {
    if (!state.settings) return;
    const previous = previousName.current;
    previousName.current = state.settings.name;
    setName((draft) => draft === previous ? state.settings.name : draft);
  }, [state.settings]);
  useEffect(() => { if (discardAction) keepEditing.current?.focus(); }, [discardAction]);
  function continueEditing() {
    setDiscardAction(null);
    requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); nameInput.current?.focus(); });
  }
  function act(action) {
    if (locked.current || busy) return;
    if (dirty) { returnFocus.current = document.activeElement; setDiscardAction(action); return; }
    if (action === "logout") onLogout(); else onClose();
  }
  function outside(event) {
    const rect = dialog.current.getBoundingClientRect();
    return event.target === dialog.current && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  }
  function trap(event) {
    if (event.key !== "Tab") return;
    const scope = discardAction ? dialog.current.querySelector(".mentor-account-discard") : dialog.current;
    const controls = [...scope.querySelectorAll("button, input, [tabindex='0']")].filter((element) => !element.disabled && element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  async function submit(event) {
    event.preventDefault(); setTouched(true);
    if (locked.current || busy || invalid || !dirty || !state.settings || state.loading) return;
    locked.current = true; setSaving(true); setSaveError(""); dismissNotice();
    try {
      const result = await save({ ...state.settings, name });
      if (alive.current) { setName(result.settings.name); showNotice("Changes saved"); }
    } catch (failure) { if (alive.current) setSaveError(`${failure.message} Your changes have not been confirmed. Your draft is retained.`); }
    finally { locked.current = false; if (alive.current) setSaving(false); }
  }
  return <dialog ref={dialog} className="mentor-account-panel" aria-labelledby="mentor-account-title" onKeyDown={trap}
    onPointerDown={(event) => { backdropPress.current = outside(event); }} onClick={(event) => { if (backdropPress.current && outside(event)) act("close"); backdropPress.current = false; }}
    onCancel={(event) => { event.preventDefault(); if (discardAction) continueEditing(); else act("close"); }}>
    <header className="mentor-account-panel__header"><h2 id="mentor-account-title">Mentor account</h2><button type="button" className="button button--secondary" aria-label="Close mentor account" aria-disabled={busy} onClick={() => act("close")}>Close</button></header>
    {discardAction && <section className="mentor-account-discard" role="alertdialog" aria-modal="true" aria-labelledby="mentor-discard-title" aria-describedby="mentor-discard-description">
      <h3 id="mentor-discard-title">Discard unsaved changes?</h3><p id="mentor-discard-description">Your name edits will be lost{discardAction === "logout" ? " when you log out" : " when you close this panel"}.</p>
      <button ref={keepEditing} type="button" className="button button--secondary" onClick={continueEditing}>Keep editing</button> <button type="button" className="button" onClick={() => { if (locked.current || busy) return; if (discardAction === "logout") { setDiscardAction(null); onLogout(); } else onClose(); }}>Discard</button>
    </section>}
    <div inert={discardAction ? "" : undefined}>
      {warning && <p role="status">{warning}</p>}
      {state.loading && <p role="status">Loading account...</p>}
      {state.error && <p role="alert">{state.error} <button type="button" className="button button--secondary" onClick={retry}>Retry settings</button></p>}
      <form onSubmit={submit} noValidate aria-busy={saving || state.loading} className="mentor-account-form">
        <div className="settings-field"><label htmlFor="mentor-account-name">Full name</label><input ref={nameInput} id="mentor-account-name" name="name" autoComplete="name" value={name} required readOnly={busy || !state.settings} aria-invalid={touched && invalid} aria-describedby={touched && invalid ? "mentor-name-error" : undefined} onBlur={() => setTouched(true)} onChange={(event) => { setName(event.target.value); dismissNotice(); }} />
          {touched && invalid && <p id="mentor-name-error" role="alert">Enter your full name.</p>}</div>
        <div className="settings-field"><label htmlFor="mentor-account-email">Email</label><input id="mentor-account-email" type="email" value={profile.email} readOnly /></div>
        <div className="settings-field"><label htmlFor="mentor-account-role">Role</label><input id="mentor-account-role" value={profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} readOnly /></div>
        <button type="submit" className="button" disabled={!dirty || invalid || busy || state.loading || !state.settings}>{saving ? "Saving..." : "Save Changes"}</button>
        <p className="settings-draft-status">{dirty ? "You have unsaved changes." : "No unsaved changes."}</p>
        <ActionNotice notice={notice} onDismiss={dismissNotice} />
        {saveError && <p role="alert">{saveError}</p>}
      </form>
      <section className="mentor-account-section" aria-labelledby="mentor-account-actions"><h3 id="mentor-account-actions">Account</h3>
        {logoutError && <p role="alert">{logoutError}</p>}
        <button type="button" className="button button--secondary" disabled={busy} onClick={() => act("logout")}>{logoutPending ? "Logging out..." : "Log out"}</button>
      </section>
      {busy && <p role="status">Please wait for the current request before closing.</p>}
    </div>
  </dialog>;
}
