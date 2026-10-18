import test from "node:test";
import assert from "node:assert/strict";
import { refreshedDraftValue, rebaseSettingsDraft } from "./draftSync.js";
import { settingsChanged } from "./previewSettings.js";

test("a refreshed stage/note updates pristine inputs but preserves unsaved choices/text", () => {
  assert.equal(refreshedDraftValue("applied", "applied", "interview"), "interview");
  assert.equal(refreshedDraftValue("offer", "applied", "interview"), "offer");
  assert.equal(refreshedDraftValue("Old note", "Old note", "Server note"), "Server note");
  assert.equal(refreshedDraftValue("Unsaved note", "Old note", "Server note"), "Unsaved note");
});

test("Settings refresh merges fresh immutable fields and pristine preferences without losing edits", () => {
  const saved = { id: "id", name: "Old Name", email: "old@example.com", role: "applicant", notificationPreferences: { deadlineReminders: false, mentorFeedback: false } };
  const fresh = { ...saved, name: "Server Name", email: "fresh@example.com", notificationPreferences: { deadlineReminders: false, mentorFeedback: true } };
  const draft = { ...saved, name: "Unsaved Name", notificationPreferences: { deadlineReminders: true, mentorFeedback: false } };
  const result = rebaseSettingsDraft(draft, saved, fresh);
  assert.equal(result.name, "Unsaved Name"); assert.equal(result.email, "fresh@example.com"); assert.equal(result.role, "applicant");
  assert.deepEqual(result.notificationPreferences, { deadlineReminders: true, mentorFeedback: true });
  assert.equal(settingsChanged(result, fresh), true);
  const pristine = rebaseSettingsDraft(saved, saved, fresh);
  assert.deepEqual(pristine, fresh); assert.equal(settingsChanged(pristine, fresh), false);
});
