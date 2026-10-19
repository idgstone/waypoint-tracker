import { useEffect, useRef, useState } from "react";
import InviteMentorModal from "../components/InviteMentorModal.jsx";
import { invitationConfirmation } from "../services/invitationConfirmation.js";
import "../styles/mentors.css";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

export default function Mentors({ links, onInvite, onBackToBoard, storageError, preview = true, loading = false, error = "", onRetry, onRevoke, notice = "" }) {
  const [open, setOpen] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [invitation]);
  const linked = links.filter((link) => link.status === "accepted");
  const pending = links.filter((link) => link.status === "pending");
  if (invitation) return <main className="content-container mentor-confirmation-layout">
    <section className="card mentor-confirmation" aria-labelledby="invite-confirmation-title">
      <span className="mentor-confirmation-icon" aria-hidden="true">✓</span>
      {invitation.preview && <aside className="mentor-confirmation-preview"><strong>Preview only — no email was sent.</strong><p>This is a preview of the success screen. The invitation remains pending; no mentor connection was created.</p></aside>}
      <h1 id="invite-confirmation-title" ref={heading} tabIndex={-1}>{invitation.heading}</h1>
      <p>{invitation.message}</p>
      {storageError && <p role="status">{storageError}</p>}
      {error && <p role="alert">{error} <button className="button button--secondary" onClick={onRetry}>Retry mentor links</button></p>}
      <button type="button" className="button" onClick={onBackToBoard}>Back to Dashboard</button>
      <button type="button" className="auth-link" onClick={() => setInvitation(null)}>Back to Mentors</button>
    </section>
  </main>;
  return <main className="content-container mentors-page">
    <div className="mentors-toolbar"><h1 ref={heading} tabIndex={-1}>Mentors</h1><button type="button" className="button" disabled={loading || Boolean(error)} onClick={() => setOpen(true)}>Invite Mentor</button></div>
    <p>Linked mentors can view your pipeline read-only and leave feedback on individual applications.</p>
    {preview && <p className="mentors-preview-note">Development preview: invitations are saved separately in this browser. No emails are sent and no real mentor access is granted. Use fictional email addresses.</p>}
    {!preview && <p>Invitations grant access to your entire pipeline after acceptance, not to an individual application.</p>}
    {loading && <p role="status">Loading mentor links...</p>}
    {error && <p role="alert">{error} <button className="button button--secondary" onClick={onRetry}>Retry</button></p>}
    {notice && <p role="status">{notice}</p>}
    {storageError && <p role="status">{storageError}</p>}
    {!loading && !error && <div className="mentors-sections">
      <section className="card" aria-labelledby="linked-mentors-title"><h2 id="linked-mentors-title">Linked mentors</h2>
        {linked.length ? <ul className="mentor-list">{linked.map((link) => <li key={link._id}><strong>{link.mentor?.name || link.mentorEmail}</strong>{link.mentor?.name && <span>{link.mentorEmail}</span>}<span>{!preview && !link.mentor ? "Mentor account unavailable · Link accepted" : "Linked · Read-only pipeline access"}</span>{onRevoke && <button className="auth-link" onClick={() => setRevoking(link)}>Revoke access</button>}</li>)}</ul> : <p>No linked mentors yet. A mentor must accept an invitation before they can access your pipeline.</p>}
      </section>
      <section className="card" aria-labelledby="pending-invitations-title"><h2 id="pending-invitations-title">Pending invitations</h2>
        {pending.length ? <ul className="mentor-list">{pending.map((link) => <li key={link._id}><strong>{link.mentorEmail}</strong><span>{preview ? "Pending · Preview only · No email sent" : "Pending · Awaiting mentor acceptance"}</span>{onRevoke && <button className="auth-link" onClick={() => setRevoking(link)}>Cancel invitation</button>}</li>)}</ul> : <p>{preview ? "No pending invitations. Invite a mentor to preview the invitation flow." : "No pending invitations. Invite a mentor using their email address."}</p>}
      </section>
    </div>}
    {revoking && <ConfirmDialog title={revoking.status === "accepted" ? "Revoke mentor access?" : "Cancel invitation?"} confirmLabel={revoking.status === "accepted" ? "Revoke access" : "Cancel invitation"} onCancel={() => setRevoking(null)} onConfirm={async () => { await onRevoke(revoking); setRevoking(null); requestAnimationFrame(() => heading.current?.focus()); }}><p>{revoking.status === "accepted" ? "Remove read-only pipeline access for" : "Cancel the pending invitation for"} {revoking.mentorEmail}?</p></ConfirmDialog>}
    {open && <InviteMentorModal preview={preview} links={links} onClose={() => setOpen(false)} onInvite={async (email) => {
      const result = await onInvite(email);
      if (result?.error) return result.error;
      const confirmation = invitationConfirmation(result, preview && import.meta.env.DEV);
      if (!confirmation) return "The invitation could not be confirmed. Please try again.";
      setOpen(false); setInvitation(confirmation); return "";
    }} />}
  </main>;
}
