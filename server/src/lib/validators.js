// FR-1: server-side validation for registration.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

/**
 * Minimum password strength: at least 8 characters, one letter, one
 * number. Intentionally simple — this is a class project, not a
 * production auth system, but it satisfies "validate password strength"
 * from the Production Plan (FR-1 row) with a rule that's easy to explain
 * in the Test Plan.
 */
export function isStrongPassword(password) {
  if (typeof password !== "string" || password.length < 8) return false;
  return /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export function validateRegistration({ name, email, password, role }) {
  const errors = [];
  if (!name || !name.trim()) errors.push("name is required.");
  if (!isValidEmail(email)) errors.push("email must be a valid email address.");
  if (!isStrongPassword(password)) {
    errors.push("password must be at least 8 characters and include a letter and a number.");
  }
  if (role && !["applicant", "mentor"].includes(role)) {
    errors.push('role must be "applicant" or "mentor" (admin accounts are not self-registered).');
  }
  return errors;
}
