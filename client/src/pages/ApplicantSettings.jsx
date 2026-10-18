import Settings from "./Settings.jsx";
import useAuthenticatedSettings from "../services/useAuthenticatedSettings.js";

export default function ApplicantSettings({ api, accountId, active, onProfile, onLogout, logoutPending, logoutError, warning }) {
  const { state, save, retry } = useAuthenticatedSettings({ api, accountId, active, onProfile });
  // Shared authenticated settings stay mounted during role navigation so unsaved drafts remain intact.
  return <div hidden={!active}>
    {state.settings && <div className="content-container">
      {state.loading && <p role="status">Refreshing settings...</p>}
      {state.error && <p role="alert">{state.error} <button className="button button--secondary" onClick={() => retry()}>Retry settings</button></p>}
    </div>}
    {state.settings ? <Settings settings={state.settings} onSave={save} preview={false} loading={state.loading} /> : <main className="content-container settings-page">
      <h1>Settings</h1>
      {state.loading && <p role="status">Loading settings...</p>}
      {state.error && <p role="alert">{state.error} <button className="button" onClick={() => retry()}>Retry</button></p>}
    </main>}
    <section className="content-container settings-account" aria-labelledby="settings-account-title"><div className="card">
      <h2 id="settings-account-title">Account</h2>
      {warning && <p role="status">{warning}</p>}
      {logoutError && <p role="alert">{logoutError}</p>}
      <button type="button" className="button button--secondary" disabled={logoutPending} onClick={onLogout}>{logoutPending ? "Logging out..." : "Log out"}</button>
    </div></section>
  </div>;
}
