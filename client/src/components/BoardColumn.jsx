import ApplicationCard from "./ApplicationCard.jsx";

function BoardColumn({ id, title, applications, onAdd, onOpen, onDelete, today, drag }) {
  const available = drag?.available(id);
  return (
    <section className={`board-column${available ? " is-drop-available" : ""}${available && drag?.targetId === id ? " is-drop-target" : ""}`} aria-labelledby={`column-${id}`}
      onDragOver={(event) => drag?.over(event, id)} onDragLeave={(event) => drag?.leave(event, id)} onDrop={(event) => drag?.drop(event, id)}>
      <h2 id={`column-${id}`}>{title} <span className="board-column__count">· {applications.length}</span></h2>
      <ul className="board-column__cards">
        {applications.map((application) => <li key={application.id}><ApplicationCard application={application} today={today} onOpen={onOpen} onDelete={onDelete} drag={drag} /></li>)}
      </ul>
      <button type="button" className="board-column__new" onClick={() => onAdd(title)} aria-label={`New application in ${title}`}>+ New</button>
    </section>
  );
}

export default BoardColumn;
