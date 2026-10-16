import { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import Welcome from "./pages/Welcome.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import Board from "./pages/Board.jsx";
import Analytics from "./pages/Analytics.jsx";
import { localDate } from "./data/applicationStages.js";
import { createSampleApplications, loadPreviewApplications, savePreviewApplications } from "./services/previewStorage.js";
import ConfirmDialog from "./components/ConfirmDialog.jsx";

const pageTitles = {
  board: "My Applications",
  analytics: "Analytics",
  mentors: "Mentors",
  settings: "Settings",
};

function App() {
  const [screen, setScreen] = useState("welcome");
  const [activePage, setActivePage] = useState("board");
  const [startup] = useState(() => loadPreviewApplications(import.meta.env.DEV));
  const [applications, setApplications] = useState(startup.applications);
  const [storageError, setStorageError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState("");
  const [resetVersion, setResetVersion] = useState(0);
  useEffect(() => {
    setStorageError(savePreviewApplications(applications, import.meta.env.DEV));
  }, [applications]);

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

  if (screen !== "preview") {
    return (
      <>
        {screen === "welcome" && <Welcome onNavigate={(nextScreen) => {
          if (nextScreen === "preview") {
            if (!import.meta.env.DEV) return;
            setActivePage("board");
          }
          setScreen(nextScreen);
        }} />}
        {screen === "login" && <Login onNavigate={setScreen} />}
        {screen === "signup" && <SignUp onNavigate={setScreen} />}
        <footer className="dev-preview">
          {screen !== "welcome" && <button className="auth-link" onClick={() => setScreen("welcome")}>Back to Welcome</button>}
        </footer>
      </>
    );
  }

  return (
    <>
      {import.meta.env.DEV && <aside className="dev-preview">
        <p>Development preview — sample data saved in this browser only. Backend and reminder emails are not connected.</p>
        {startup.error && <p role="status">{startup.error}</p>}
        <p role="status">{notice}</p>
        {storageError && <p role="status">{storageError}</p>}
        <button type="button" className="auth-link" onClick={() => setScreen("welcome")}>Back to Welcome</button>
        {import.meta.env.DEV && <button type="button" className="auth-link preview-reset" onClick={() => setConfirmation({ type: "reset" })}>Reset sample data</button>}
      </aside>}
      <Header variant="applicant" activePage={activePage} onNavigate={setActivePage} />
      {activePage === "board" ? <Board key={resetVersion} applications={applications} onAdd={addApplication} onUpdate={updateApplication} onDelete={(application) => setConfirmation({ type: "delete", application })} /> : activePage === "analytics" ? <Analytics applications={applications} /> : <main className="content-container">
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
