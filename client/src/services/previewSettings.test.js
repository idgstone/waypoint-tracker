import test from "node:test";
import assert from "node:assert/strict";
import { defaultPreviewSettings, editableSettingsUpdate, validateSettings, settingsChanged, parsePreviewSettings, savePreviewSettings, loadPreviewSettings, PREVIEW_SETTINGS_KEY } from "./previewSettings.js";

test("required profile fields, role restriction and boolean preferences are validated", () => {
  const base = defaultPreviewSettings();
  assert.ok(validateSettings({ ...base, name: " " }).name);
  assert.ok(validateSettings({ ...base, email: "bad" }).email);
  assert.throws(() => parsePreviewSettings(JSON.stringify({ ...base, role: "admin" })));
  assert.throws(() => parsePreviewSettings(JSON.stringify({ ...base, notificationPreferences: { deadlineReminders: "true", mentorFeedback: false } })));
  assert.equal(parsePreviewSettings(JSON.stringify({ ...base, token: "drop", password: "drop" })).token, undefined);
});
test("dirty tracking covers profile and both switches, and reversing changes clears it", () => {
  const saved = defaultPreviewSettings();
  assert.equal(settingsChanged(saved, saved), false);
  assert.equal(settingsChanged({ ...saved, name: "changed" }, saved), true);
  assert.equal(settingsChanged({ ...saved, email: "other@example.com", role: "admin" }, saved), false);
  for (const name of ["deadlineReminders", "mentorFeedback"]) assert.equal(settingsChanged({ ...saved, notificationPreferences: { ...saved.notificationPreferences, [name]: true } }, saved), true);
});

test("settings updates preserve read-only email and role", () => {
  const saved = defaultPreviewSettings();
  const updated = editableSettingsUpdate({ ...saved, name: "New Name", email: "changed@example.com", role: "admin" }, saved);
  assert.equal(updated.name, "New Name");
  assert.equal(updated.email, saved.email);
  assert.equal(updated.role, "applicant");
});
test("saved settings survive serialization independently; failed writes return no saved profile", () => {
  const data = new Map();
  const storage = () => ({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
  const draft = { ...defaultPreviewSettings(), name: "Alex Preview", email: "alex@example.com", notificationPreferences: { deadlineReminders: true, mentorFeedback: true } };
  assert.deepEqual(savePreviewSettings(draft, true, storage).settings, draft);
  assert.deepEqual(loadPreviewSettings(true, storage).settings, draft);
  assert.deepEqual([...data.keys()], [PREVIEW_SETTINGS_KEY]);
  const failed = savePreviewSettings(draft, true, () => { throw new Error("blocked"); });
  assert.ok(failed.error); assert.equal(failed.settings, undefined);
});
test("malformed/blocked storage falls back safely, production does not access storage", () => {
  assert.ok(loadPreviewSettings(true, () => ({ getItem: () => "null" })).error);
  const blocked = () => { throw new Error("blocked"); };
  assert.ok(loadPreviewSettings(true, blocked).error);
  assert.equal(loadPreviewSettings(false, blocked).error, "");
  assert.ok(savePreviewSettings(defaultPreviewSettings(), false, blocked).error);
});
