export const PREVIEW_SETTINGS_KEY = "waypoint.preview.settings.v1";
export const defaultPreviewSettings = () => ({ name: "Jack Wilson", email: "jack@example.com", role: "applicant",
  notificationPreferences: { deadlineReminders: false, mentorFeedback: false } });

export function validateSettings(values) {
  const errors = {};
  if (typeof values.name !== "string" || !values.name.trim()) errors.name = "Enter your full name.";
  if (typeof values.email !== "string" || !values.email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  return errors;
}

export function parsePreviewSettings(json) {
  const value = JSON.parse(json);
  if (!value || Object.keys(validateSettings(value)).length || value.role !== "applicant"
    || typeof value.notificationPreferences?.deadlineReminders !== "boolean"
    || typeof value.notificationPreferences?.mentorFeedback !== "boolean") throw new Error("Invalid preview settings");
  return { name: value.name.trim(), email: value.email.trim(), role: "applicant",
    notificationPreferences: { deadlineReminders: value.notificationPreferences.deadlineReminders, mentorFeedback: value.notificationPreferences.mentorFeedback } };
}

export function settingsChanged(draft, saved) {
  return draft.name !== saved.name
    || draft.notificationPreferences.deadlineReminders !== saved.notificationPreferences.deadlineReminders
    || draft.notificationPreferences.mentorFeedback !== saved.notificationPreferences.mentorFeedback;
}

export function editableSettingsUpdate(draft, saved) {
  return { ...draft, email: saved.email, role: saved.role };
}

export function loadPreviewSettings(enabled, getStorage = () => window.localStorage) {
  if (!enabled) return { settings: defaultPreviewSettings(), error: "" };
  try {
    const json = getStorage().getItem(PREVIEW_SETTINGS_KEY);
    return { settings: json === null ? defaultPreviewSettings() : parsePreviewSettings(json), error: "" };
  } catch { return { settings: defaultPreviewSettings(), error: "Saved preview settings could not be loaded. Fictional defaults are shown." }; }
}

export function savePreviewSettings(values, enabled, getStorage = () => window.localStorage) {
  if (!enabled) return { error: "Settings are not connected to the backend." };
  try {
    const settings = parsePreviewSettings(JSON.stringify(values));
    getStorage().setItem(PREVIEW_SETTINGS_KEY, JSON.stringify(settings));
    return { settings, error: "" };
  } catch { return { error: "Settings could not be saved in this browser. Your draft is still unsaved; please try again." }; }
}
