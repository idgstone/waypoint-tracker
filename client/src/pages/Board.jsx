import { useEffect, useRef, useState } from "react";
import BoardColumn from "../components/BoardColumn.jsx";
import AddApplicationModal from "../components/AddApplicationModal.jsx";
import ApplicationDetail from "./ApplicationDetail.jsx";
import "../styles/board.css";

const columns = [
  { id: "applied", title: "Applied", stages: ["applied"] },
  { id: "onlineAssessment", title: "Online Assessment", stages: ["onlineAssessment"] },
  { id: "interview", title: "Interview", stages: ["interview"] },
  { id: "outcomes", title: "Offer/Rejected", stages: ["offer", "rejected"] },
];

function Board({ applications, onAdd, onUpdate, onDelete }) {
  const [notice, setNotice] = useState("");
  const [initialStage, setInitialStage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const returnCard = useRef(null);
  const restoreCard = useRef(false);
  useEffect(() => {
    if (!selectedId && restoreCard.current) {
      document.getElementById(returnCard.current)?.focus();
      restoreCard.current = false;
    }
  }, [selectedId]);
  const today = new Date();
  function openDetail(id) {
    returnCard.current = `open-${id}`;
    setSelectedId(id);
  }
  const selected = applications.find((application) => application.id === selectedId);
  if (selected) return <ApplicationDetail key={selected.id} application={selected} onUpdate={onUpdate} onDelete={onDelete} onBack={() => { restoreCard.current = true; setSelectedId(null); }} />;
  return (
    <main className="content-container board-page">
      <div className="board-toolbar">
        <h1>My Applications</h1>
        <button id="board-add" type="button" className="button" onClick={() => setInitialStage("applied")}>+ Add Application</button>
      </div>
      <p className="board-notice" role="status" aria-live="polite">{notice}</p>
      <div className="board-scroll" role="region" aria-label="Application columns, scroll horizontally to view all stages" tabIndex={0}>
        <div className="board-grid">
          {columns.map(({ id, title, stages }) => (
            <BoardColumn key={id} id={id} title={title}
              applications={applications.filter((application) => stages.includes(application.stage))}
              onAdd={() => setInitialStage(stages.length === 1 ? stages[0] : "")} onOpen={openDetail} onDelete={onDelete} today={today} />
          ))}
        </div>
      </div>
      {initialStage !== null && <AddApplicationModal initialStage={initialStage} onClose={() => setInitialStage(null)} onSave={(values) => { onAdd(values); setInitialStage(null); setNotice(`${values.company} application added.`); }} />}
    </main>
  );
}

export default Board;
