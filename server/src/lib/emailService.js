/**
 * Transactional email via SendGrid's REST API (no SDK, one fetch call).
 * Used for FR-6 deadline reminders and FR-8 mentor invitations. Swap the
 * fetch target for AWS SES if the team picks that instead; callers don't
 * change.
 *
 * NFR 5.2: only the email address the user gave us is used; we never
 * request access to anyone's inbox. Reminders go only to opted-in users.
 */
const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

function fromAddress() {
  return process.env.EMAIL_FROM_ADDRESS || "no-reply@waypoint.app";
}

function clientUrl() {
  return (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
}

export async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.EMAIL_SERVICE_API_KEY;
  if (!apiKey || apiKey.startsWith("replace-with")) {
    console.warn(`[emailService] EMAIL_SERVICE_API_KEY not set — skipping email: "${subject}"`);
    return { sent: false, reason: "no-api-key" };
  }

  const res = await fetch(SENDGRID_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromAddress() },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SendGrid request failed (${res.status}): ${body}`);
  }

  return { sent: true };
}

/** FR-6: one application's deadline reminder, respecting both opt-ins. */
export async function sendDeadlineReminder(user, application) {
  const optedIn = user.notificationPreferences?.deadlineReminders && application.reminderEnabled;
  if (!optedIn) {
    return { sent: false, reason: "not-opted-in" };
  }

  return sendEmail({
    to: user.email,
    subject: `Reminder: ${application.company} deadline coming up`,
    text:
      `Hi ${user.name},\n\n` +
      `Your application for ${application.position} at ${application.company} ` +
      `has a deadline on ${application.deadline?.toUTCString()}.\n\n` +
      `Open Waypoint: ${clientUrl()}\n\n` +
      `You can turn these reminders off in Settings or on the application itself.`,
  });
}

/** FR-8: invitation to view an applicant's pipeline. */
export async function sendMentorInvite({ applicantName, mentorEmail, hasAccount }) {
  const next = hasAccount
    ? `Log in to Waypoint to accept: ${clientUrl()}/login`
    : `Create a Mentor account with this email to accept: ${clientUrl()}/signup`;

  return sendEmail({
    to: mentorEmail,
    subject: `${applicantName} invited you to mentor them on Waypoint`,
    text:
      `${applicantName} invited you to view their job-application pipeline on Waypoint ` +
      `and leave feedback. Your access is read-only and they can revoke it at any time.\n\n` +
      `${next}`,
  });
}
