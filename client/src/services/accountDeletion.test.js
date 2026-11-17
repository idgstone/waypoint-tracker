import test from "node:test";
import assert from "node:assert/strict";
import { createDeletionAttempt, adminDeletionEligibility, deletionReady } from "./accountDeletion.js";
import { createApi } from "./api.js";

test("no production executor exists; missing requirements and blank password cannot delete", async () => {
  let requests = 0;
  const attempt = createDeletionAttempt({ execute: async () => { requests++; } });
  await assert.rejects(attempt("  "), /current password/);
  await assert.rejects(attempt("mock-password"), /not available yet/);
  assert.equal(requests, 0);
});

test("final submission requires explicit availability, an adapter and approved removal wording", () => {
  const onDelete = () => {};
  for (const options of [{}, { onDelete, scope: "Approved scope" }, { available: true }, { available: true, onDelete }, { available: true, onDelete, scope: " " }]) assert.equal(deletionReady(options), false);
  assert.equal(deletionReady({ available: true, onDelete, scope: "Approved scope" }), true);
});

test("duplicate submissions are blocked; exact password reaches only the injected callback", async () => {
  let resolve; let requests = 0; let cleanups = 0;
  const receipt = Symbol("mock receipt, not a backend contract");
  const attempt = createDeletionAttempt({ execute: (password) => {
    assert.equal(password, " mock password "); requests++;
    return new Promise((done) => { resolve = done; });
  }, isConfirmed: (result) => result === receipt, onConfirmed: () => cleanups++ });
  const pending = attempt(" mock password ");
  await assert.rejects(attempt("mock-password"), /in progress/);
  assert.equal(requests, 1); assert.equal(cleanups, 0);
  resolve(receipt); await pending;
  assert.equal(cleanups, 1);
  await assert.rejects(attempt("mock-password"), /already confirmed/);
  assert.equal(requests, 1);
});

test("invalid password, forbidden, and session errors do not clean up or announce success", async () => {
  for (const status of [400, 401, 403]) {
    let cleaned = false; let requests = 0;
    const attempt = createDeletionAttempt({ execute: async () => { requests++; throw Object.assign(new Error("must not reflect mock-secret"), { status }); }, isConfirmed: () => true, onConfirmed: () => { cleaned = true; } });
    await assert.rejects(attempt("mock-secret"), (failure) => !failure.message.includes("mock-secret") && /rejected|permitted|session/.test(failure.message));
    assert.equal(cleaned, false); assert.equal(requests, 1);
  }
});

test("network failures and ambiguous responses never retry or clear session", async () => {
  for (const execute of [async () => { throw new Error("offline"); }, async () => ({}), async () => undefined]) {
    let requests = 0; let cleaned = false;
    const attempt = createDeletionAttempt({ execute: async () => { requests++; return execute(); }, isConfirmed: () => false, onConfirmed: () => { cleaned = true; } });
    await assert.rejects(attempt("mock-password"), (failure) => failure.uncertain === true);
    await assert.rejects(attempt("mock-password"), /uncertain/);
    assert.equal(requests, 1); assert.equal(cleaned, false);
  }
});

test("confirmed mock success clears existing API session and account data before Welcome", async () => {
  const storage = new Map([["waypoint.auth.token.v1", "mock-session"]]);
  const api = createApi({ storage: () => ({ getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }) });
  let user = { id: "mock-user" }; let applications = ["mock-application"]; let screen = "settings";
  let resolve;
  const receipt = Symbol("test only");
  const attempt = createDeletionAttempt({ execute: () => new Promise((done) => { resolve = done; }), isConfirmed: (value) => value === receipt, onConfirmed: () => {
    api.clear(); user = null; applications = []; screen = "welcome";
  } });
  const pending = attempt("mock-password");
  assert.equal(api.hasToken(), true); assert.equal(screen, "settings");
  resolve(receipt); await pending;
  assert.equal(api.hasToken(), false); assert.equal(storage.size, 0);
  assert.equal(user, null); assert.deepEqual(applications, []); assert.equal(screen, "welcome");
});

test("admin eligibility defaults to unavailable; self-deletion is always denied", () => {
  const actor = { id: "admin", role: "admin" }, target = { _id: "other", role: "applicant", disabled: true };
  // This is a hypothetical policy fixture, not an agreed project rule.
  const policy = { agreed: true, disabledOnly: true, permits: (account) => account.role !== "admin" };
  assert.equal(adminDeletionEligibility(actor, target).allowed, false);
  assert.equal(adminDeletionEligibility(actor, target, { ...policy, agreed: false }).allowed, false);
  assert.equal(adminDeletionEligibility(actor, { ...target, _id: actor.id }, { agreed: true, permits: () => true }).allowed, false);
  assert.equal(adminDeletionEligibility(actor, { ...target, disabled: false }, policy).allowed, false);
  assert.equal(adminDeletionEligibility(actor, { ...target, role: "admin" }, policy).allowed, false);
  assert.equal(adminDeletionEligibility(actor, target, policy).allowed, true);
  assert.equal(adminDeletionEligibility({ ...actor, role: "mentor" }, target, policy).allowed, false);
});

test("admin row and statistics change only after confirmed mock result", async () => {
  let rows = [{ _id: "target" }, { _id: "other" }]; let refreshes = 0; let resolve;
  const receipt = Symbol("mock admin result");
  const attempt = createDeletionAttempt({ execute: () => new Promise((done) => { resolve = done; }), isConfirmed: (result) => result === receipt, onConfirmed: () => { rows = rows.filter((row) => row._id !== "target"); refreshes++; } });
  const pending = attempt("mock acting-admin password");
  assert.equal(rows.length, 2); assert.equal(refreshes, 0);
  resolve(receipt); await pending;
  assert.deepEqual(rows, [{ _id: "other" }]); assert.equal(refreshes, 1);
});
