import { sampleApplications } from "../data/sampleApplications.js";
import { applicationStages } from "../data/applicationStages.js";

export const PREVIEW_STORAGE_KEY = "waypoint.preview.applications.v1";

export function createSampleApplications() {
  return sampleApplications.map((application) => ({
    ...application, appliedDate: "2026-09-10", reminder: false, notes: "",
    history: [{ id: `${application.id}-initial`, stage: application.stage, date: "2026-09-10" }],
    feedback: Array.from({ length: application.feedbackCount }, (_, index) => ({ id: `${application.id}-feedback-${index}`, text: "Review your preparation notes before the next step.", author: "Sample mentor" })),
  }));
}

const isText = (value) => typeof value === "string";
const isDate = (value) => isText(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isStage = (value) => Object.hasOwn(applicationStages, value);

// Validate saved records and copy only preview fields; never retain extra account fields.
export function parsePreviewApplications(json) {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("Expected an application list");
  const ids = new Set();
  return data.map((item) => {
    if (!item || !isText(item.id) || !item.id || ids.has(item.id)
      || !isText(item.company) || !item.company.trim() || !isText(item.role) || !item.role.trim()
      || !isStage(item.stage) || !isDate(item.appliedDate)
      || !(item.deadline == null || item.deadline === "" || isDate(item.deadline))
      || typeof item.reminder !== "boolean" || (item.reminder && !item.deadline) || !isText(item.notes)
      || !Array.isArray(item.history) || !Array.isArray(item.feedback)) throw new Error("Invalid preview record");
    ids.add(item.id);
    const historyIds = new Set();
    const history = item.history.map((entry) => {
      if (!entry || !isText(entry.id) || !entry.id || historyIds.has(entry.id) || !isStage(entry.stage) || !isDate(entry.date)) throw new Error("Invalid history");
      historyIds.add(entry.id);
      return { id: entry.id, stage: entry.stage, date: entry.date };
    });
    const feedbackIds = new Set();
    const feedback = item.feedback.map((entry) => {
      if (!entry || !isText(entry.id) || !entry.id || feedbackIds.has(entry.id) || !isText(entry.text) || !isText(entry.author)) throw new Error("Invalid feedback");
      feedbackIds.add(entry.id);
      return { id: entry.id, text: entry.text, author: entry.author };
    });
    return { id: item.id, company: item.company, role: item.role, stage: item.stage, appliedDate: item.appliedDate,
      deadline: item.deadline || "", reminder: item.reminder, notes: item.notes, history, feedback, feedbackCount: feedback.length };
  });
}

export function loadPreviewApplications(enabled, getStorage = () => window.localStorage) {
  if (!enabled) return { applications: createSampleApplications(), error: "" };
  try {
    const json = getStorage().getItem(PREVIEW_STORAGE_KEY);
    return { applications: json === null ? createSampleApplications() : parsePreviewApplications(json), error: "" };
  } catch {
    return { applications: createSampleApplications(), error: "Saved preview data could not be loaded. Sample data is shown instead." };
  }
}

export function savePreviewApplications(applications, enabled, getStorage = () => window.localStorage) {
  if (!enabled) return "";
  try {
    const safeApplications = parsePreviewApplications(JSON.stringify(applications));
    getStorage().setItem(PREVIEW_STORAGE_KEY, JSON.stringify(safeApplications));
    return "";
  } catch {
    return "Preview changes could not be saved in this browser. They may be lost on refresh.";
  }
}
