import { ApiError } from "./api.js";

export function mapAdminUser(user) {
  if (!user || typeof user._id !== "string" || typeof user.name !== "string" || typeof user.email !== "string" || !["applicant", "mentor", "admin"].includes(user.role) || typeof user.disabled !== "boolean") throw new Error("The server returned an invalid user account.");
  return { _id: user._id, name: user.name, email: user.email, role: user.role, disabled: user.disabled, lastActiveAt: user.lastActiveAt };
}

export function mapAdminMetrics(metrics) {
  const count = (value) => Number.isInteger(value) && value >= 0;
  const keys = ["totalUsers", "activeUsers", "disabledAccounts", "totalApplications", "invitationsSent"];
  if (!metrics || !keys.every((key) => count(metrics[key])) || !metrics.usersByRole || typeof metrics.usersByRole !== "object" || Array.isArray(metrics.usersByRole)
    || !Object.entries(metrics.usersByRole).every(([role, value]) => ["applicant", "mentor", "admin"].includes(role) && count(value))) throw new Error("The server returned invalid usage statistics.");
  return { ...Object.fromEntries(keys.map((key) => [key, metrics[key]])), usersByRole: { ...metrics.usersByRole } };
}

export function createAdminApi(api, admin) {
  function requireAdmin() { if (admin.role !== "admin") throw new ApiError("Administrator access is required.", 403); }
  return {
    async users(signal) {
      requireAdmin();
      const users = await api.request("/admin/users", { signal });
      if (!Array.isArray(users)) throw new Error("The server returned an invalid account list.");
      return users.map(mapAdminUser);
    },
    async metrics(signal) { requireAdmin(); return mapAdminMetrics(await api.request("/admin/metrics", { signal })); },
    async setDisabled(id, disabled) {
      requireAdmin();
      if (typeof disabled !== "boolean") throw new ApiError("Choose Disable or Re-enable.", 400);
      if (id === admin.id && disabled) throw new ApiError("You can't disable your own admin account.", 400);
      const response = await api.request(`/admin/users/${encodeURIComponent(id)}/${disabled ? "disable" : "enable"}`, { method: "PATCH" });
      const user = mapAdminUser(response?.user);
      if (user._id !== id || user.disabled !== disabled || typeof response.alreadyInState !== "boolean") throw new Error("The account change could not be confirmed. Refresh accounts before retrying.");
      return { user, alreadyInState: response.alreadyInState };
    },
  };
}

// Refresh failures retain the last confirmed data. Search remains a synchronous
// filter of this full list; there are no backend search requests or page cursors.
export function createAdminResource(load) {
  let generation = 0;
  let controller;
  let data = null;
  let blocked = false;
  function cancel() { generation++; controller?.abort(); }
  return {
    cancel,
    replace(update, publish) {
      cancel(); data = update(data); blocked = false;
      publish({ data, loading: false, error: "", status: 0 });
    },
    async run(publish) {
      cancel(); const current = generation;
      controller = new AbortController();
      publish({ data: blocked ? null : data, loading: true, error: "", status: blocked ? 403 : 0 });
      try {
        const result = await load(controller.signal);
        if (current !== generation) return null;
        data = result; blocked = false;
        const state = { data, loading: false, error: "", status: 0 };
        publish(state); return state;
      } catch (failure) {
        if (current !== generation) return null;
        if (failure.status === 403) blocked = true;
        const state = { data: blocked ? null : data, loading: false, error: failure.message, status: blocked ? 403 : failure.status || 0 };
        publish(state); return state;
      }
    },
  };
}

export function createAdminStatusAction(service) {
  let pending = false;
  return async (target, disabled, onConfirmed, refresh) => {
    if (pending) throw new ApiError("An account action is already in progress.", 409);
    pending = true;
    try {
      const result = await service.setDisabled(target._id, disabled);
      onConfirmed(result);
      await refresh();
      return result.alreadyInState ? `${result.user.name} was already ${disabled ? "disabled" : "enabled"}.` : `${result.user.name} ${disabled ? "disabled" : "re-enabled"}. The change takes effect on their next request.`;
    } finally { pending = false; }
  };
}
