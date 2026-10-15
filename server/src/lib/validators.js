// FR-1: server-side validation for registration.
// Messages are specific and actionable per NFR 5.4.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

/**
 * Minimum password strength: at least 8 characters, one letter, one
 * number. Simple on purpose so the rule is easy to state in the Test Plan.
 */
export function isStrongPassword(password) {
  if (typeof password !== "string" || password.length < 8) return false;
  return /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export function validateRegistration({ name, email, password, role }) {
  const errors = [];
  if (typeof name !== "string" || !name.trim()) errors.push("Name is required.");
  if (!isValidEmail(email)) errors.push("Enter a valid email address.");
  if (!isStrongPassword(password)) {
    errors.push("Password must be at least 8 characters and include a letter and a number.");
  }
  if (role && !["applicant", "mentor"].includes(role)) {
    errors.push('Role must be "applicant" or "mentor".');
  }
  return errors;
}
