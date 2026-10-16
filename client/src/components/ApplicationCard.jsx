import StageTag from "./StageTag.jsx";
import ApplicationActions from "./ApplicationActions.jsx";

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

function ApplicationCard({ application, today, onOpen, onDelete }) {
  const { id, company, role, stage, deadline, feedbackCount } = application;
  const deadlineLabel = deadlineText(deadline, today);
  return (
    <article className={`application-card application-card--${stage}`} aria-labelledby={`${id}-title`}>
      <ApplicationActions application={application} onOpen={onOpen} onDelete={onDelete} />
      <h3 id={`${id}-title`}><button type="button" id={`open-${id}`} className="application-card__open" onClick={() => onOpen(id)} aria-label={`View ${company}, ${role}`}>{company}</button></h3>
      <p className="application-card__role">{role}</p>
      {deadlineLabel && <p className="application-card__deadline"><span aria-hidden="true">⚑ </span><time dateTime={deadline}>{deadlineLabel}</time></p>}
      <StageTag stage={stage} />
      {feedbackCount > 0 && <p className="application-card__feedback"><span aria-hidden="true">💬 </span>{feedbackCount} feedback comment{feedbackCount === 1 ? "" : "s"}</p>}
    </article>
  );
}

export default ApplicationCard;
