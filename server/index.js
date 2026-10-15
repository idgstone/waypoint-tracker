import "dotenv/config";

import { connectDB } from "./src/config/db.js";
import { createApp } from "./src/app.js";
import { checkAndSendDeadlineReminders } from "./src/lib/reminderJob.js";

const PORT = process.env.PORT || 5000;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // hourly

function runReminders() {
  checkAndSendDeadlineReminders().catch((err) =>
    console.error("[reminderJob] run failed:", err.message)
  );
}

connectDB()
  .then(() => {
    createApp().listen(PORT, () => {
      console.log(`Waypoint API listening on port ${PORT}`);
    });

    // FR-6: check for upcoming deadlines on startup, then hourly.
    runReminders();
    setInterval(runReminders, REMINDER_INTERVAL_MS);
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
