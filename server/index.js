import express from "express";
import cors from "cors";
import "dotenv/config";

import { connectDB } from "./src/config/db.js";
import applicationRoutes from "./src/routes/applications.js";
import mentorRoutes from "./src/routes/mentors.js";
import settingsRoutes from "./src/routes/settings.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Waypoint API is running." });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// TODO(Michael): app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/mentors", mentorRoutes);
app.use("/api/settings", settingsRoutes);
// TODO(Sprint Two): app.use("/api/analytics", analyticsRoutes);
// TODO(Michael, FR-13): app.use("/api/admin", adminRoutes);

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
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
