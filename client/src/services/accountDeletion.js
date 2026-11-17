// FR-15 has no production contract. Deliberately no endpoint/default executor.
export const deletionUnavailable = "Account deletion is not available yet.";

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
        if (failure.status === 400 || failure.kind === "invalid-password") throw new Error("Deletion was rejected. Check your current password and account eligibility.");
        if (failure.status === 403) throw new Error("You are not permitted to delete this account.");
        if (failure.status === 401) throw new Error("Your session could not be verified. Sign in again before continuing.");
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
