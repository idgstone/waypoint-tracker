import express from "express";
import cors from "cors";
import "dotenv/config";

import { connectDB } from "./src/config/db.js";
import authRoutes from "./src/routes/auth.js";
import applicationRoutes from "./src/routes/applications.js";
import mentorRoutes from "./src/routes/mentors.js";
import settingsRoutes from "./src/routes/settings.js";
import analyticsRoutes from "./src/routes/analytics.js";
import adminRoutes from "./src/routes/admin.js";
import { checkAndSendDeadlineReminders } from "./src/lib/reminderJob.js";

const app = express();
const PORT = process.env.PORT || 5000;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // hourly

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Waypoint API is running." });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/mentors", mentorRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", adminRoutes);

// Basic error handler so a thrown/rejected route doesn't crash the process
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Waypoint API listening on port ${PORT}`);
    });

    // FR-6: periodically check for upcoming deadlines and send reminders.
    setInterval(() => {
      checkAndSendDeadlineReminders().catch((err) =>
        console.error("[reminderJob] run failed:", err.message)
      );
    }, REMINDER_INTERVAL_MS);
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
