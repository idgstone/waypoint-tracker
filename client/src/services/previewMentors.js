export const PREVIEW_MENTORS_KEY = "waypoint.preview.mentors.v1";
export const normalizeMentorEmail = (email) => email.trim().toLowerCase();

export function validateMentorEmail(email, links) {
  const normalized = normalizeMentorEmail(email);
  if (!normalized) return "Enter your mentor’s email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return "Enter a valid email address.";
  const existing = links.find((link) => normalizeMentorEmail(link.mentorEmail) === normalized && link.status !== "revoked");
  if (existing) return existing.status === "accepted" ? "This mentor is already linked." : "An invitation to this mentor is already pending.";
  return "";
}

// Preview-only records use documented link fields, without a real applicant ID.
export function parsePreviewMentors(json) {
  const links = JSON.parse(json);
  if (!Array.isArray(links)) throw new Error("Invalid preview links");
  const ids = new Set();
  const emails = new Set();
  return links.map((link) => {
    if (!link || typeof link._id !== "string" || !link._id || ids.has(link._id)
      || typeof link.mentorEmail !== "string" || validateMentorEmail(link.mentorEmail, [])
      || !["pending", "accepted", "revoked"].includes(link.status)
      || typeof link.createdAt !== "string" || !Number.isFinite(Date.parse(link.createdAt))
      || typeof link.updatedAt !== "string" || !Number.isFinite(Date.parse(link.updatedAt))) throw new Error("Invalid preview link");
    const mentorEmail = normalizeMentorEmail(link.mentorEmail);
    if (emails.has(mentorEmail)) throw new Error("Duplicate preview email");
    ids.add(link._id); emails.add(mentorEmail);
    return { _id: link._id, mentorEmail, status: link.status, mentor: null, createdAt: link.createdAt, updatedAt: link.updatedAt };
  });
}

export function loadPreviewMentors(enabled, getStorage = () => window.localStorage) {
  if (!enabled) return { links: [], error: "" };
  try {
    const json = getStorage().getItem(PREVIEW_MENTORS_KEY);
    return { links: json === null ? [] : parsePreviewMentors(json), error: "" };
  } catch { return { links: [], error: "Saved preview invitations could not be loaded. An empty preview is shown." }; }
}

export function savePreviewMentors(links, enabled, getStorage = () => window.localStorage) {
  if (!enabled) return "";
  try {
    getStorage().setItem(PREVIEW_MENTORS_KEY, JSON.stringify(parsePreviewMentors(JSON.stringify(links))));
    return "";
  } catch { return "Preview invitations could not be saved in this browser. Changes may be lost on refresh."; }
}

export function createPreviewInvitation(mentorEmail, links) {
  const error = validateMentorEmail(mentorEmail, links);
  if (error) return { error };
  const email = normalizeMentorEmail(mentorEmail);
  const now = new Date().toISOString();
  const old = links.find((link) => link.mentorEmail === email);
  const invitation = { _id: old?._id ?? `preview-${crypto.randomUUID()}`, mentorEmail: email, mentor: null,
    status: "pending", createdAt: old?.createdAt ?? now, updatedAt: now };
  return { invitation, preview: true, links: [invitation, ...links.filter((link) => link._id !== invitation._id)] };
}
