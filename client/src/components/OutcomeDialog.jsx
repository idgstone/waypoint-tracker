import { useEffect, useRef, useState } from "react";

export default function OutcomeDialog({ application, onSave, onCancel }) {
  const dialog = useRef(null);
  const lock = useRef(false);
  const [stage, setStage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const node = dialog.current;
    node.showModal(); node.querySelector("select").focus();
    return () => {
      node.close();
      requestAnimationFrame(() => (document.getElementById(`open-${application.id}`) || document.getElementById("board-add"))?.focus());
    };
  }, [application.id]);
  function keepFocus(event) {
    if (event.key !== "Tab") return;
    const controls = [...dialog.current.querySelectorAll("select:not(:disabled), button:not(:disabled)")];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={dialog} className="application-modal" aria-labelledby="outcome-title" aria-describedby="outcome-description" onKeyDown={keepFocus} onCancel={(event) => { event.preventDefault(); if (!lock.current) onCancel(); }}>
    <h2 id="outcome-title">Choose application outcome</h2>
    <p id="outcome-description">Move {application.role} at {application.company} to Offer or Rejected.</p>
    <form noValidate aria-busy={pending} onSubmit={async (event) => {
      event.preventDefault(); if (lock.current) return;
      if (!stage) { setError("Choose Offer or Rejected."); dialog.current.querySelector("select").focus(); return; }
      lock.current = true; setPending(true); setError("");
      try { await onSave(stage); }
      catch (failure) { setError(failure.message); }
      finally { lock.current = false; setPending(false); }
    }}>
      <div className="application-field"><label htmlFor="move-outcome">Outcome</label>
        <select id="move-outcome" required disabled={pending} value={stage} onChange={(event) => { setStage(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "move-outcome-error" : undefined}>
          <option value="">Choose an outcome</option><option value="offer">Offer</option><option value="rejected">Rejected</option>
        </select>
        {error && <p className="application-error" id="move-outcome-error" role="alert">{error}</p>}
      </div>
      <div className="application-actions"><button type="button" className="button button--secondary" aria-disabled={pending} onClick={() => { if (!lock.current) onCancel(); }}>Cancel</button><button className="button" disabled={pending}>{pending ? "Saving..." : "Save Outcome"}</button></div>
    </form>
  </dialog>;
}
