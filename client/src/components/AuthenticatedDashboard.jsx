import MentorAccountPanel from "./MentorAccountPanel.jsx";
import { useState } from "react";
import Header from "./Header.jsx";
import ApplicantBoard from "../pages/ApplicantBoard.jsx";
import ApplicantAnalytics from "../pages/ApplicantAnalytics.jsx";
import ApplicantMentors from "../pages/ApplicantMentors.jsx";
import ApplicantSettings from "../pages/ApplicantSettings.jsx";
import AuthenticatedMentorDashboard from "../pages/AuthenticatedMentorDashboard.jsx";
import AuthenticatedAdminDashboard from "../pages/AuthenticatedAdminDashboard.jsx";

// Authenticated navigation deliberately never mounts fixture-backed preview dashboards.
export default function AuthenticatedDashboard({ user, api, onLogout, onProfile, warning, page, onNavigate }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await onLogout(); }
    catch (failure) { setError(`${failure.message} You are still signed in; retry Log out to end the server session.`); }
    finally { setBusy(false); }
  }
  return <>
    <Header variant={user.role} activePage={page} onNavigate={onNavigate} userInitial={Array.from(user.name.trim())[0]?.toUpperCase() || "?"} accountControl={user.role === "mentor" ? <button type="button" className="site-header__avatar mentor-account-trigger" aria-label={`Account settings for ${user.name}`} aria-haspopup="dialog" aria-expanded={accountOpen} onClick={() => setAccountOpen(true)}>{Array.from(user.name.trim())[0]?.toUpperCase() || "?"}</button> : undefined} />
    {user.role === "admin" && <div className="content-container">
      <section className="card" aria-labelledby="account-page-title">
        <h2 id="account-page-title">Your account</h2>
        <p>Signed in as {user.name} ({user.role}).</p>
        {warning && <p role="status">{warning}</p>}
        {error && <p role="alert">{error}</p>}
        <button type="button" className="button" disabled={busy} onClick={logout}>{busy ? "Logging out…" : "Log out"}</button>
      </section>
    </div>}
    {user.role === "applicant" && <ApplicantBoard api={api} active={page === "board"} onMentors={() => onNavigate("mentors")} />}
    {user.role === "applicant" && page === "analytics" && <ApplicantAnalytics api={api} />}
    {user.role === "applicant" && page === "mentors" && <ApplicantMentors api={api} onBackToBoard={() => onNavigate("board")} />}
    {user.role === "applicant" && <ApplicantSettings api={api} accountId={user.id} active={page === "settings"} onProfile={onProfile} onLogout={logout} logoutPending={busy} logoutError={error} warning={warning} />}
    {user.role === "mentor" && accountOpen && <MentorAccountPanel api={api} user={user} onProfile={onProfile} onClose={() => setAccountOpen(false)} onLogout={logout} logoutPending={busy} logoutError={error} warning={warning} />}
    {user.role === "mentor" && <AuthenticatedMentorDashboard api={api} user={user} page={page} onNavigate={onNavigate} />}
    {user.role === "admin" && <AuthenticatedAdminDashboard api={api} user={user} page={page} />}
  </>;
}
