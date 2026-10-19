import { validateSettings } from "./previewSettings.js";

export function settingsPayload(draft) {
  const errors = validateSettings(draft);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const preferences = draft.notificationPreferences;
  if (typeof preferences?.deadlineReminders !== "boolean" || typeof preferences?.mentorFeedback !== "boolean") throw new Error("Notification preferences must be true or false.");
  return { name: draft.name.trim(), notificationPreferences: { deadlineReminders: preferences.deadlineReminders, mentorFeedback: preferences.mentorFeedback } };
}

export function changedSettingsPayload(draft, saved) {
  const valid = settingsPayload(draft);
  const payload = {};
  if (valid.name !== saved.name) payload.name = valid.name;
  const changed = Object.fromEntries(Object.entries(valid.notificationPreferences).filter(([key, value]) => value !== saved.notificationPreferences[key]));
  if (Object.keys(changed).length) payload.notificationPreferences = changed;
  return payload;
}

export function mapSettings(record, accountId) {
  if (!record || record._id !== accountId || !["applicant", "mentor", "admin"].includes(record.role)) throw new Error("The server returned settings for an unavailable or different account.");
  const editable = settingsPayload(record);
  return { id: record._id, ...editable, email: record.email, role: record.role };
}

export function createSettingsApi(api, accountId) {
  return {
    async load(signal) { return mapSettings(await api.request("/settings", { signal }), accountId); },
    async save(draft, saved) { return mapSettings(await api.request("/settings", { method: "PATCH", body: saved ? changedSettingsPayload(draft, saved) : settingsPayload(draft) }), accountId); },
  };
}

export function createSettingsLoader(service) {
  let generation = 0;
  let controller;
  function cancel() { generation++; controller?.abort(); }
  return {
    cancel,
    async load(publish) {
      cancel(); const current = generation;
      controller = new AbortController();
      publish({ loading: true, error: "" });
      try {
        const settings = await service.load(controller.signal);
        if (current === generation) publish({ loading: false, error: "", settings });
      } catch (failure) {
        if (current === generation) publish({ loading: false, error: failure.message });
      }
    },
  };
}
