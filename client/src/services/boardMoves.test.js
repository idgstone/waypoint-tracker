import test from "node:test";
import assert from "node:assert/strict";
import { boardDrop, createStageMover } from "./boardMoves.js";
import { createApplicationsApi } from "./applicationsApi.js";

const application = { id: "db-id", company: "Example", role: "Intern", stage: "applied", history: [{ stage: "applied" }] };

test("drop targets resolve stages, outcomes, existing columns and invalid drops without writing", () => {
  assert.deepEqual(boardDrop(application, "interview"), { kind: "move", stage: "interview" });
  assert.deepEqual(boardDrop(application, "onlineAssessment"), { kind: "move", stage: "onlineAssessment" });
  assert.equal(boardDrop(application, "applied").kind, "same");
  assert.equal(boardDrop(application, "outcomes").kind, "outcome");
  assert.equal(boardDrop({ ...application, stage: "offer" }, "outcomes").kind, "same");
  assert.equal(boardDrop({ ...application, stage: "rejected" }, "outcomes").kind, "same");
  assert.equal(boardDrop(null, "interview").kind, "invalid");
  assert.equal(boardDrop(application, "unknown").kind, "invalid");
});

test("same-stage moves never invoke update or create history", async () => {
  let calls = 0;
  const move = createStageMover(() => application, () => { calls++; });
  assert.equal((await move(application.id, "applied")).moved, false);
  assert.equal(calls, 0); assert.equal(application.history.length, 1);
});

test("outcome cancellation performs no write; explicit choice reuses stage update", async () => {
  const calls = [];
  const move = createStageMover(() => application, (id, changes) => { calls.push({ id, changes }); });
  const decision = boardDrop(application, "outcomes");
  assert.equal(decision.kind, "outcome"); assert.equal(calls.length, 0);
  // Cancel simply discards the outcome choice; only explicit Save invokes move.
  assert.equal(application.stage, "applied");
  await move(application.id, "rejected");
  assert.deepEqual(calls, [{ id: application.id, changes: { stage: "rejected" } }]);
});

test("duplicate/pending moves are blocked and no optimistic stage/count changes occur", async () => {
  let resolve; let calls = 0; const pending = [];
  let records = [application];
  const move = createStageMover((id) => records.find((item) => item.id === id), async (id, changes) => {
    calls++; const result = await new Promise((done) => { resolve = done; });
    records = records.map((item) => item.id === id ? result : item); return result;
  }, (id) => pending.push(id));
  const first = move(application.id, "interview");
  await assert.rejects(move(application.id, "offer"), /Please wait/);
  assert.equal(calls, 1); assert.equal(records.filter((item) => item.stage === "applied").length, 1);
  const confirmed = { ...application, stage: "interview", history: [...application.history, { stage: "interview", date: "server-time" }] };
  resolve(confirmed);
  assert.equal((await first).application, confirmed);
  assert.equal(records.filter((item) => item.stage === "applied").length, 0);
  assert.equal(records.filter((item) => item.stage === "interview").length, 1);
  assert.deepEqual(pending, [application.id, null]);
});

test("failure leaves the original record/history/counts intact and releases pending lock", async () => {
  let fail = true; const pending = [];
  const move = createStageMover(() => application, async () => { if (fail) throw new Error("API failed"); return { ...application, stage: "interview" }; }, (id) => pending.push(id));
  await assert.rejects(move(application.id, "interview"), /API failed/);
  assert.equal(application.stage, "applied"); assert.equal(application.history.length, 1);
  assert.equal(pending.at(-1), null);
  fail = false; assert.equal((await move(application.id, "interview")).moved, true);
});

test("preview callback remains isolated and records only one changed stage", async () => {
  let record = structuredClone(application);
  const move = createStageMover(() => record, (_id, changes) => {
    record = { ...record, ...changes, history: [...record.history, { stage: changes.stage }] };
  });
  await move(record.id, "onlineAssessment"); await move(record.id, "onlineAssessment");
  assert.equal(record.history.length, 2); assert.equal(record.stage, "onlineAssessment");
});

test("real operation maps stage labels and accepts only the server-confirmed ID and stage", async () => {
  const calls = [];
  const record = { _id: application.id, position: "Intern", company: "Example", stage: "Interview", stageHistory: [{ stage: "Applied", changedAt: "2026-10-17T12:00:00Z" }, { stage: "Interview", changedAt: "2026-10-17T13:00:00Z" }] };
  const service = createApplicationsApi({ request: async (...args) => { calls.push(args); return record; } });
  const move = createStageMover(() => application, (id, changes) => service.stage(id, changes.stage));
  const result = await move(application.id, "interview");
  assert.deepEqual(calls[0], ["/applications/db-id/stage", { method: "PATCH", body: { stage: "Interview" } }]);
  assert.equal(result.application.history.length, 2); assert.equal(result.application.id, application.id);
  await assert.rejects(service.stage(application.id, "offer"), /did not confirm/);
});
