import test from "node:test";
import assert from "node:assert/strict";
import { adminUsers, adminInvitations, adminApplicationFixtures, previewAdmin } from "../data/adminFixtures.js";
import { adminMetrics, filterAdminUsers, loadAdminPreview, saveAdminPreview, updateAdminAccount, ADMIN_PREVIEW_KEY } from "./adminPreview.js";

test("preview uses the reference names and Mairesse as the protected administrator", () => {
  assert.deepEqual(adminUsers.map((user) => user.name), ["Dung Nguyen", "Oguz M.", "Mairesse Nkundizanye", "Michael", "Prof. Gooran"]);
  assert.equal(previewAdmin.name[0], "M");
  assert.equal(adminUsers.find((user) => user._id === previewAdmin._id).role, "admin");
  assert.equal(adminUsers.find((user) => user.name === "Michael").disabled, true);
});

test("name/email search ignores case and whitespace and handles no matches", () => {
  assert.equal(filterAdminUsers(adminUsers, " DUNG ")[0]._id, "admin-user-dung");
  assert.equal(filterAdminUsers(adminUsers, "GOORAN@UNT.EDU").length, 1);
  assert.equal(filterAdminUsers(adminUsers, "missing").length, 0);
  assert.equal(filterAdminUsers(adminUsers, "").length, adminUsers.length);
});
test("status updates protect self, preserve inputs, support no-ops and recalculate metrics", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  assert.ok(updateAdminAccount(adminUsers, previewAdmin._id, true).error);
  assert.ok(updateAdminAccount(adminUsers, "missing", true).error);
  const before = adminMetrics(adminUsers, adminInvitations, adminApplicationFixtures, now);
  const result = updateAdminAccount(adminUsers, "admin-user-dung", true);
  const after = adminMetrics(result.users, adminInvitations, adminApplicationFixtures, now);
  assert.equal(after.activeUsers, before.activeUsers - 1);
  assert.equal(after.disabledAccounts, before.disabledAccounts + 1);
  assert.equal(adminUsers.find((u) => u._id === "admin-user-dung").disabled, false);
  assert.equal(updateAdminAccount(result.users, "admin-user-dung", true).alreadyInState, true);
  assert.equal(updateAdminAccount(result.users, "admin-user-dung", false).users.find((u) => u._id === "admin-user-dung").disabled, false);
});
test("metrics respect 30-day and Monday UTC boundaries and ignore future invites", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const users = [
    { role: "applicant", disabled: false, lastActiveAt: "2026-09-16T12:00:00Z" },
    { role: "mentor", disabled: false, lastActiveAt: "2026-09-16T11:59:59Z" },
    { role: "admin", disabled: true, lastActiveAt: "2026-10-16T11:00:00Z" },
  ];
  const invitations = ["2026-10-11T23:59:59Z", "2026-10-12T00:00:00Z", "2026-10-16T12:00:00Z", "2026-10-16T12:00:01Z"].map((createdAt) => ({ createdAt }));
  const result = adminMetrics(users, invitations, [], now);
  assert.equal(result.activeUsers, 1);
  assert.equal(result.invitationsThisWeek, 2);
  assert.equal(result.invitationsSent, 4);
  assert.deepEqual(result.usersByRole, { applicant: 1, mentor: 1, admin: 1 });
  assert.equal(adminMetrics([], [], [], now).totalUsers, 0);
});
test("status persistence is isolated, validates records, handles failure and stays off in production", () => {
  const stored = new Map();
  const storage = () => ({ getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) });
  const updated = updateAdminAccount(adminUsers, "admin-user-dung", true).users;
  assert.equal(saveAdminPreview(updated, true, storage), "");
  assert.deepEqual([...stored.keys()], [ADMIN_PREVIEW_KEY]);
  assert.deepEqual(loadAdminPreview(true, storage).users, updated);
  assert.equal(JSON.parse(stored.get(ADMIN_PREVIEW_KEY))[0].email, undefined);
  stored.set(ADMIN_PREVIEW_KEY, JSON.stringify([{ _id: previewAdmin._id, disabled: true }]));
  assert.ok(loadAdminPreview(true, storage).error);
  assert.equal(loadAdminPreview(true, storage).users.find((user) => user._id == previewAdmin._id).disabled, false);
  stored.set(ADMIN_PREVIEW_KEY, "broken"); assert.ok(loadAdminPreview(true, storage).error);
  const blocked = () => { throw new Error("blocked"); };
  assert.ok(saveAdminPreview(updated, true, blocked));
  assert.equal(loadAdminPreview(false, blocked).error, "");
  assert.ok(saveAdminPreview(updated, false, blocked));
});
