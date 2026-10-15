import { Router } from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

const SAFE_FIELDS = "-passwordHash -tokenVersion";

// GET /api/settings — profile + notification preferences (Settings screen, FR-6/FR-11)
router.get("/", async (req, res) => {
  const user = await User.findById(req.userId).select(SAFE_FIELDS);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

// PATCH /api/settings — update name and/or notification preferences
router.patch("/", async (req, res) => {
  const { name, notificationPreferences } = req.body;

  const update = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name cannot be empty." });
    }
    update.name = name.trim();
  }
  if (notificationPreferences !== undefined) {
    for (const key of ["deadlineReminders", "mentorFeedback"]) {
      const value = notificationPreferences?.[key];
      if (value === undefined) continue;
      if (typeof value !== "boolean") {
        return res.status(400).json({ error: `${key} must be true or false.` });
      }
      update[`notificationPreferences.${key}`] = value;
    }
  }

  const result = await User.updateOne({ _id: req.userId }, update);
  if (result.matchedCount === 0) return res.status(404).json({ error: "User not found." });
  const user = await User.findById(req.userId).select(SAFE_FIELDS);
  res.json(user);
});

export default router;
