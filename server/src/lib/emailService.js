/**
 * FR-6: transactional email for deadline reminders, via SendGrid's REST
 * API (no SDK dependency needed — a single fetch call). Swap the fetch
 * target for AWS SES if the team picks that instead; the sendEmail()
 * call site elsewhere in the app doesn't need to change.
 *
 * Per NFR 5.2 / the Production Plan's FR-6 Security row: only call this
 * for a user who has opted in, and never log/store more of the address
 * than needed to send the message.
 */
const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "no-reply@waypoint.app";

export async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.EMAIL_SERVICE_API_KEY;
  if (!apiKey) {
    console.warn(`[emailService] EMAIL_SERVICE_API_KEY not set — skipping email to ${to}: "${subject}"`);
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
      from: { email: FROM_ADDRESS },
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

/** FR-6: builds and sends a single application's deadline reminder, respecting opt-in. */
export async function sendDeadlineReminder(user, application) {
  const optedIn = user.notificationPreferences?.deadlineReminders && application.reminderEnabled;
  if (!optedIn) {
    return { sent: false, reason: "not-opted-in" };
  }

  return sendEmail({
    to: user.email,
    subject: `Reminder: ${application.company} deadline coming up`,
    text: `Your application for ${application.position} at ${application.company} has a deadline on ${application.deadline?.toDateString()}.`,
  });
}
