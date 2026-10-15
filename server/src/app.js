import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import applicationRoutes from "./routes/applications.js";
import mentorRoutes from "./routes/mentors.js";
import settingsRoutes from "./routes/settings.js";
import analyticsRoutes from "./routes/analytics.js";
import adminRoutes from "./routes/admin.js";

/**
 * Builds the Express app without starting it, so index.js (real server)
 * and scripts/tests can share the exact same wiring.
 *
 * Express 5 forwards rejected promises from async handlers to the error
 * handler below. On Express 4 a single bad id (e.g. /api/applications/abc)
 * threw an unhandled rejection and crashed the whole process.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_URL || true }));
  app.use(express.json());
  // Express 5 leaves req.body undefined when there is no JSON body;
  // default it so handlers can always destructure safely.
  app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });

  // FR-12: public, no auth required.
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

  app.use((req, res) => {
    res.status(404).json({ error: "Route not found." });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ error: `Invalid ${err.path}: ${err.value}` });
    }
    if (err instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(" ") });
    }
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Request body is not valid JSON." });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
