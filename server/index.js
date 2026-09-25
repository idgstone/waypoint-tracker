import express from "express";
import cors from "cors";
import "dotenv/config";

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

// TODO: mount route modules as they're built
// app.use("/api/auth", authRoutes);
// app.use("/api/applications", applicationRoutes);
// app.use("/api/mentors", mentorRoutes);

app.listen(PORT, () => {
  console.log(`Waypoint API listening on port ${PORT}`);
});
