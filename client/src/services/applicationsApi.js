import { applicationStages } from "../data/applicationStages.js";

const stageKeys = Object.fromEntries(Object.entries(applicationStages).map(([key, label]) => [label, key]));
export function adaptApplication(record) {
  if (!record || typeof record._id !== "string" || !stageKeys[record.stage]) throw new Error("The server returned an invalid application.");
  return {
    ...record, id: record._id, role: record.position, stage: stageKeys[record.stage],
    appliedDate: record.dateApplied?.slice(0, 10) || "", deadline: record.deadline?.slice(0, 10) || "",
    reminder: record.reminderEnabled, noteRecords: record.notes || [],
    history: (record.stageHistory || []).map((entry, index) => ({ id: `${record._id}-${index}`, stage: stageKeys[entry.stage], date: entry.changedAt })),
  };
}
export function createApplicationsApi(api) {
  const path = (id) => `/applications/${encodeURIComponent(id)}`;
  return {
    async list(signal) {
      const records = await api.request("/applications", { signal });
      if (!Array.isArray(records)) throw new Error("The server returned an invalid application list.");
      return records.map(adaptApplication);
    },
    async detail(id, signal) { return adaptApplication(await api.request(path(id), { signal })); },
    async feedback(id, signal) {
      const records = await api.request(`${path(id)}/feedback`, { signal });
      if (!Array.isArray(records)) throw new Error("The server returned invalid feedback.");
      return records;
    },
    async stage(id, stage) {
      const record = adaptApplication(await api.request(`${path(id)}/stage`, { method: "PATCH", body: { stage: applicationStages[stage] } }));
      if (record.id !== id || record.stage !== stage) throw new Error("The server did not confirm the requested stage change. Refresh the application before retrying.");
      return record;
    },
    remove(id) { return api.request(path(id), { method: "DELETE" }); },
    note(id, text, noteId) {
      return api.request(`${path(id)}/notes${noteId ? `/${encodeURIComponent(noteId)}` : ""}`, { method: noteId ? "PATCH" : "POST", body: { text: text.trim() } });
    },
    removeNote(id, noteId) { return api.request(`${path(id)}/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" }); },
    async create(values) {
      let application;
      try {
        application = adaptApplication(await api.request("/applications", { method: "POST", body: {
          company: values.company, position: values.role, dateApplied: values.appliedDate,
          deadline: values.deadline || null, reminderEnabled: Boolean(values.reminder),
        } }));
      } catch (error) {
        if (!error.status || error.status >= 500) error.creationUncertain = true;
        throw error;
      }
      const warnings = [];
      let unsavedNotes = "";
      if (values.stage !== "applied") {
        try { application = await this.stage(application.id, values.stage); }
        catch (error) {
          if (error.status === 401 || error.status === 499) throw error;
          warnings.push(`Application created in Applied, but stage change was not confirmed. ${error.message} Open details to check its stage before retrying.`);
        }
      }
      if (values.notes.trim()) {
        try {
          const note = await this.note(application.id, values.notes);
          application = { ...application, noteRecords: [...application.noteRecords, note] };
        } catch (error) {
          if (error.status === 401 || error.status === 499) throw error;
          unsavedNotes = values.notes;
          warnings.push(`Application created, but the initial note was not confirmed. ${error.message} Your note draft is available in details; check existing notes before saving again.`);
        }
      }
      return { application, unsavedNotes, requiresAttention: warnings.length > 0, message: warnings.join(" ") || `${application.company} application saved.` };
    },
  };
}
