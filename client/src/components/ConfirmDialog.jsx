import { useEffect, useRef, useState } from "react";

function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const confirmed = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector("button").focus();
    return () => {
      dialog.close();
      requestAnimationFrame(() => {
        if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        else document.getElementById("board-add")?.focus();
      });
    };
  }, []);
  function keyDown(event) {
    if (event.key !== "Tab") return;
    const buttons = dialogRef.current.querySelectorAll("button:not(:disabled)");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={dialogRef} className="application-modal" aria-labelledby="confirmation-title" aria-describedby="confirmation-description"
    onKeyDown={keyDown} onCancel={(event) => { event.preventDefault(); if (!confirmed.current) onCancel(); }}>
    <h2 id="confirmation-title">{title}</h2>
    <div id="confirmation-description">{children}</div>
    {error && <p role="alert">{error}</p>}
    <div className="application-actions">
      <button type="button" className="button button--secondary" aria-disabled={pending} onClick={() => { if (!confirmed.current) onCancel(); }}>Cancel</button>
      <button type="button" className="button" disabled={pending} onClick={async () => {
        if (confirmed.current) return;
        confirmed.current = true; setPending(true); setError("");
        try { await onConfirm(); }
        catch (failure) { setError(failure.message); }
        finally { confirmed.current = false; setPending(false); }
      }}>{pending ? "Please wait..." : confirmLabel}</button>
    </div>
  </dialog>;
}

export default ConfirmDialog;
