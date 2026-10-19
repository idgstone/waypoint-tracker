import ActionNotice, { useActionNotice } from "../components/ActionNotice.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import BoardColumn from "../components/BoardColumn.jsx";
import AddApplicationModal from "../components/AddApplicationModal.jsx";
import ApplicationDetail from "./ApplicationDetail.jsx";
import "../styles/board.css";
import OutcomeDialog from "../components/OutcomeDialog.jsx";
import { APPLICATION_DRAG_TYPE, boardDrop, createStageMover } from "../services/boardMoves.js";
import { applicationStages } from "../data/applicationStages.js";

const columns = [
  { id: "applied", title: "Applied", stages: ["applied"] },
  { id: "onlineAssessment", title: "Online Assessment", stages: ["onlineAssessment"] },
  { id: "interview", title: "Interview", stages: ["interview"] },
  { id: "outcomes", title: "Offer/Rejected", stages: ["offer", "rejected"] },
];

function Board({ applications, onAdd, onUpdate, onDelete, onMentors, renderDetail, authenticated = false }) {
  const [notice, setNotice, dismissNotice] = useActionNotice();
  const [initialStage, setInitialStage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [outcomeId, setOutcomeId] = useState(null);
  const [moveError, setMoveError] = useState("");
  const dragSource = useRef(null);
  const latest = useRef({ applications, onUpdate });
  latest.current = { applications, onUpdate };
  const saveMove = useMemo(() => createStageMover(
    (id) => latest.current.applications.find((application) => application.id === id),
    (id, changes) => latest.current.onUpdate(id, changes), setPendingId,
  ), []);
  useEffect(() => {
    if (outcomeId && !applications.some((application) => application.id === outcomeId)) {
      setOutcomeId(null); setMoveError("Application is no longer available. Refresh the Board.");
    }
  }, [applications, outcomeId]);
  const returnCard = useRef(null);
  const restoreCard = useRef(false);
  useEffect(() => {
    if (!selectedId && restoreCard.current) {
      document.getElementById(returnCard.current)?.focus();
      restoreCard.current = false;
    }
  }, [selectedId]);
  const today = new Date();
  function endDrag() { dragSource.current = null; setDragId(null); setTargetId(null); }
  async function move(id, stage) {
    setMoveError(""); setNotice("");
    try {
      const result = await saveMove(id, stage);
      setNotice(result.moved ? `${result.application.role} at ${result.application.company} moved to ${applicationStages[stage]}.` : "Stage unchanged. No move or history entry was saved.");
      return result;
    } catch (failure) { setMoveError(`${failure.message} The card has not been moved. Refresh to check the server if the response was lost.`); throw failure; }
  }
  const drag = {
    id: dragId, targetId, pendingId,
    start(event, application) {
      if (pendingId || outcomeId || !onUpdate) { event.preventDefault(); return; }
      dragSource.current = application.id; setDragId(application.id); setMoveError("");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(APPLICATION_DRAG_TYPE, application.id);
    },
    end: endDrag,
    available(columnId) { return ["move", "outcome"].includes(boardDrop(applications.find((application) => application.id === dragId), columnId).kind); },
    over(event, columnId) {
      if (!dragSource.current || pendingId || outcomeId) return;
      event.preventDefault(); event.dataTransfer.dropEffect = "move"; setTargetId(columnId);
    },
    leave(event, columnId) {
      if (!event.currentTarget.contains(event.relatedTarget)) setTargetId((previous) => previous === columnId ? null : previous);
    },
    drop(event, columnId) {
      event.preventDefault();
      const id = event.dataTransfer.getData(APPLICATION_DRAG_TYPE);
      if (!id || id !== dragSource.current || pendingId || outcomeId) { endDrag(); return; }
      const decision = boardDrop(applications.find((item) => item.id === id), columnId);
      endDrag();
      if (decision.kind === "same") { setNotice("Stage unchanged. Card ordering is not saved."); return; }
      if (decision.kind === "outcome") { setOutcomeId(id); return; }
      if (decision.kind === "move") move(id, decision.stage).catch(() => {});
    },
  };
  function openDetail(id) {
    setNotice(""); setMoveError("");
    returnCard.current = `open-${id}`;
    setSelectedId(id);
  }
  const selected = applications.find((application) => application.id === selectedId);
  if (selected && renderDetail) return renderDetail(selected, () => { restoreCard.current = true; setSelectedId(null); });
  if (selected) return <ApplicationDetail key={selected.id} application={selected} onUpdate={onUpdate} onDelete={onDelete} onMentors={onMentors} onBack={() => { restoreCard.current = true; setSelectedId(null); }} />;
  return (
    <main className="content-container board-page">
      <div className="board-toolbar">
        <h1>My Applications</h1>
        <button id="board-add" type="button" className="button" onClick={() => setInitialStage("applied")}>+ Add Application</button>
      </div>
      <ActionNotice notice={notice} onDismiss={dismissNotice} />
      {moveError && <p role="alert" className="application-error">{moveError}</p>}
      {onUpdate && <details className="board-move-help"><summary>How to move applications</summary><p id="board-drag-help">Drag a card to another stage, or open it and use the Stage selector with a keyboard or touch. Choose Offer or Rejected when prompted. Card ordering is not saved.</p></details>}
      {pendingId && <p role="status">Saving stage change...</p>}
      {authenticated && applications.length === 0 && <p>Add your first application using + Add Application or a column’s + New button.</p>}
      <div className="board-scroll" role="region" aria-label="Application columns, scroll horizontally to view all stages" tabIndex={0}>
        <div className="board-grid">
          {columns.map(({ id, title, stages }) => (
            <BoardColumn key={id} id={id} title={title} drag={onUpdate ? drag : undefined}
              applications={applications.filter((application) => stages.includes(application.stage))}
              onAdd={() => setInitialStage(stages.length === 1 ? stages[0] : "")} onOpen={openDetail} onDelete={onDelete} today={today} />
          ))}
        </div>
      </div>
      {initialStage !== null && <AddApplicationModal initialStage={initialStage} onClose={() => setInitialStage(null)} onSave={async (values) => { const result = await onAdd(values); setInitialStage(null); setNotice(result?.message || `${values.company} application added.`, { persistent: result?.requiresAttention }); }} />}
      {outcomeId && applications.find((application) => application.id === outcomeId) && <OutcomeDialog application={applications.find((application) => application.id === outcomeId)} onCancel={() => setOutcomeId(null)} onSave={async (stage) => { await move(outcomeId, stage); setOutcomeId(null); }} />}
    </main>
  );
}

export default Board;
