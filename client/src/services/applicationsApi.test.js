import test from "node:test";
import assert from "node:assert/strict";
import { adaptApplication, createApplicationsApi } from "./applicationsApi.js";
import { createApi, ApiError } from "./api.js";

const record = { _id: "db-id", company: "Example", position: "Intern", stage: "Applied", dateApplied: "2026-10-17T00:00:00.000Z", deadline: null, reminderEnabled: false, notes: [], stageHistory: [{ stage: "Applied", changedAt: "2026-10-17T12:00:00.000Z" }] };
const values = { company: "Example", role: "Intern", appliedDate: "2026-10-17", deadline: "", reminder: false, stage: "applied", notes: "" };
function mock(results) {
  const calls = [];
  const service = createApplicationsApi({ request: async (path, options = {}) => {
    calls.push({ path, ...options });
    const next = results.shift();
    if (next instanceof Error) throw next;
    return structuredClone(next);
  } });
  return { service, calls };
}

test("adaptation retains database IDs, note records and exact history without invented stages", () => {
  const result = adaptApplication({ ...record, stage: "Rejected", notes: [{ _id: "note-id", text: "Hello" }] });
  assert.equal(result.id, "db-id"); assert.equal(result.role, "Intern");
  assert.equal(result.stage, "rejected"); assert.equal(result.reminder, false);
  assert.equal(result.history.length, 1); assert.equal(result.history[0].date, record.stageHistory[0].changedAt);
  assert.equal(result.noteRecords[0]._id, "note-id");
});

test("create maps supported fields and explicitly sends both reminder booleans", async () => {
  for (const reminder of [false, true]) {
    const { service, calls } = mock([{ ...record, reminderEnabled: reminder }]);
    const result = await service.create({ ...values, reminder });
    assert.deepEqual(calls[0].body, { company: "Example", position: "Intern", dateApplied: "2026-10-17", deadline: null, reminderEnabled: reminder });
    assert.equal(calls.length, 1); assert.equal(result.application.id, record._id);
  }
});

test("non-Applied create sequences stage and note endpoints and consumes server history", async () => {
  const moved = { ...record, stage: "Interview", stageHistory: [...record.stageHistory, { stage: "Interview", changedAt: "2026-10-18T12:00:00Z" }] };
  const note = { _id: "note-id", text: "Prepare", createdAt: "2026-10-18T12:00:00Z", updatedAt: "2026-10-18T12:00:00Z" };
  const { service, calls } = mock([record, moved, note]);
  const result = await service.create({ ...values, stage: "interview", notes: "Prepare" });
  assert.deepEqual(calls.map((call) => call.path), ["/applications", "/applications/db-id/stage", "/applications/db-id/notes"]);
  assert.deepEqual(calls[1].body, { stage: "Interview" });
  assert.equal(result.application.history.length, 2); assert.equal(result.application.noteRecords[0]._id, "note-id");
});

test("stage and note failures retain created record and draft without a second create", async () => {
  const { service, calls } = mock([record, new ApiError("stage failed", 500), new ApiError("note failed", 400)]);
  const result = await service.create({ ...values, stage: "offer", notes: "Keep draft" });
  assert.equal(result.application.stage, "applied"); assert.equal(result.unsavedNotes, "Keep draft");
  assert.match(result.message, /stage change was not confirmed/); assert.match(result.message, /initial note was not confirmed/);
  assert.equal(calls.filter((call) => call.path === "/applications").length, 1);
});

test("forbidden follow-up retains created Applied record; expired sessions stop follow-ups", async () => {
  const forbidden = mock([record, new ApiError("Forbidden", 403)]);
  const result = await forbidden.service.create({ ...values, stage: "interview" });
  assert.equal(result.application.id, "db-id");
  assert.equal(result.application.stage, "applied");
  assert.match(result.message, /Forbidden/);
  const expired = mock([record, new ApiError("Expired", 401)]);
  await assert.rejects(expired.service.create({ ...values, stage: "interview", notes: "Do not post" }), { status: 401 });
  assert.equal(expired.calls.length, 2);
});

test("unconfirmed create is flagged, never automatically retried; validation remains recoverable", async () => {
  for (const status of [0, 400, 500]) {
    const { service, calls } = mock([new ApiError("failed", status)]);
    await assert.rejects(service.create(values), (error) => Boolean(error.creationUncertain) === (status !== 400));
    assert.equal(calls.length, 1);
  }
});

test("list, details, feedback, stage, note edits and deletes use documented paths and methods", async () => {
  const note = { _id: "note-id", text: "Edited" };
  const { service, calls } = mock([[record], record, [], { ...record, stage: "Rejected" }, note, null, null]);
  assert.equal((await service.list())[0].id, "db-id");
  await service.detail("db-id"); await service.feedback("db-id"); await service.stage("db-id", "rejected");
  await service.note("db-id", " Edited ", "note-id"); await service.removeNote("db-id", "note-id"); await service.remove("db-id");
  assert.deepEqual(calls.slice(3).map(({ path, method, body }) => ({ path, method, body })), [
    { path: "/applications/db-id/stage", method: "PATCH", body: { stage: "Rejected" } },
    { path: "/applications/db-id/notes/note-id", method: "PATCH", body: { text: "Edited" } },
    { path: "/applications/db-id/notes/note-id", method: "DELETE", body: undefined },
    { path: "/applications/db-id", method: "DELETE", body: undefined },
  ]);
});

test("empty lists stay empty and failed fetch never substitutes fixture records", async () => {
  const { service } = mock([[], new ApiError("offline")]);
  assert.deepEqual(await service.list(), []);
  await assert.rejects(service.list(), /offline/);
});

test("shared API handles DELETE 204 without parsing JSON and rejects stale session responses", async () => {
  let resolve;
  let parsed = false;
  const api = createApi({ storage: () => ({ getItem: () => "mock-token", removeItem() {} }), fetcher: () => new Promise((done) => { resolve = done; }) });
  const pending = api.request("/applications/db-id", { method: "DELETE" });
  resolve({ status: 204, ok: true, json() { parsed = true; throw new Error("must not parse"); } });
  assert.equal(await pending, null); assert.equal(parsed, false);
  const stale = api.request("/applications");
  api.clear();
  resolve({ status: 200, ok: true, json: async () => [record] });
  await assert.rejects(stale, { status: 499 });
});
