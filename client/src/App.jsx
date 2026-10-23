import { useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Welcome from "./pages/Welcome.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import Board from "./pages/Board.jsx";
import Analytics from "./pages/Analytics.jsx";
import Mentors from "./pages/Mentors.jsx";
import Settings from "./pages/Settings.jsx";
import { editableSettingsUpdate, loadPreviewSettings, savePreviewSettings } from "./services/previewSettings.js";
import MentorDashboard from "./pages/MentorDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import { createPreviewInvitation, loadPreviewMentors, savePreviewMentors } from "./services/previewMentors.js";
import { localDate } from "./data/applicationStages.js";
import { createSampleApplications, loadPreviewApplications, savePreviewApplications } from "./services/previewStorage.js";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import useSession from "./services/useSession.js";
import AuthenticatedDashboard from "./components/AuthenticatedDashboard.jsx";
import { publicPath, publicScreen } from "./services/publicNavigation.js";
import { dashboardPath, dashboardPage, sessionPath, writePath } from "./services/dashboardNavigation.js";
import { previewsEnabled } from "./services/developmentPreviews.js";

const pageTitles = {
  board: "My Applications",
  analytics: "Analytics",
  mentors: "Mentors",
  settings: "Settings",
};

function App() {
  const session = useSession();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [screen, setScreen] = useState(() => publicScreen(window.location.pathname));
  function navigate(nextScreen, replace = false) {
    session.cancelAuthentication();
    const path = publicPath(nextScreen);
    writePath(window.history, window.location, path, replace);
    setPathname(path);
    setScreen(nextScreen);
  }
  useEffect(() => {
    function backOrForward() { session.cancelAuthentication(); setPathname(window.location.pathname); setScreen(publicScreen(window.location.pathname)); }
    window.addEventListener("popstate", backOrForward);
    return () => window.removeEventListener("popstate", backOrForward);
  }, []);
  useEffect(() => { if (session.ended) navigate("login", true); }, [session.ended]);
  useEffect(() => {
    const path = sessionPath(pathname, session.user, session.restoring);
    if (path !== pathname) {
      writePath(window.history, window.location, path, true);
      setPathname(path); setScreen(publicScreen(path));
    }
  }, [pathname, session.user?.id, session.user?.role, session.restoring]);
  function navigateDashboard(page) {
    const path = dashboardPath(session.user.role, page);
    writePath(window.history, window.location, path);
    setPathname(path);
  }
  const [activePage, setActivePage] = useState("board");
  const [startup, setStartup] = useState(() => loadPreviewApplications(false));
  const [applications, setApplications] = useState(startup.applications);
  const [storageError, setStorageError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState("");
  const [resetVersion, setResetVersion] = useState(0);
  const [settingsStartup, setSettingsStartup] = useState(() => loadPreviewSettings(false));
  const [previewSettings, setPreviewSettings] = useState(settingsStartup.settings);
  function saveSettings(draft) {
    const result = savePreviewSettings(editableSettingsUpdate(draft, previewSettings), previewsEnabled);
    if (!result.error) setPreviewSettings(result.settings);
    return result;
  }
  const [mentorStartup, setMentorStartup] = useState(() => loadPreviewMentors(false));
  const [previewMentorLinks, setPreviewMentorLinks] = useState(mentorStartup.links);
  const mentorLinksRef = useRef(previewMentorLinks);
  const [mentorStorageError, setMentorStorageError] = useState("");
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const previewActive = previewsEnabled && screen === "preview" && !session.user && !session.restoring;
  useEffect(() => {
    if (!previewActive || previewLoaded) return;
    const storedApplications = loadPreviewApplications(true);
    const storedSettings = loadPreviewSettings(true);
    const storedMentors = loadPreviewMentors(true);
    setStartup(storedApplications); setApplications(storedApplications.applications);
    setSettingsStartup(storedSettings); setPreviewSettings(storedSettings.settings);
    setMentorStartup(storedMentors); setPreviewMentorLinks(storedMentors.links);
    mentorLinksRef.current = storedMentors.links;
    setPreviewLoaded(true);
  }, [previewActive, previewLoaded]);
  useEffect(() => {
    if (previewActive && previewLoaded) setMentorStorageError(savePreviewMentors(previewMentorLinks, true));
  }, [previewMentorLinks, previewActive, previewLoaded]);
  function invitePreviewMentor(email) {
    if (!previewsEnabled) return { error: "Mentor invitations are not connected yet." };
    const result = createPreviewInvitation(email, mentorLinksRef.current);
    if (!result.error) {
      mentorLinksRef.current = result.links;
      setPreviewMentorLinks(result.links);
    }
    return result;
  }
  useEffect(() => {
    if (previewActive && previewLoaded) setStorageError(savePreviewApplications(applications, true));
  }, [applications, previewActive, previewLoaded]);

  function confirmAction() {
    if (confirmation.type === "reset") {
      setApplications(createSampleApplications());
      setResetVersion((previous) => previous + 1);
      setActivePage("board");
      setNotice("Sample applications restored.");
    } else {
      setApplications((previous) => previous.filter((application) => application.id !== confirmation.application.id));
      setNotice(`${confirmation.application.role} at ${confirmation.application.company} deleted.`);
    }
    setConfirmation(null);
  }

  function addApplication(values) {
    const id = crypto.randomUUID();
    setApplications((previous) => [...previous, { ...values, id, feedbackCount: 0, feedback: [], history: [{ id: `${id}-initial`, stage: values.stage, date: values.appliedDate }] }]);
  }

  function updateApplication(id, changes) {
    const historyId = crypto.randomUUID();
    const date = localDate();
    setApplications((previous) => previous.map((application) => application.id === id ? {
      ...application, ...changes,
      history: changes.stage && changes.stage !== application.stage
        ? [...application.history, { id: historyId, stage: changes.stage, date }]
        : application.history,
    } : application));
  }

  if (session.restoring || (session.error && !session.user)) return <main className="content-container"><section className="card" aria-busy={session.restoring}>
    <h1>Checking your session</h1>
    <p role="status">{session.restoring ? "Please wait…" : session.error}</p>
    {!session.restoring && <><button className="button" onClick={session.retry}>Retry</button> <button className="button button--secondary" onClick={() => { session.discard(); navigate("login", true); }}>Return to Login</button></>}
  </section></main>;
  if (session.user) return <AuthenticatedDashboard key={`${session.user.id}-${session.user.role}`} api={session.api} user={session.user} page={dashboardPage(session.user.role, pathname)} onNavigate={navigateDashboard} onProfile={session.updateProfile} warning={[session.warning, session.error].filter(Boolean).join(" ")} onLogout={async () => { await session.logout(); navigate("welcome", true); }} />;

  if (screen === "mentorPreview" && previewsEnabled) return <MentorDashboard onBack={() => setScreen("welcome")} />;
  if (screen === "adminPreview" && previewsEnabled) return <AdminDashboard onBack={() => setScreen("welcome")} />;

  if (screen !== "preview") {
    return (
      <>
        {screen === "welcome" && <Welcome onNavigate={(nextScreen) => {
          if (["preview", "mentorPreview", "adminPreview"].includes(nextScreen) && !previewsEnabled) return;
          if (nextScreen === "preview") {
            if (!previewsEnabled) return;
            setActivePage("board");
          }
          navigate(nextScreen);
        }} />}
        {screen === "login" && <Login onNavigate={navigate} onAuthenticate={session.authenticate} sessionMessage={session.ended} />}
        {screen === "signup" && <SignUp onNavigate={navigate} onAuthenticate={session.authenticate} />}
        <footer className="dev-preview">
          {screen !== "welcome" && <button className="auth-link" onClick={() => navigate("welcome")}>Back to Welcome</button>}
        </footer>
      </>
    );
  }

  if (!previewsEnabled) return <Welcome onNavigate={navigate} />;
  if (!previewLoaded) return <main className="content-container"><p role="status">Loading development preview...</p></main>;
  return (
    <>
      {previewsEnabled && <aside className="dev-preview">
        <p>Development preview — sample data saved in this browser only. Backend and reminder emails are not connected.</p>
        {startup.error && <p role="status">{startup.error}</p>}
        <p role="status">{notice}</p>
        {storageError && <p role="status">{storageError}</p>}
        <button type="button" className="auth-link" onClick={() => setScreen("welcome")}>Back to Welcome</button>
        {previewsEnabled && <button type="button" className="auth-link preview-reset" onClick={() => setConfirmation({ type: "reset" })}>Reset sample data</button>}
      </aside>}
      <Header variant="applicant" activePage={activePage} onNavigate={setActivePage} userInitial={Array.from(previewSettings.name.trim())[0]?.toUpperCase() || "?"} />
      {activePage === "board" ? <Board key={resetVersion} applications={applications} onAdd={addApplication} onUpdate={updateApplication} onDelete={(application) => setConfirmation({ type: "delete", application })} onMentors={() => setActivePage("mentors")} /> : activePage === "analytics" ? <Analytics applications={applications} /> : activePage === "mentors" ? <Mentors links={previewMentorLinks} onInvite={invitePreviewMentor} onBackToBoard={() => setActivePage("board")} storageError={mentorStorageError || mentorStartup.error} /> : activePage === "settings" ? <Settings settings={previewSettings} onSave={saveSettings} loadError={settingsStartup.error} /> : <main className="content-container">
        <section className="card" aria-labelledby="page-title">
          <h1 id="page-title" aria-live="polite">{pageTitles[activePage]}</h1>
          <p>This page is a placeholder. Implementation is coming soon.</p>
        </section>
      </main>}
      {confirmation && <ConfirmDialog title={confirmation.type === "reset" ? "Reset sample data?" : "Delete application?"}
        confirmLabel={confirmation.type === "reset" ? "Reset sample data" : "Delete"} onCancel={() => setConfirmation(null)} onConfirm={confirmAction}>
        <p>{confirmation.type === "reset" ? "Replace all preview applications and edits with the original sample applications?" : `Delete ${confirmation.application.role} at ${confirmation.application.company}? This removes it from this browser's preview data.`}</p>
      </ConfirmDialog>}
    </>
  );
}

export default App;
