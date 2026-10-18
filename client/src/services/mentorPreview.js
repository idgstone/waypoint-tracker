import { mentorSampleFeedback, previewMentor } from "../data/mentorFixtures.js";

export const MENTOR_PREVIEW_KEY = "waypoint.preview.mentorDashboard.v1";
export function selectedStudent(students, id) { return students.find((student) => student._id === id) ?? students[0] ?? null; }
export function selectedApplication(student, id) { return student?.applications.find((application) => application._id === id) ?? student?.applications[0] ?? null; }
export function currentStageCounts(applications) {
  const counts = { Applied: 0, "Online Assessment": 0, Interview: 0, Offer: 0, Rejected: 0 };
  for (const application of applications) if (Object.hasOwn(counts, application.stage)) counts[application.stage]++;
  return [counts.Applied, counts["Online Assessment"], counts.Interview, counts.Offer + counts.Rejected];
}
export function parseMentorFeedback(json) {
  const records = JSON.parse(json);
  if (!Array.isArray(records)) throw new Error("Invalid mentor preview");
  const ids = new Set();
  return records.map((record) => {
    if (!record || typeof record._id !== "string" || !record._id || ids.has(record._id)
      || typeof record.applicationId !== "string" || !record.applicationId
      || record.mentorId !== previewMentor._id || record.author !== previewMentor.name
      || typeof record.comment !== "string" || !record.comment.trim()
      || typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt))) throw new Error("Invalid feedback record");
    ids.add(record._id);
    return { _id: record._id, applicationId: record.applicationId, mentorId: record.mentorId, author: record.author, comment: record.comment, createdAt: record.createdAt };
  });
}
export function loadMentorFeedback(enabled, getStorage = () => window.localStorage) {
  const defaults = () => mentorSampleFeedback.map((record) => ({ ...record }));
  if (!enabled) return { feedback: defaults(), error: "" };
  try {
    const json = getStorage().getItem(MENTOR_PREVIEW_KEY);
    return { feedback: json === null ? defaults() : parseMentorFeedback(json), error: "" };
  } catch { return { feedback: defaults(), error: "Saved mentor preview comments could not be loaded. Fictional examples are shown." }; }
}
export function saveMentorFeedback(feedback, enabled, getStorage = () => window.localStorage) {
  if (!enabled) return "Mentor preview is available in development only.";
  try { getStorage().setItem(MENTOR_PREVIEW_KEY, JSON.stringify(parseMentorFeedback(JSON.stringify(feedback)))); return ""; }
  catch { return "Comment could not be saved in this browser. Your draft is still unsaved."; }
}
export function createMentorFeedback(student, applicationId, comment) {
  if (!student?.applications.some((application) => application._id === applicationId)) return { error: "Select an available application." };
  if (!comment.trim()) return { error: "Enter feedback before sending." };
  return { record: { _id: `preview-feedback-${crypto.randomUUID()}`, applicationId, mentorId: previewMentor._id, author: previewMentor.name, comment: comment.trim(), createdAt: new Date().toISOString() } };
}
