import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "./api.js";
import { createAccountDeletionApi, createDeletionAttempt, deletionConfirmed, deletionScopes, adminDeletionEligibility, approvedAdminDeletionPolicy } from "./accountDeletion.js";

const actor = { id: "acting-admin", role: "admin" };
const target = { _id: "target", name: "Fictional User", role: "mentor", disabled: true };
function setup(respond) {
  const calls = []; let ended = 0;
  const storage = new Map([["waypoint.auth.token.v1", "mock-token"]]);
  const api = createApi({ storage: () => ({ getItem: (key) => storage.get(key), removeItem: (key) => storage.delete(key), setItem: (key, value) => storage.set(key, value) }), fetcher: async (url, options) => { calls.push({ url, options }); return respond(url, options); } });
  api.onSessionEnded(() => ended++);
  return { api, calls, storage, ended: () => ended };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("self DELETE uses own password in JSON and validates the exact deleted account before cleanup", async () => {
  const mock = setup(() => json({ deleted: true, id: "applicant" }));
  const service = createAccountDeletionApi(mock.api, { id: "applicant", role: "applicant" });
  let screen = "settings", accountState = ["application"];
  const attempt = createDeletionAttempt({ execute: service.self, isConfirmed: (result) => deletionConfirmed(result, "applicant"), onConfirmed: () => { mock.api.clear(); screen = "welcome"; accountState = []; } });
  await attempt(" mock-password ");
  assert.equal(mock.calls.length, 1);
  const { url, options } = mock.calls[0];
  assert.equal(url, "/api/auth/me"); assert.equal(options.method, "DELETE");
  assert.deepEqual(JSON.parse(options.body), { password: " mock-password " });
  assert.equal(options.headers.Authorization, "Bearer mock-token");
  assert.equal(screen, "welcome"); assert.deepEqual(accountState, []); assert.equal(mock.api.hasToken(), false);
  assert.equal(mock.storage.size, 0); assert.ok(!mock.calls.some((call) => call.url.includes("logout")));
});

test("Admin DELETE targets the disabled account, uses acting admin password, keeps session and refreshes stats", async () => {
  const mock = setup(() => json({ deleted: true, id: target._id }));
  const service = createAccountDeletionApi(mock.api, actor);
  let rows = [target, { _id: "remaining" }], refreshes = 0;
  const attempt = createDeletionAttempt({ execute: (password) => service.admin(target, password), isConfirmed: (result) => deletionConfirmed(result, target._id), onConfirmed: () => { rows = rows.filter((row) => row._id !== target._id); refreshes++; } });
  await attempt("mock-acting-admin-password");
  assert.equal(mock.calls[0].url, "/api/admin/users/target");
  assert.deepEqual(JSON.parse(mock.calls[0].options.body), { password: "mock-acting-admin-password" });
  assert.equal(mock.calls[0].options.method, "DELETE"); assert.deepEqual(rows, [{ _id: "remaining" }]); assert.equal(refreshes, 1);
  assert.equal(mock.api.hasToken(), true); assert.equal(mock.ended(), 0);
});

test("invalid-password and policy refusals preserve error codes, session, rows and statistics", async () => {
  for (const [status, code] of [[400, "invalid-password"], [403, "last-admin"], [403, "not-disabled"], [403, "self-delete"]]) {
    const mock = setup(() => json({ error: "Refused", code }, status));
    const service = createAccountDeletionApi(mock.api, actor); let confirmed = 0;
    const attempt = createDeletionAttempt({ execute: (password) => service.admin(target, password), isConfirmed: () => true, onConfirmed: () => confirmed++ });
    await assert.rejects(attempt("mock-password"), (error) => error.code === code && error.status === status);
    assert.equal(mock.api.hasToken(), true); assert.equal(mock.ended(), 0); assert.equal(confirmed, 0);
    // The user may manually retry an explicit refusal; no automatic retry occurs.
    assert.equal(mock.calls.length, 1);
  }
});

test("expected disabled-only refusal does not trigger the shared disabled-account logout heuristic", async () => {
  const mock = setup(() => json({ error: "This account has been disabled.", code: "not-disabled" }, 403));
  await assert.rejects(createAccountDeletionApi(mock.api, actor).admin(target, "mock-password"), { code: "not-disabled" });
  assert.equal(mock.ended(), 0); assert.equal(mock.api.hasToken(), true);
});

test("real 401 expiry and disabled-account 403 end the session, but role 403 does not", async () => {
  for (const [status, error, expected] of [[401, "Session expired", true], [403, "This account has been disabled.", true], [403, "Forbidden role", false]]) {
    const mock = setup(() => json({ error }, status));
    await assert.rejects(createAccountDeletionApi(mock.api, actor).admin(target, "mock-password"));
    assert.equal(mock.ended(), Number(expected)); assert.equal(mock.api.hasToken(), !expected);
  }
});

test("unexpected status, missing/incorrect identity, false success, unreadable JSON and network loss never clear data or retry", async () => {
  for (const response of [() => json({ deleted: true, id: "wrong" }), () => json({ deleted: false, id: "applicant" }), () => json({ deleted: true }), () => json({ deleted: true, id: "applicant" }, 201), () => new Response(null, { status: 204 }), () => new Response("not JSON"), () => { throw new Error("network lost"); }]) {
    const mock = setup(response); let confirmed = 0;
    const attempt = createDeletionAttempt({ execute: createAccountDeletionApi(mock.api, actor).self, isConfirmed: (result) => deletionConfirmed(result, "applicant"), onConfirmed: () => confirmed++ });
    await assert.rejects(attempt("mock-password"), (error) => error.uncertain === true);
    await assert.rejects(attempt("mock-password"), /uncertain/);
    assert.equal(mock.calls.length, 1); assert.equal(confirmed, 0); assert.equal(mock.api.hasToken(), true);
  }
});

test("Admin self-delete, active target, missing role and wrong role never send a request", async () => {
  const mock = setup(() => { throw Error("Must not request"); });
  for (const [admin, account] of [[actor, { ...target, _id: actor.id }], [actor, { ...target, disabled: false }], [{ ...actor, role: "mentor" }, target], [actor, { ...target, role: "unknown" }]]) {
    assert.equal(adminDeletionEligibility(admin, account, approvedAdminDeletionPolicy).allowed, false);
    await assert.rejects(async () => createAccountDeletionApi(mock.api, admin).admin(account, "mock-password"));
  }
  assert.equal(mock.calls.length, 0);
});

test("404 does not report deletion success; stale responses after session changes are discarded", async () => {
  const missing = setup(() => json({ error: "User not found." }, 404)); let confirmed = 0;
  const attempt = createDeletionAttempt({ execute: (password) => createAccountDeletionApi(missing.api, actor).admin(target, password), isConfirmed: () => true, onConfirmed: () => confirmed++ });
  await assert.rejects(attempt("mock-password"), { status: 404 }); assert.equal(confirmed, 0);
  let resolve;
  const stale = setup(() => new Promise((done) => { resolve = done; }));
  const pending = createAccountDeletionApi(stale.api, actor).self("mock-password");
  stale.api.clear(); resolve(json({ deleted: true, id: actor.id }));
  await assert.rejects(pending, { status: 499 });
});

test("confirmation wording matches approved feedback retention rules", () => {
  assert.match(deletionScopes.applicant, /all feedback on those applications/);
  assert.match(deletionScopes.mentor, /all feedback you wrote/);
  assert.match(deletionScopes.mentor, /Applicants keep their applications/);
  assert.equal(deletionScopes.admin, "This administrator account will be removed.");
});
