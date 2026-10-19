import { linkedStudent } from "../services/mentorSelection.js";
import ActionNotice, { useActionNotice } from "../components/ActionNotice.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import MentorFeedbackPanel from "../components/MentorFeedbackPanel.jsx";
import { createFeedbackSubmission, createMentorDashboardApi, invitationAccountError, mentorOverviewCounts } from "../services/mentorDashboardApi.js";
import useMentorResource from "../services/useMentorResource.js";
import "../styles/mentorDashboard.css";

function ResourceError({ resource, label }) {
  return resource.error ? <p role="alert">{resource.error} <button className="button button--secondary" onClick={resource.retry}>Retry {label}</button></p> : null;
}

function RealFeedback({ application, service, onAccessLost }) {
  const resource = useMentorResource(service.feedback, application._id);
  const alive = useRef(false);
  const submit = useMemo(() => createFeedbackSubmission(service, application._id), [service, application._id]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (resource.status === 403 || resource.status === 404) onAccessLost(resource.error);
  }, [resource.status, resource.error]);
  async function send(comment) {
    try {
      return await submit(comment, () => alive.current ? resource.retry() : null);
    } catch (failure) {
      if (alive.current && (failure.status === 403 || failure.status === 404)) onAccessLost(failure.message);
      throw failure;
    }
  }
  return <MentorFeedbackPanel preview={false} application={application} feedback={resource.data || []} onSend={send}
    loading={resource.loading} loadError={resource.error} onRetry={resource.retry} />;
}

function StudentPipeline({ student, service, onRefreshRoster, page, onAccessLost }) {
  const resource = useMentorResource(service.pipeline, student._id);
  const [applicationId, setApplicationId] = useState("");
  const [accessError, setAccessError] = useState("");
  const heading = useRef(null);
  useEffect(() => { if (page === "mentorView") heading.current?.focus(); }, [page]);
  useEffect(() => {
    if (accessError || resource.status === 403 || resource.status === 404) onAccessLost(accessError || resource.error);
  }, [accessError, resource.status, resource.error]);
  const pipeline = accessError ? null : resource.data;
  const application = pipeline?.applications.find((item) => item._id === applicationId) || pipeline?.applications[0] || null;
  const blocked = accessError || (resource.status === 403 || resource.status === 404 ? resource.error : "");
  return <div className="mentor-overview">
    <h1 ref={heading} tabIndex={-1}>{student.name} — Pipeline Overview</h1>
    {blocked ? <section className="card"><p role="alert">{blocked} Access may have been revoked or the application/account is unavailable.</p><button className="button" onClick={onRefreshRoster}>Retry roster</button></section> : <>
      {resource.loading && <p role="status">Loading this student's pipeline...</p>}
      <ResourceError resource={resource} label="pipeline" />
      {pipeline && <>
        <div className="mentor-summary">{mentorOverviewCounts(pipeline.summary).map((count, index) => <div className={`card mentor-summary-${index}`} key={index}><strong>{count}</strong><span>{["Applied", "Online Assessment", "Interview", "Offer/Rejected"][index]}</span></div>)}</div>
        <section className="card mentor-applications" aria-label="Read-only application selection">
          {application ? <>
            <label htmlFor="real-mentor-application">Select application</label>
            <select id="real-mentor-application" value={application._id} onChange={(event) => setApplicationId(event.target.value)}>{pipeline.applications.map((item) => <option key={item._id} value={item._id}>{item.company} — {item.position} · {item.stage}</option>)}</select>
          </> : <p>This student has no applications yet.</p>}
        </section>
        {application && <RealFeedback key={application._id} application={application} service={service} onAccessLost={setAccessError} />}
        {application && <details key={`details-${application._id}`} className="card mentor-applications mentor-detail-disclosure"><summary>View application details</summary>
            <dl><dt>Company / role</dt><dd>{application.company} · {application.position}</dd>
              <dt>Current stage</dt><dd>{application.stage}</dd><dt>Applied date</dt><dd>{application.dateApplied ? new Date(application.dateApplied).toLocaleDateString() : "Not provided"}</dd>
              <dt>Deadline</dt><dd>{application.deadline ? new Date(application.deadline).toLocaleString() : "No deadline"}</dd>
              <dt>Applicant notes</dt><dd>{application.notes?.length ? <ul>{application.notes.map((note) => <li key={note._id}>{note.text}{note.createdAt && <> · <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time></>}</li>)}</ul> : "No notes"}</dd>
            </dl>
            <h2>Stage history</h2>{application.stageHistory?.length ? <ol>{application.stageHistory.map((entry, index) => <li key={`${application._id}-${index}`}>{entry.stage} · <time dateTime={entry.changedAt}>{new Date(entry.changedAt).toLocaleString()}</time></li>)}</ol> : <p>No stage history available.</p>}

        </details>}
      </>}
    </>}
  </div>;
}

export default function AuthenticatedMentorDashboard({ api, user, page, onNavigate }) {
  const service = useMemo(() => createMentorDashboardApi(api, user), [api, user.id, user.email, user.role]);
  const loadRoster = useMemo(() => (_key, signal) => service.roster(signal), [service]);
  const loadInvitations = useMemo(() => (_key, signal) => service.invitations(signal), [service]);
  const roster = useMentorResource(loadRoster);
  const invitations = useMentorResource(loadInvitations);
  const [studentId, setStudentId] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice, dismissNotice] = useActionNotice();
  const [inboxOpen, setInboxOpen] = useState(false);
  const responding = useRef(false);
  const alive = useRef(false);
  const rosterHeading = useRef(null);
  const inboxTrigger = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (page === "students") rosterHeading.current?.focus(); }, [page]);
  const selectedStudent = linkedStudent(roster.data, studentId);
  const selected = selectedStudent ? { applicant: selectedStudent } : null;
  useEffect(() => {
    if (roster.data && studentId && !linkedStudent(roster.data, studentId)) setStudentId("");
  }, [roster.data, studentId]);
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current === "settings" && page !== "settings") { roster.retry(); invitations.retry(); }
    previousPage.current = page;
  }, [page]);
  function accessLost(message) { setStudentId(""); setSelectionError(message); roster.retry(); }
  async function respond() {
    if (responding.current) return;
    responding.current = true;
    try {
      const { link, action } = confirmation;
      await service.respond(link, action);
      if (alive.current) {
        setNotice(`${action === "accept" ? "Invitation accepted" : "Invitation declined"} for ${link.applicant.name}.`);
        await Promise.all([roster.retry(), invitations.retry()]);
        if (alive.current) { setConfirmation(null); requestAnimationFrame(() => rosterHeading.current?.focus()); }
      }
    } finally { responding.current = false; }
  }
  return <main hidden={page === "settings"} className={`content-container mentor-dashboard${page === "students" ? " mentor-dashboard--students" : ""}`}>
    {selectionError && <p className="mentor-selection-error" role="alert">{selectionError} Select an available linked student.</p>}
    <aside onKeyDown={(event) => { if (event.key === "Escape" && inboxOpen) { setInboxOpen(false); inboxTrigger.current?.focus(); } }}>
      <section className="card mentor-roster" aria-labelledby="real-mentor-roster-title">
        {page === "students" ? <h1 ref={rosterHeading} tabIndex={-1} id="real-mentor-roster-title">My Students</h1> : <h2 ref={rosterHeading} tabIndex={-1} id="real-mentor-roster-title">My Students</h2>}

        {roster.loading && <p role="status">Loading linked students...</p>}
        <ResourceError resource={roster} label="roster" />
        {roster.data && (roster.data.length ? <ul>{roster.data.map((link) => <li key={link._id}>{link.applicant ? <button type="button" aria-pressed={selected?.applicant._id === link.applicant._id} onClick={() => { setStudentId(link.applicant._id); setSelectionError(""); onNavigate("mentorView"); }}><strong>{link.applicant.name}</strong><span>{link.applicant.email}</span></button> : <p>Applicant account unavailable.</p>}</li>)}</ul> : <p>No linked students yet. Open Invitations to accept access to a student's pipeline.</p>)}
      </section>
      <button type="button" ref={inboxTrigger} className="button button--secondary mentor-invitations-toggle" aria-expanded={inboxOpen} aria-controls="mentor-inbox" onClick={() => { if (!inboxOpen) invitations.retry(); setInboxOpen(!inboxOpen); }}>Invitations <span aria-label={`${invitations.data?.length || 0} pending`}>{invitations.data?.length || 0}</span></button>
      <ActionNotice notice={notice} onDismiss={dismissNotice} />
      {inboxOpen && <section id="mentor-inbox" className="card mentor-inbox" aria-labelledby="mentor-inbox-title">
        <h2 id="mentor-inbox-title">Pending invitations</h2>

        {invitations.loading && <p role="status">Loading invitations...</p>}
        <ResourceError resource={invitations} label="invitations" />
        {invitations.data && (invitations.data.length ? <ul>{invitations.data.map((link) => {
          const error = invitationAccountError(link, user);
          return <li key={link._id}><strong>{link.applicant?.name || "Applicant account unavailable"}</strong><p>{link.applicant?.email}</p>
            {error ? <p>{error}</p> : <><button className="button" onClick={() => setConfirmation({ link, action: "accept" })}>Accept invitation from {link.applicant.name}</button> <button className="button button--secondary" onClick={() => setConfirmation({ link, action: "decline" })}>Decline</button></>}
          </li>;
        })}</ul> : <p>No pending invitations</p>)}
      </section>}
    </aside>
    {page === "mentorView" && (selected ? <StudentPipeline key={selected.applicant._id} student={selected.applicant} service={service} onRefreshRoster={roster.retry} page={page} onAccessLost={accessLost} /> : <div className="mentor-overview"><h1>Mentor View</h1><p>Choose a linked student from My Students to view their pipeline.</p><button type="button" className="button button--secondary" onClick={() => onNavigate("students")}>Choose student</button></div>)}
    {confirmation && <ConfirmDialog title={confirmation.action === "accept" ? "Accept invitation?" : "Decline invitation?"} confirmLabel={confirmation.action === "accept" ? "Accept" : "Decline"} onCancel={() => setConfirmation(null)} onConfirm={respond}>
      <p>{confirmation.action === "accept" ? "Accept read-only pipeline access and permission to leave feedback for" : "Decline the pending invitation from"} {confirmation.link.applicant.name} ({confirmation.link.applicant.email})?</p>
    </ConfirmDialog>}
  </main>;
}
