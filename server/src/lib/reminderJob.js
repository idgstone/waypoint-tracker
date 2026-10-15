import Application from "../models/Application.js";
import User from "../models/User.js";
import { sendDeadlineReminder } from "./emailService.js";

const WINDOW_MS = 24 * 60 * 60 * 1000; // remind for deadlines within the next 24h

/**
 * FR-6: scheduled job — finds applications with an upcoming deadline that
 * are still open (not Offer/Rejected, see Observer in applicationEvents.js
 * which already stops reminding once a pipeline closes) and sends a
 * reminder to each owner who has opted in. Call this on an interval from
 * index.js.
 */
export async function checkAndSendDeadlineReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_MS);

  const dueApplications = await Application.find({
    deadline: { $gte: now, $lte: windowEnd },
    reminderEnabled: true,
    stage: { $nin: ["Offer", "Rejected"] },
  }).populate("owner");

  const results = [];
  for (const application of dueApplications) {
    if (!application.owner) continue;
    try {
      const result = await sendDeadlineReminder(application.owner, application);
      results.push({ applicationId: application._id, ...result });
    } catch (err) {
      console.error(`[reminderJob] failed to send reminder for ${application._id}:`, err.message);
    }
  }
  return results;
}
