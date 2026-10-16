import Application from "../models/Application.js";
import { sendDeadlineReminder } from "./emailService.js";

const WINDOW_MS = 24 * 60 * 60 * 1000; // remind for deadlines within the next 24h

/**
 * FR-6 scheduled job (run hourly from index.js). Finds open applications
 * (not Offer/Rejected, per UC-2's alternate flow) with a deadline in the
 * next 24 hours that haven't been reminded for that deadline yet, and
 * emails each opted-in, active owner once.
 *
 * reminderSentFor stores the deadline that was reminded, so an hourly job
 * sends one email per deadline instead of up to 24, and editing the
 * deadline makes the application eligible again.
 */
export async function checkAndSendDeadlineReminders(now = new Date()) {
  const windowEnd = new Date(now.getTime() + WINDOW_MS);

  const dueApplications = await Application.find({
    deadline: { $gte: now, $lte: windowEnd },
    reminderEnabled: true,
    stage: { $nin: ["Offer", "Rejected"] },
  }).populate("owner", "name email disabled notificationPreferences");

  const results = [];
  for (const application of dueApplications) {
    const owner = application.owner;
    if (!owner || owner.disabled) continue;
    if (
      application.reminderSentFor &&
      application.reminderSentFor.getTime() === application.deadline.getTime()
    ) {
      continue; // already reminded for this exact deadline
    }

    try {
      const result = await sendDeadlineReminder(owner, application);
      if (result.sent) {
        await Application.updateOne(
          { _id: application._id },
          { reminderSentFor: application.deadline }
        );
      }
      results.push({ applicationId: application._id, ...result });
    } catch (err) {
      console.error(`[reminderJob] failed to send reminder for ${application._id}:`, err.message);
      results.push({ applicationId: application._id, sent: false, reason: "send-failed" });
    }
  }
  return results;
}
