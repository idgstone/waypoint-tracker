import { useEffect, useRef, useState } from "react";
import { validateMentorEmail } from "../services/previewMentors.js";

export default function InviteMentorModal({ links, onInvite, onClose, preview = true }) {
  const [mentorEmail, setMentorEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dialogRef = useRef(null);
  const submitted = useRef(false);
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector("input").focus();
    return () => { dialog.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (submitted.current) return;
    const validation = validateMentorEmail(mentorEmail, links);
    if (validation) { setError(validation); dialogRef.current.querySelector("input").focus(); return; }
    submitted.current = true;
    setPending(true); setError("");
    try {
      const saveError = await onInvite(mentorEmail);
      if (saveError) { setError(saveError); dialogRef.current.querySelector("input")?.focus(); }
    } catch (failure) { setError(failure.message); }
    finally { submitted.current = false; setPending(false); }
  }
  function keepFocus(event) {
    if (event.key !== "Tab") return;
    const controls = dialogRef.current.querySelectorAll("input:not(:disabled), button:not(:disabled)");
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={dialogRef} className="mentor-invite-modal" aria-labelledby="invite-title" aria-describedby="invite-help"
    onKeyDown={keepFocus} onCancel={(event) => { event.preventDefault(); if (!submitted.current) onClose(); }}>
    <h2 id="invite-title">Invite a Mentor</h2>
    <form onSubmit={submit} noValidate aria-busy={pending}>
      <div className="mentor-invite-body">
        <label htmlFor="mentor-email">Mentor’s email <span className="application-required">*</span></label>
        <input id="mentor-email" name="mentorEmail" type="email" autoComplete="email" value={mentorEmail} required readOnly={pending}
          onChange={(event) => { setMentorEmail(event.target.value); setError(""); }}
          aria-invalid={Boolean(error)} aria-describedby={error ? "invite-error invite-help" : "invite-help"} />
        {error && <p id="invite-error" className="application-error" role="alert">{error}</p>}
        <p id="invite-help">Linked mentors can view your pipeline read-only and leave feedback on individual applications. {preview ? "This preview creates a pending invitation only; no email is sent and no access is granted." : "An invitation grants pipeline access only after the mentor accepts; it does not share just one application."}</p>
      </div>
      <div className="mentor-invite-footer"><button type="button" className="button button--secondary" aria-disabled={pending} onClick={() => { if (!submitted.current) onClose(); }}>Cancel</button><button className="button" type="submit" disabled={pending}>{pending ? "Sending..." : "Send Invite"}</button></div>
    </form>
  </dialog>;
}
