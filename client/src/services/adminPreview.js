import { adminUsers, previewAdmin } from "../data/adminFixtures.js";
export const ADMIN_PREVIEW_KEY = "waypoint.preview.admin.v2";

export { filterAdminUsers } from "./adminPresentation.js";
export function adminMetrics(users, invitations, applications, now = new Date()) {
  const activeSince = now.getTime() - 30 * 86400000;
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() + 6) % 7);
  const usersByRole = {};
  for (const user of users) usersByRole[user.role] = (usersByRole[user.role] ?? 0) + 1;
  return { totalUsers: users.length, activeUsers: users.filter((user) => !user.disabled && Date.parse(user.lastActiveAt) >= activeSince).length,
    disabledAccounts: users.filter((user) => user.disabled).length, totalApplications: applications.length,
    invitationsSent: invitations.length, invitationsThisWeek: invitations.filter((invitation) => Date.parse(invitation.createdAt) >= weekStart.getTime() && Date.parse(invitation.createdAt) <= now.getTime()).length, usersByRole };
}
export function updateAdminAccount(users, id, disabled, adminId = previewAdmin._id) {
  if (disabled && id === adminId) return { error: "You cannot disable your own admin account." };
  const user = users.find((item) => item._id === id);
  if (!user) return { error: "Account is no longer available." };
  return { users: users.map((item) => item._id === id ? { ...item, disabled } : item), alreadyInState: user.disabled === disabled };
}
function parseStatuses(json) {
  const statuses = JSON.parse(json);
  const ids = new Set();
  if (!Array.isArray(statuses)) throw new Error("Invalid statuses");
  for (const status of statuses) {
    if (!status || !adminUsers.some((user) => user._id === status._id) || ids.has(status._id) || typeof status.disabled !== "boolean"
      || (status._id === previewAdmin._id && status.disabled)) throw new Error("Invalid status");
    ids.add(status._id);
  }
  return adminUsers.map((user) => ({ ...user, disabled: statuses.find((status) => status._id === user._id)?.disabled ?? user.disabled }));
}
export function loadAdminPreview(enabled, getStorage = () => window.localStorage) {
  const defaults = () => adminUsers.map((user) => ({ ...user }));
  if (!enabled) return { users: defaults(), error: "" };
  try {
    const json = getStorage().getItem(ADMIN_PREVIEW_KEY);
    return { users: json === null ? defaults() : parseStatuses(json), error: "" };
  } catch { return { users: defaults(), error: "Saved admin preview changes could not be loaded. Fictional defaults are shown." }; }
}
export function saveAdminPreview(users, enabled, getStorage = () => window.localStorage) {
  if (!enabled) return "Admin preview is available in development only.";
  try {
    const json = JSON.stringify(users.map(({ _id, disabled }) => ({ _id, disabled })));
    parseStatuses(json); getStorage().setItem(ADMIN_PREVIEW_KEY, json); return "";
  } catch { return "Account status could not be saved in this browser. No preview change was applied."; }
}
