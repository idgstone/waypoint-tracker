import { Router } from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// GET /api/settings — FR-11: current profile + notification preferences
router.get("/", async (req, res) => {
  const user = await User.findById(req.userId).select("-passwordHash");
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  res.json(user);
});

// PATCH /api/settings — FR-11: update profile / notification preferences
router.patch("/", async (req, res) => {
  const { name, notificationPreferences } = req.body;

  const update = {};
  if (name !== undefined) update.name = name;
  if (notificationPreferences !== undefined) {
    if (notificationPreferences.deadlineReminders !== undefined) {
      update["notificationPreferences.deadlineReminders"] = notificationPreferences.deadlineReminders;
    }
    if (notificationPreferences.mentorFeedback !== undefined) {
      update["notificationPreferences.mentorFeedback"] = notificationPreferences.mentorFeedback;
    }
  }

  const user = await User.findByIdAndUpdate(req.userId, update, {
    new: true,
  }).select("-passwordHash");

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  res.json(user);
});

export default router;
