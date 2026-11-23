import { ApiError } from "./api.js";
// Contract: server/API_CONTRACT.md, Account deletion (FR-15).
export const deletionUnavailable = "Account deletion is not available yet.";

export const deletionScopes = {
  applicant: "Your account, all your applications (including notes and stage history), all feedback on those applications, and every mentor link you created will be removed.",
  mentor: "Your account, every mentor link to you, and all feedback you wrote will be removed. Applicants keep their applications.",
  admin: "This administrator account will be removed.",
};
export const approvedAdminDeletionPolicy = { agreed: true, disabledOnly: true, permits: (target) => ["applicant", "mentor", "admin"].includes(target.role) };

export function createAccountDeletionApi(api, actor) {
  return {
    self(password) { return api.request("/auth/me", { method: "DELETE", body: { password }, expectedStatus: 200 }); },
    admin(target, password) {
      const eligibility = adminDeletionEligibility(actor, target, approvedAdminDeletionPolicy);
      if (!eligibility.allowed) throw new ApiError(eligibility.reason, 403);
      return api.request(`/admin/users/${encodeURIComponent(target._id)}`, { method: "DELETE", body: { password }, expectedStatus: 200 });
    },
  };
}
export function deletionConfirmed(result, id) { return result?.deleted === true && result.id === id; }

export function deletionReady({ available, onDelete, scope }) {
  return available === true && typeof onDelete === "function" && typeof scope === "string" && Boolean(scope.trim());
}

export function adminDeletionEligibility(actor, target, policy) {
  if (actor?.role !== "admin") return { allowed: false, reason: "Administrator access is required." };
  if (!actor.id || !target?._id) return { allowed: false, reason: "Account identity is unavailable." };
  if (actor.id === target._id) return { allowed: false, reason: "You cannot delete your own admin account." };
  if (policy?.agreed !== true || typeof policy.permits !== "function") return { allowed: false, reason: "Admin deletion eligibility has not been agreed." };
  if (policy.disabledOnly && target.disabled !== true) return { allowed: false, reason: "The approved policy requires a disabled account." };
  return policy.permits(target) === true ? { allowed: true, reason: "" } : { allowed: false, reason: "This account is not eligible under the approved policy." };
}

export function createDeletionAttempt({ execute, isConfirmed, onConfirmed }) {
  let pending = false, uncertain = false, completed = false;
  return async (password) => {
    if (pending) throw new Error("Deletion is already in progress.");
    if (completed) throw new Error("Deletion was already confirmed. No further request was sent.");
    if (uncertain) throw Object.assign(new Error("The result is uncertain. Check the account state before making another request."), { uncertain: true });
    if (typeof password !== "string" || !password.trim()) throw new Error("Enter your current password.");
    if (typeof execute !== "function" || typeof isConfirmed !== "function" || typeof onConfirmed !== "function") throw new Error(deletionUnavailable);
    pending = true;
    try {
      let result;
      try { result = await execute(password); }
      catch (failure) {
        // Never reflect arbitrary server errors that could echo a password.
        if (failure.code === "invalid-password" || failure.kind === "invalid-password") throw new ApiError("Incorrect password.", 400, "invalid-password");
        if (failure.code === "password-required") throw new ApiError("Enter your current password.", 400, "password-required");
        if (failure.status === 400) throw new ApiError("Deletion was rejected. Check your current password and account eligibility.", 400);
        if (failure.status === 403) {
          const messages = { "last-admin": "The last administrator account cannot be deleted.", "not-disabled": "Disable this account before deleting it.", "self-delete": "You cannot delete your own account here." };
          throw new ApiError(messages[failure.code] || "You are not permitted to delete this account.", 403, failure.code);
        }
        if (failure.status === 401) throw new Error("Your session could not be verified. Sign in again before continuing.");
        if (failure.status === 404) throw new ApiError("This account was not found. Refresh accounts to check its current state.", 404);
        uncertain = true;
        throw Object.assign(new Error("Deletion could not be confirmed. Check the account state before making another request; no automatic retry will occur."), { uncertain: true });
      }
      let confirmed = false;
      try { confirmed = isConfirmed(result) === true; } catch { /* Malformed response is unconfirmed. */ }
      if (!confirmed) {
        uncertain = true;
        throw Object.assign(new Error("The response did not confirm deletion. Check the account state before making another request."), { uncertain: true });
      }
      completed = true;
      await onConfirmed();
    } finally { pending = false; password = ""; }
  };
}
