import ApplicationCard from "./ApplicationCard.jsx";

function BoardColumn({ id, title, applications, onAdd, onOpen, onDelete, today }) {
  return (
    <section className="board-column" aria-labelledby={`column-${id}`}>
      <h2 id={`column-${id}`}>{title} <span className="board-column__count">· {applications.length}</span></h2>
      <ul className="board-column__cards">
        {applications.map((application) => <li key={application.id}><ApplicationCard application={application} today={today} onOpen={onOpen} onDelete={onDelete} /></li>)}
      </ul>
      <button type="button" className="board-column__new" onClick={() => onAdd(title)} aria-label={`New application in ${title}`}>+ New</button>
    </section>
  );
}

export default BoardColumn;
