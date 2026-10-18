import test from "node:test";
import assert from "node:assert/strict";
import { createAdminApi, createAdminResource, createAdminStatusAction, mapAdminMetrics } from "./adminApi.js";
import { filterAdminUsers } from "./adminPresentation.js";
import { ApiError, createApi } from "./api.js";

const admin = { id: "admin-id", role: "admin" };
const account = { _id: "user-id", name: "Example User", email: "example@example.com", role: "applicant", disabled: false };
const metrics = { totalUsers: 2, activeUsers: 2, disabledAccounts: 0, totalApplications: 4, invitationsSent: 3, usersByRole: { applicant: 1, admin: 1 } };
function mock(results, actingUser = admin) {
  const calls = [];
  const service = createAdminApi({ request: async (...args) => {
    calls.push(args); const next = results.shift();
    if (next instanceof Error) throw next;
    return structuredClone(next);
  } }, actingUser);
  return { service, calls };
}

test("loads complete unpaginated users and documented metrics through only GET paths", async () => {
  const { service, calls } = mock([[{ ...account, passwordHash: "omit", tokenVersion: 3 }], metrics]);
  const users = await service.users();
  assert.equal(users[0].passwordHash, undefined); assert.equal(users[0].tokenVersion, undefined);
  assert.deepEqual(await service.metrics(), metrics);
  assert.deepEqual(calls.map(([path]) => path), ["/admin/users", "/admin/metrics"]);
  assert.equal(calls[0][1].body, undefined);
  const bad = mock([{ users: [account], page: 1 }]);
  await assert.rejects(bad.service.users(), /invalid account list/);
});

test("search filters all fetched records case-insensitively without unsupported query requests", () => {
  const users = [account, { ...account, _id: "two", name: "Other User", email: "other@example.com" }];
  assert.deepEqual(filterAdminUsers(users, " EXAMPLE@EXAMPLE.COM "), [account]);
  assert.equal(filterAdminUsers(users, "other")[0]._id, "two");
  assert.deepEqual(filterAdminUsers(users, "no match"), []);
  assert.equal(filterAdminUsers(users, "").length, 2);
});

test("status PATCH uses exact paths, no role/body changes, and validates returned ID/status", async () => {
  const disabled = { ...account, disabled: true };
  const { service, calls } = mock([{ user: disabled, alreadyInState: false }, { user: account, alreadyInState: true }]);
  assert.equal((await service.setDisabled(account._id, true)).user.disabled, true);
  assert.equal((await service.setDisabled(account._id, false)).alreadyInState, true);
  assert.deepEqual(calls, [["/admin/users/user-id/disable", { method: "PATCH" }], ["/admin/users/user-id/enable", { method: "PATCH" }]]);
  const invalid = mock([{ user: account, alreadyInState: false }]);
  await assert.rejects(invalid.service.setDisabled(account._id, true), /could not be confirmed/);
});

test("self-disable and non-admin access are rejected before requests", async () => {
  const own = mock([]);
  await assert.rejects(own.service.setDisabled(admin.id, true), /own admin account/);
  assert.equal(own.calls.length, 0);
  const unauthorized = mock([], { ...admin, role: "applicant" });
  await assert.rejects(unauthorized.service.users(), { status: 403 });
  await assert.rejects(unauthorized.service.setDisabled(account._id, true), { status: 403 });
  assert.equal(unauthorized.calls.length, 0);
});

test("duplicate actions send once, update only after confirmation, then refresh statistics", async () => {
  let resolve; let writes = 0; let confirmed = 0; let refreshed = 0;
  const action = createAdminStatusAction({ setDisabled: () => { writes++; return new Promise((done) => { resolve = done; }); } });
  const first = action(account, true, () => { confirmed++; }, async () => { refreshed++; });
  await assert.rejects(action(account, true, () => {}, async () => {}), { status: 409 });
  assert.equal(writes, 1); assert.equal(confirmed, 0); assert.equal(refreshed, 0);
  resolve({ user: { ...account, disabled: true }, alreadyInState: false });
  assert.match(await first, /disabled/); assert.equal(confirmed, 1); assert.equal(refreshed, 1);
  assert.equal(account.disabled, false);
  const noop = createAdminStatusAction({ setDisabled: async () => ({ user: account, alreadyInState: true }) });
  assert.match(await noop(account, false, () => {}, async () => {}), /already enabled/);
});

test("failed account action preserves loaded data and does not announce success or refresh", async () => {
  for (const status of [0, 400, 403, 404, 500]) {
    const { service } = mock([new ApiError("Backend error", status)]);
    const action = createAdminStatusAction(service);
    let changed = false; let refreshed = false;
    await assert.rejects(action(account, true, () => { changed = true; }, async () => { refreshed = true; }), /Backend error/);
    assert.equal(changed, false); assert.equal(refreshed, false); assert.equal(account.disabled, false);
  }
});

test("metrics keep only documented counts, not weekly invitations or operational monitoring", () => {
  const mapped = mapAdminMetrics({ ...metrics, invitationsThisWeek: 47, uptime: 99 });
  assert.equal(mapped.invitationsSent, 3); assert.equal(mapped.invitationsThisWeek, undefined); assert.equal(mapped.uptime, undefined);
  assert.throws(() => mapAdminMetrics({ ...metrics, activeUsers: -1 }), /invalid usage/);
  assert.throws(() => mapAdminMetrics({ ...metrics, usersByRole: { unknown: 1 } }), /invalid usage/);
});

test("refresh failures preserve confirmed data; forbidden response hides protected data", async () => {
  let failure = null; let state;
  const loader = createAdminResource(async () => { if (failure) throw failure; return [account]; });
  await loader.run((value) => { state = value; });
  failure = new ApiError("Offline");
  await loader.run((value) => { state = value; });
  assert.deepEqual(state.data, [account]); assert.match(state.error, /Offline/);
  failure = new ApiError("Requires role: admin.", 403);
  await loader.run((value) => { state = value; });
  assert.equal(state.data, null); assert.equal(state.status, 403);
  failure = new ApiError("Retry offline");
  await loader.run((value) => { state = value; });
  assert.equal(state.data, null); assert.equal(state.status, 403);
  failure = null; await loader.run((value) => { state = value; });
  assert.equal(state.data.length, 1);
});

test("stale refresh cannot overwrite confirmed action; latest search filters delayed results", async () => {
  const pending = [];
  const loader = createAdminResource((signal) => new Promise((resolve) => pending.push({ signal, resolve })));
  let state; let search = "Example";
  const first = loader.run((value) => { state = value; });
  const next = loader.run((value) => { state = value; });
  assert.equal(pending[0].signal.aborted, true);
  search = "missing";
  pending[1].resolve([account]); await next;
  assert.deepEqual(filterAdminUsers(state.data, search), []);
  loader.replace((users) => users.map((user) => ({ ...user, disabled: true })), (value) => { state = value; });
  pending[0].resolve([account]); await first;
  assert.equal(state.data[0].disabled, true);
  const abandoned = loader.run((value) => { state = value; }); loader.cancel();
  pending[2].resolve([]); await abandoned;
  assert.equal(state.data[0].disabled, true);
});

test("shared API handles 401, disabled 403, ordinary forbidden errors, and stale session responses", async () => {
  for (const [status, error, ends] of [[401, "Session expired", true], [403, "This account has been disabled.", true], [403, "Requires role: admin.", false]]) {
    let ended = false;
    const api = createApi({ storage: () => ({ getItem: () => "mock", removeItem() {} }), fetcher: async () => new Response(JSON.stringify({ error }), { status }) });
    api.onSessionEnded(() => { ended = true; });
    await assert.rejects(createAdminApi(api, admin).users(), { status });
    assert.equal(ended, ends);
  }
  let resolve;
  const api = createApi({ storage: () => ({ getItem: () => "mock", removeItem() {} }), fetcher: () => new Promise((done) => { resolve = done; }) });
  const pending = createAdminApi(api, admin).users();
  api.clear(); resolve(new Response(JSON.stringify([account])));
  await assert.rejects(pending, { status: 499 });
});
