import { applicationStages } from "../data/applicationStages.js";

export const APPLICATION_DRAG_TYPE = "application/x-waypoint-application";

export function boardDrop(application, columnId) {
  if (!application) return { kind: "invalid" };
  if (columnId === "outcomes") return ["offer", "rejected"].includes(application.stage) ? { kind: "same" } : { kind: "outcome" };
  if (!["applied", "onlineAssessment", "interview"].includes(columnId)) return { kind: "invalid" };
  return application.stage === columnId ? { kind: "same" } : { kind: "move", stage: columnId };
}

// The callback owns state/persistence. A synchronous lock guards repeated drops.
export function createStageMover(getApplication, update, onPending = () => {}) {
  let pending = false;
  return async (id, stage) => {
    if (pending) throw new Error("Another stage change is being saved. Please wait.");
    const application = getApplication(id);
    if (!application) throw new Error("Application is no longer available. Refresh the Board.");
    if (!Object.hasOwn(applicationStages, stage)) throw new Error("Choose a valid application stage.");
    if (application.stage === stage) return { moved: false, application };
    pending = true; onPending(id);
    try {
      const saved = await update(id, { stage });
      return { moved: true, application: saved || { ...application, stage } };
    } finally { pending = false; onPending(null); }
  };
}
