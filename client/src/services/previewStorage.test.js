import test from "node:test";
import assert from "node:assert/strict";
import { PREVIEW_STORAGE_KEY, createSampleApplications, loadPreviewApplications, parsePreviewApplications, savePreviewApplications } from "./previewStorage.js";

function memoryStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (key, next) => { assert.equal(key, PREVIEW_STORAGE_KEY); value = next; } };
}

test("preview edits and deletions survive serialization, including an intentionally empty list", () => {
  const storage = memoryStorage();
  const applications = createSampleApplications();
  applications[0].stage = "interview";
  applications[0].notes = "Saved notes";
  applications[0].history.push({ id: "change-1", stage: "interview", date: "2026-10-15" });
  applications.splice(1, 1);
  assert.equal(savePreviewApplications(applications, true, () => storage), "");
  assert.deepEqual(loadPreviewApplications(true, () => storage).applications, parsePreviewApplications(JSON.stringify(applications)));
  savePreviewApplications([], true, () => storage);
  assert.deepEqual(loadPreviewApplications(true, () => storage).applications, []);
});

test("missing or malformed saved data falls back to samples", () => {
  for (const value of [null, "{", "null", "{}", '[{"id":"incomplete"}]']) {
    assert.equal(loadPreviewApplications(true, () => memoryStorage(value)).applications.length, 7);
  }
  const data = createSampleApplications();
  data[0].stage = "invalid";
  assert.throws(() => parsePreviewApplications(JSON.stringify(data)));
  data[0].stage = "applied";
  data[1].id = data[0].id;
  assert.throws(() => parsePreviewApplications(JSON.stringify(data)));
});

test("blocked storage and failed writes return notices without throwing", () => {
  const blocked = () => { throw new Error("Blocked"); };
  assert.equal(loadPreviewApplications(true, blocked).applications.length, 7);
  assert.ok(loadPreviewApplications(true, blocked).error);
  assert.ok(savePreviewApplications([], true, blocked));
});

test("production never accesses storage and extra account fields are omitted", () => {
  const forbidden = () => { throw new Error("Must not access storage"); };
  assert.equal(loadPreviewApplications(false, forbidden).error, "");
  assert.equal(savePreviewApplications([], false, forbidden), "");
  const data = createSampleApplications();
  data[0].password = "must be discarded";
  data[0].token = "must be discarded";
  const parsed = parsePreviewApplications(JSON.stringify(data));
  assert.equal(Object.hasOwn(parsed[0], "password"), false);
  assert.equal(Object.hasOwn(parsed[0], "token"), false);
});
