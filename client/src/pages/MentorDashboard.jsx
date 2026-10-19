import { useRef, useState } from "react";
import Header from "../components/Header.jsx";
import MentorFeedbackPanel from "../components/MentorFeedbackPanel.jsx";
import { mentorStudents, previewMentor } from "../data/mentorFixtures.js";
import { createMentorFeedback, currentStageCounts, loadMentorFeedback, saveMentorFeedback, selectedApplication, selectedStudent } from "../services/mentorPreview.js";
import "../styles/mentorDashboard.css";

export default function MentorDashboard({ onBack, students = mentorStudents }) {
  const [startup] = useState(() => loadMentorFeedback(import.meta.env.DEV));
  const [feedback, setFeedback] = useState(startup.feedback);
  const [studentId, setStudentId] = useState(students[0]?._id ?? null);
  const [applicationId, setApplicationId] = useState(null);
  const [activeTab, setActiveTab] = useState("mentorView");
  const roster = useRef(null), overview = useRef(null);
  const student = selectedStudent(students, studentId);
  const application = selectedApplication(student, applicationId);
  const counts = currentStageCounts(student?.applications ?? []);
  function navigate(tab) { setActiveTab(tab); (tab === "students" ? roster : overview).current?.focus(); }
  function sendFeedback(comment) {
    const result = createMentorFeedback(student, application?._id, comment);
    if (result.error) return result.error;
    const next = [result.record, ...feedback];
    const error = saveMentorFeedback(next, import.meta.env.DEV);
    if (!error) setFeedback(next);
    return error;
  }
  return <>
    <aside className="dev-preview"><p>Development mentor preview — fictional students and browser-only feedback. Separate from applicant invitations; no real access or emails.</p><button type="button" className="auth-link" onClick={onBack}>Back to Welcome</button></aside>
    <Header variant="mentor" activePage={activeTab} onNavigate={navigate} userInitial={previewMentor.name[0]} />
    <main className="content-container mentor-dashboard">
      <aside className="card mentor-roster" aria-labelledby="mentor-roster-title">
        <h2 ref={roster} tabIndex={-1} id="mentor-roster-title">My Students</h2>
        {students.length ? <ul>{students.map((item) => <li key={item._id}><button type="button" aria-pressed={student?._id === item._id}
          onClick={() => { setStudentId(item._id); setApplicationId(null); }}><strong>{item.name}</strong><span>{item.applications.length} applications · Fictional</span></button></li>)}</ul> : <p>No students available. Real students appear after accepting an invitation.</p>}
      </aside>
      <div className="mentor-overview">
        <h1 ref={overview} tabIndex={-1}>{student ? `${student.name} — Pipeline Overview` : "Pipeline Overview"}</h1>
        {startup.error && <p role="status">{startup.error}</p>}
        {!student ? <p>Select a student when a roster is available.</p> : <>
          <div className="mentor-summary">{["Applied", "Online Assessment", "Interview", "Offer/Rejected"].map((label, index) => <div className={`card mentor-summary-${index}`} key={label}><strong>{counts[index]}</strong><span>{label}</span></div>)}</div>
          <p className="mentor-summary-note">Current-stage counts. Offer/Rejected combines both outcomes; these are not cumulative funnel counts.</p>
          <section className="card mentor-applications" aria-labelledby="mentor-applications-title"><h2 id="mentor-applications-title">Applications — read-only</h2>
            {student.applications.length ? <>
              <label htmlFor="mentor-application">Select application</label><select id="mentor-application" value={application?._id ?? ""} onChange={(event) => setApplicationId(event.target.value)}>
                {student.applications.map((item) => <option key={item._id} value={item._id}>{item.company} — {item.position} · {item.stage}</option>)}
              </select>
              {application && <dl><dt>Company / role</dt><dd>{application.company} · {application.position}</dd><dt>Current stage</dt><dd>{application.stage}</dd><dt>Applied date</dt><dd>{application.dateApplied}</dd><dt>Deadline</dt><dd>{application.deadline || "No deadline"}</dd><dt>Applicant notes</dt><dd>{application.notes.length ? application.notes.map((note) => note.text).join(" · ") : "No notes"}</dd></dl>}
            </> : <p>This student has no applications yet.</p>}
          </section>
          {application && <MentorFeedbackPanel key={`${student._id}-${application._id}`} application={application}
            feedback={feedback.filter((record) => record.applicationId === application._id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))} onSend={sendFeedback} />}
        </>}
      </div>
    </main>
  </>;
}
