import StageTag from "./StageTag.jsx";
import ApplicationActions from "./ApplicationActions.jsx";
import { useRef } from "react";

export function deadlineText(deadline, today = new Date()) {
  if (!deadline) return null;
  const [year, month, day] = deadline.split("-").map(Number);
  // Compare calendar days rather than elapsed hours, including across DST changes.
  const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function ApplicationCard({ application, today, onOpen, onDelete, drag }) {
  const blockDrag = useRef(false);
  const ignoreClick = useRef(false);
  const { id, company, role, stage, deadline, feedbackCount } = application;
  const deadlineLabel = deadlineText(deadline, today);
  const pending = drag?.pendingId === id;
  return (
    <article className={`application-card application-card--${stage}${drag?.id === id ? " is-dragging" : ""}${pending ? " is-saving-stage" : ""}`} aria-labelledby={`${id}-title`}
      draggable={Boolean(drag && !drag.pendingId)} aria-busy={pending || undefined} aria-describedby={drag ? "board-drag-help" : undefined}
      onPointerDownCapture={(event) => { ignoreClick.current = false; blockDrag.current = Boolean(event.target.closest(".application-actions-menu")); }}
      onKeyDownCapture={() => { ignoreClick.current = false; }}
      onClickCapture={(event) => { if (ignoreClick.current) { event.preventDefault(); event.stopPropagation(); } }}
      onClick={(event) => { if (!pending && !event.target.closest("button, a, input, select, textarea, .application-actions-menu")) onOpen(id); }}
      onDragStart={(event) => {
        if (!drag || blockDrag.current || drag.pendingId) { event.preventDefault(); return; }
        ignoreClick.current = true; drag.start(event, application);
      }} onDragEnd={() => { drag?.end(); }}>
      {drag && <span className="application-card__drag-hint" aria-hidden="true">⠿</span>}
      <ApplicationActions application={application} onOpen={onOpen} onDelete={onDelete} disabled={pending} />
      <h3 id={`${id}-title`}><button type="button" id={`open-${id}`} disabled={pending} className="application-card__open" onClick={() => onOpen(id)} aria-label={`View ${company}, ${role}`}>{company}</button></h3>
      <p className="application-card__role">{role}</p>
      {deadlineLabel && <p className="application-card__deadline"><span aria-hidden="true">⚑ </span><time dateTime={deadline}>{deadlineLabel}</time></p>}
      <StageTag stage={stage} />
      {pending && <p className="application-card__feedback">Saving stage...</p>}
      {feedbackCount > 0 && <p className="application-card__feedback"><span aria-hidden="true">💬 </span>{feedbackCount} feedback comment{feedbackCount === 1 ? "" : "s"}</p>}
    </article>
  );
}

export default ApplicationCard;
