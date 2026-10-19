import ActionNotice, { useActionNotice } from "./ActionNotice.jsx";
import { useRef, useState } from "react";

export default function MentorFeedbackPanel({ application, feedback, onSend, preview = true, loading = false, loadError = "", onRetry, disabled = false }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice, dismissNotice] = useActionNotice();
  const [pending, setPending] = useState(false);
  const submitted = useRef(false);
  const input = useRef(null);
  async function submit(event) {
    event.preventDefault();
    if (submitted.current || disabled || loading || loadError) return;
    if (!comment.trim()) { setError("Enter feedback before sending."); input.current.focus(); return; }
    submitted.current = true;
    setPending(true); setError(""); setNotice("");
    try {
      const result = await onSend(comment);
      if (typeof result === "string" && result) { submitted.current = false; setError(result); input.current?.focus(); return; }
      if (!result?.keepDraft) setComment("");
      setNotice(result?.notice || (preview ? "Preview feedback saved to this browser. No email was sent." : "Feedback saved."), { persistent: Boolean(result?.keepDraft) });
    } catch (failure) { submitted.current = Boolean(failure.unconfirmedSubmission); setError(failure.message); input.current?.focus(); }
    finally { setPending(false); }
  }
  return <section className="card mentor-feedback-panel" aria-labelledby="mentor-feedback-heading">
    <h2 id="mentor-feedback-heading">Leave Feedback — {application.company} · {application.position}</h2>
    <form onSubmit={submit} noValidate aria-busy={pending}>
      <label htmlFor="mentor-comment">Feedback for {application.company}, {application.position}</label>
      <textarea ref={input} id="mentor-comment" value={comment} rows={3} placeholder="Add preparation tips or a comment..." readOnly={pending} disabled={disabled}
        onChange={(event) => { if (pending) return; setComment(event.target.value); submitted.current = false; setError(""); setNotice(""); }}
        aria-invalid={Boolean(error)} aria-describedby={error ? "mentor-comment-error" : undefined} />
      {error && <p id="mentor-comment-error" className="application-error" role="alert">{error}</p>}
      <button type="submit" className="button" disabled={pending || disabled || loading || Boolean(loadError) || submitted.current}>{pending ? "Sending..." : "Send Feedback"}</button>
      <ActionNotice notice={notice} onDismiss={dismissNotice} />
    </form>
    <h2>Feedback history</h2>
    {loading ? <p role="status">Loading feedback...</p> : loadError ? <p role="alert">{loadError} <button className="button button--secondary" onClick={onRetry}>Retry feedback</button></p> : feedback.length ? <ul className="mentor-feedback-history">{feedback.map((record) => <li key={record._id}><p>{record.comment}</p><footer>{record.author} · <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString()}</time>{preview && " · Preview"}</footer></li>)}</ul> : <p>No feedback for this application yet.</p>}
  </section>;
}
