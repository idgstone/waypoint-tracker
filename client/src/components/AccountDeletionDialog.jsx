import { useEffect, useRef, useState } from "react";
import { deletionReady, deletionUnavailable } from "../services/accountDeletion.js";
import "../styles/accountDeletion.css";

// No request is possible until an approved adapter and scope are explicitly enabled.
export default function AccountDeletionDialog({ target, scope, passwordLabel = "Current password", onDelete, onCancel, mockOnly = false, available = false }) {
  const dialog = useRef(null), field = useRef(null), lock = useRef(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const ready = deletionReady({ available, onDelete, scope });
  useEffect(() => {
    const opener = document.activeElement, element = dialog.current, input = field.current;
    element.showModal(); input.focus();
    return () => { input.value = ""; element.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  function cancel() { setPassword(""); field.current.value = ""; if (!lock.current) onCancel(); }
  async function submit(event) {
    event.preventDefault();
    if (lock.current || uncertain || !ready) return;
    if (!password.trim()) { setPasswordError(true); setError("Enter your current password."); field.current.focus(); return; }
    lock.current = true; setPending(true); setError(""); setPasswordError(false);
    try { await onDelete(password); }
    catch (failure) {
      const message = String(failure.message || "Deletion could not be confirmed.");
      setError(message.includes(password) ? "Deletion could not be confirmed. Check your account before trying again." : message);
      setUncertain(Boolean(failure.uncertain));
      setPasswordError(["invalid-password", "password-required"].includes(failure.code));
      if (["invalid-password", "password-required"].includes(failure.code)) field.current?.focus();
    }
    finally { setPassword(""); if (field.current) field.current.value = ""; lock.current = false; setPending(false); }
  }
  function trap(event) {
    if (event.key !== "Tab") return;
    event.stopPropagation(); // Keep an enclosing account panel from trapping this dialog's Tab.
    const controls = [...dialog.current.querySelectorAll("button,input")].filter((control) => !control.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={dialog} className="application-modal account-deletion-dialog" aria-labelledby="account-delete-title" aria-describedby="account-delete-scope" onCancel={(event) => { event.preventDefault(); event.stopPropagation(); cancel(); }} onKeyDown={trap}>
    <h2 id="account-delete-title">Delete account?</h2>
    {mockOnly && <p>Mock test only. No real account will be deleted.</p>}
    <p>{target.name} ({target.email})</p>
    <p id="account-delete-scope">Deletion is permanent and cannot be undone.{scope && <> {scope}</>}</p>
    {!ready && <p id="account-delete-availability" role="status">{deletionUnavailable}</p>}
    <form onSubmit={submit} noValidate aria-busy={pending}>
      <label htmlFor="account-delete-password">{passwordLabel}</label>
      <input ref={field} id="account-delete-password" type="password" autoComplete="current-password" value={password} readOnly={pending || !ready} required onChange={(event) => setPassword(event.target.value)} aria-invalid={passwordError} aria-describedby={error ? "account-delete-error" : !ready ? "account-delete-availability" : undefined} />
      {error && <p id="account-delete-error" role="alert">{error}</p>}
      {pending && <p role="status">Waiting for deletion confirmation...</p>}
      <div className="application-actions"><button type="button" className="button button--secondary" aria-disabled={pending} onClick={cancel}>Cancel</button><button type="submit" className="button button--danger" disabled={pending || uncertain || !ready}>{pending ? "Deleting..." : "Permanently delete account"}</button></div>
    </form>
  </dialog>;
}
