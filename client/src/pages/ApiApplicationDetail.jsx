import ActionNotice, { useActionNotice } from "../components/ActionNotice.jsx";
import { useEffect, useRef, useState } from "react";
import StageTag from "../components/StageTag.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { applicationStages } from "../data/applicationStages.js";
import { refreshedDraftValue } from "../services/draftSync.js";

function NoteEditor({ note, onSave, disabled }) {
  const [text, setText] = useState(note.text);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const savedText = useRef(note.text);
  useEffect(() => {
    const previous = savedText.current; savedText.current = note.text;
    setText((current) => refreshedDraftValue(current, previous, note.text));
  }, [note.text]);
  return <form onSubmit={async (event) => {
    event.preventDefault();
    if (saving.current) return;
    if (!text.trim()) { setError("Enter note text."); return; }
    saving.current = true; setError("");
    try { await onSave(text); } catch (failure) { setError(failure.message); }
    finally { saving.current = false; }
  }}>
    <div className="application-field"><label htmlFor={`note-${note._id}`}>Note</label>
      <textarea id={`note-${note._id}`} value={text} onChange={(event) => setText(event.target.value)} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `note-error-${note._id}` : undefined} /></div>
    <p>Created <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time> · Updated <time dateTime={note.updatedAt}>{new Date(note.updatedAt).toLocaleString()}</time></p>
    {error && <p role="alert" id={`note-error-${note._id}`}>{error}</p>}
    <button className="button button--secondary" disabled={disabled || text.trim() === note.text}>Save Note</button>
  </form>;
}

export default function ApiApplicationDetail({ application, service, onRecord, onStageUpdate, onDelete, onBack, initialNoteDraft, onDraft, onMentors }) {
  const [stage, setStage] = useState(application.stage);
  const savedStage = useRef(application.stage);
  useEffect(() => {
    const previous = savedStage.current; savedStage.current = application.stage;
    setStage((current) => refreshedDraftValue(current, previous, application.stage));
  }, [application.stage]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [retry, setRetry] = useState(0);
  const [feedbackRetry, setFeedbackRetry] = useState(0);
  const [pending, setBusy] = useState(false);
  const [fetching, setFetching] = useState(true);
  const busy = pending || fetching;
  const [notice, setNotice, dismissNotice] = useActionNotice();
  const [error, setError] = useState("");
  const [noteUncertain, setNoteUncertain] = useState(false);
  const [deleteNote, setDeleteNote] = useState(null);
  const lock = useRef(false);
  const alive = useRef(false);
  const heading = useRef(null);
  useEffect(() => { alive.current = true; heading.current?.focus(); return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setFetching(true);
    setLoadError("");
    service.detail(application.id, controller.signal).then((record) => {
      if (!controller.signal.aborted) { onRecord(record); setReady(true); setNoteUncertain(false); }
    }).catch((failure) => {
      if (!controller.signal.aborted) {
        setLoadError(failure.message);
        if (failure.status === 403 || failure.status === 404) setReady(false);
      }
    })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [application.id, service, retry]);
  useEffect(() => {
    const controller = new AbortController();
    setFeedbackError(""); setFeedback(null);
    service.feedback(application.id, controller.signal).then((records) => { if (!controller.signal.aborted) setFeedback(records); })
      .catch((failure) => { if (!controller.signal.aborted) setFeedbackError(failure.message); });
    return () => controller.abort();
  }, [application.id, service, feedbackRetry]);
  async function perform(action, message) {
    if (lock.current || fetching) throw Object.assign(new Error("Another request is in progress. Please wait."), { status: 409 });
    lock.current = true; setBusy(true); setNotice(""); setError("");
    try { await action(); if (alive.current) setNotice(message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  function updateNotes(notes) { onRecord({ ...application, noteRecords: notes }); }
  return <main className="content-container">
    <button className="button button--secondary" disabled={busy} onClick={onBack}>Back to Board</button>
    <h1 ref={heading} tabIndex={-1}>{application.company}</h1>
    <ActionNotice notice={notice} onDismiss={dismissNotice} />{error && <p role="alert">{error}</p>}
    {loadError && <p role="alert">{loadError} <button className="button" onClick={() => setRetry((value) => value + 1)}>Retry details</button></p>}
    {!ready ? <p role="status">{loadError ? "Application details could not be loaded." : "Loading application details..."}</p> : <div className="application-detail">
      <section className="card" aria-label="Application information" aria-busy={busy}>
        <p>{application.role}</p><StageTag stage={application.stage} />
        <h2>Applied date</h2><p><time dateTime={application.dateApplied}>{application.appliedDate}</time></p>
        <h2>Deadline / reminder</h2><p>{application.deadline || "No deadline set"}</p>
        <p>Application reminder preference {application.reminder ? "on" : "off"}. Email delivery also depends on account preferences and the server reminder service.</p>
        <h2>Stage history</h2><ol>{application.history.map((entry) => <li key={entry.id}>{applicationStages[entry.stage]} · <time dateTime={entry.date}>{new Date(entry.date).toLocaleString()}</time></li>)}</ol>
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (stage === application.stage) { setNotice("Stage unchanged. No history entry added."); return; }
          try { await perform(async () => onStageUpdate(application.id, stage), "Stage saved."); }
          catch (failure) { setError(`${failure.message} Your stage choice is retained. Refresh details to check the server before retrying.`); }
        }}>
          <div className="application-field"><label htmlFor="api-stage">Stage</label><select id="api-stage" value={stage} disabled={busy} onChange={(event) => setStage(event.target.value)}>{Object.entries(applicationStages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <button className="button" disabled={busy}>Update Stage</button>
        </form>
        <h2>Notes</h2>
        {application.noteRecords.length === 0 && <p>No notes yet.</p>}
        {application.noteRecords.map((note) => <div key={note._id}>
          <NoteEditor note={note} disabled={busy} onSave={(text) => perform(async () => {
            const saved = await service.note(application.id, text, note._id);
            if (alive.current) updateNotes(application.noteRecords.map((item) => item._id === saved._id ? saved : item));
          }, "Note saved.")} />
          <button className="auth-link" disabled={busy} onClick={() => setDeleteNote(note)}>Delete note</button>
        </div>)}
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (!initialNoteDraft.trim()) { setError("Enter note text."); return; }
          try { await perform(async () => {
            const saved = await service.note(application.id, initialNoteDraft);
            if (alive.current) { updateNotes([...application.noteRecords, saved]); onDraft(""); }
          }, "Note added."); }
          catch (failure) {
            setError(`${failure.message} Your draft is retained.${!failure.status || failure.status >= 500 ? " The note may have been saved. Refresh details and check before adding it again." : ""}`);
            if (!failure.status || failure.status >= 500) setNoteUncertain(true);
          }
        }}>
          <div className="application-field"><label htmlFor="api-new-note">New note</label><textarea id="api-new-note" value={initialNoteDraft} disabled={busy} onChange={(event) => onDraft(event.target.value)} /></div>
          <button className="button button--secondary" disabled={busy || noteUncertain}>Add Note</button>
        </form>
        <button className="auth-link" disabled={busy} onClick={() => setRetry((value) => value + 1)}>Refresh details</button>
        <button className="button button--secondary detail-delete" disabled={busy} onClick={onDelete}>Delete application</button>
      </section>
      <aside className="card" aria-labelledby="api-feedback-title"><h2 id="api-feedback-title">Mentor Feedback</h2>
        <button className="button button--secondary" disabled={busy} onClick={onMentors}>Manage Mentor Access</button>
        <p>Accepted mentor links grant read-only access to your entire pipeline and allow application feedback. Manage invitations on Mentors; this does not share an individual application.</p>
        {feedbackError ? <p role="alert">{feedbackError} <button className="button" onClick={() => setFeedbackRetry((value) => value + 1)}>Retry feedback</button></p>
          : feedback === null ? <p role="status">Loading feedback...</p> : feedback.length === 0 ? <p>No mentor feedback yet.</p>
          : feedback.map((item) => <blockquote key={item._id}><p>{item.comment}</p><footer>{item.mentorId?.name || "Mentor"} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></footer></blockquote>)}
      </aside>
    </div>}
    {deleteNote && <ConfirmDialog title="Delete note?" confirmLabel="Delete note" onCancel={() => setDeleteNote(null)} onConfirm={() => perform(async () => {
      await service.removeNote(application.id, deleteNote._id);
      if (alive.current) { updateNotes(application.noteRecords.filter((note) => note._id !== deleteNote._id)); setDeleteNote(null); }
    }, "Note deleted.")}><p>Delete this note from {application.role} at {application.company}?</p></ConfirmDialog>}
  </main>;
}
