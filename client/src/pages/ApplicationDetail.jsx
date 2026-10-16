import { useEffect, useRef, useState } from "react";
import StageTag from "../components/StageTag.jsx";
import { applicationStages } from "../data/applicationStages.js";

function ApplicationDetail({ application, onBack, onUpdate, onDelete }) {
  const [stage, setStage] = useState(application.stage);
  const [notes, setNotes] = useState(application.notes);
  const [notice, setNotice] = useState("");
  const heading = useRef(null);
  useEffect(() => { heading.current.focus(); }, []);

  return <main className="content-container">
    <button type="button" className="button button--secondary" onClick={onBack}>Back to Board</button>
    <p role="status">{notice}</p>
    <div className="application-detail">
      <section className="card" aria-labelledby="detail-title">
        <h1 ref={heading} tabIndex={-1} id="detail-title">{application.company}</h1>
        <p>{application.role}</p><StageTag stage={application.stage} />
        <h2>Applied date</h2><p><time dateTime={application.appliedDate}>{application.appliedDate}</time></p>
        <h2>Deadline / reminder</h2>
        <p>{application.deadline ? <time dateTime={application.deadline}>{application.deadline}</time> : "No deadline set"}</p>
        <p>{application.reminder ? "Reminder preference on. No email is scheduled or sent." : "Reminder preference off."}</p>
        <h2>Stage history</h2>
        <ol>{application.history.map((entry) => <li key={entry.id}>{applicationStages[entry.stage]} — <time dateTime={entry.date}>{entry.date}</time></li>)}</ol>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (stage === application.stage) { setNotice("Stage unchanged. No history entry added."); return; }
          onUpdate(application.id, { stage });
          setNotice(`Stage updated to ${applicationStages[stage]}.`);
        }}>
          <div className="application-field"><label htmlFor="detail-stage">Stage</label><select id="detail-stage" value={stage} onChange={(event) => setStage(event.target.value)}>{Object.entries(applicationStages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <button type="submit" className="button">Update Stage</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); onUpdate(application.id, { notes }); setNotice("Notes saved in this preview."); }}>
          <div className="application-field"><label htmlFor="detail-notes">Notes</label><textarea id="detail-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <button type="submit" className="button button--secondary">Save Notes</button>
        </form>
        <button type="button" className="button button--secondary detail-delete" onClick={() => onDelete(application)}>Delete application</button>
      </section>
      <aside className="card" aria-labelledby="feedback-title"><h2 id="feedback-title">Mentor Feedback</h2>
        {application.feedback.length ? application.feedback.map((feedback) => <blockquote key={feedback.id}><p>{feedback.text}</p><footer>{feedback.author} · Sample feedback</footer></blockquote>) : <p>No mentor feedback yet.</p>}
      </aside>
    </div>
  </main>;
}

export default ApplicationDetail;
