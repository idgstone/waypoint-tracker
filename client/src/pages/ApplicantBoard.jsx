import ActionNotice, { useActionNotice } from "../components/ActionNotice.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board.jsx";
import ApiApplicationDetail from "./ApiApplicationDetail.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { createApplicationsApi } from "../services/applicationsApi.js";
import { createStageMover } from "../services/boardMoves.js";

export default function ApplicantBoard({ api, active, onMentors }) {
  const service = useMemo(() => createApplicationsApi(api), [api]);
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice, dismissNotice] = useActionNotice();
  const [deleting, setDeleting] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [reload, setReload] = useState(0);
  const alive = useRef(false);
  const revision = useRef(0);
  const applicationsRef = useRef(applications);
  applicationsRef.current = applications;
  const stageMover = useMemo(() => createStageMover(
    (id) => applicationsRef.current?.find((application) => application.id === id),
    async (id, { stage }) => { const record = await service.stage(id, stage); replace(record); return record; },
  ), [service]);
  async function updateStage(id, stage) { return (await stageMover(id, stage)).application; }
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const version = revision.current;
    setLoading(true); setError("");
    service.list(controller.signal).then((records) => { if (!controller.signal.aborted && version === revision.current) setApplications(records); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active, reload, service]);
  function replace(record) {
    revision.current++;
    if (alive.current) setApplications((previous) => previous?.map((item) => item.id === record.id ? record : item));
  }
  async function add(values) {
    const result = await service.create(values);
    if (alive.current) {
      revision.current++;
      setApplications((previous) => [result.application, ...(previous || []).filter((item) => item.id !== result.application.id)]);
      setNoteDrafts((previous) => ({ ...previous, [result.application.id]: result.unsavedNotes }));

    }
    return result;
  }
  return <div hidden={!active}>
    <div className="content-container">
      {loading && <p role="status">Loading applications...</p>}
      {error && <p role="alert">{error} <button type="button" className="button button--secondary" onClick={() => setReload((value) => value + 1)}>Retry</button></p>}
      <ActionNotice notice={notice} onDismiss={dismissNotice} />
    </div>
    {applications !== null && <Board authenticated applications={applications} onAdd={add} onDelete={setDeleting} onUpdate={(id, { stage }) => updateStage(id, stage)}
      renderDetail={(record, back) => <ApiApplicationDetail key={record.id} application={record} service={service} onRecord={replace} onStageUpdate={updateStage} onDelete={() => setDeleting(record)} onBack={back} onMentors={onMentors}
        initialNoteDraft={noteDrafts[record.id] || ""} onDraft={(text) => setNoteDrafts((previous) => ({ ...previous, [record.id]: text }))} />} />}
    {deleting && <ConfirmDialog title="Delete application?" confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={async () => {
      try { await service.remove(deleting.id); }
      catch (failure) {
        if (failure.status !== 404) throw failure;
        // A previous DELETE may have succeeded even if its response was lost.
      }
      if (alive.current) {
        revision.current++;
        setApplications((previous) => previous.filter((record) => record.id !== deleting.id));
        setNotice(`${deleting.role} at ${deleting.company} is no longer on your Board.`);
        setDeleting(null);
      }
    }}><p>Delete {deleting.role} at {deleting.company}? Its notes and mentor feedback will also be removed.</p></ConfirmDialog>}
  </div>;
}
