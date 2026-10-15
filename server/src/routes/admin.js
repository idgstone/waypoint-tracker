import { Router } from "express";
import User from "../models/User.js";
import Application from "../models/Application.js";
import MentorLink from "../models/MentorLink.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();
// FR-13/14 Security: every route below is restricted to role "admin".
router.use(requireAuth, requireRole("admin"));

// GET /api/admin/users — FR-13: list user accounts
router.get("/users", async (req, res) => {
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
  res.json(users);
});

// PATCH /api/admin/users/:id/disable — FR-13
router.patch("/users/:id/disable", async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { disabled: true }, { new: true }).select(
    "-passwordHash"
  );
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

// PATCH /api/admin/users/:id/enable — FR-13
router.patch("/users/:id/enable", async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { disabled: false }, { new: true }).select(
    "-passwordHash"
  );
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

// GET /api/admin/metrics — FR-14: basic usage metrics
router.get("/metrics", async (req, res) => {
  const [activeUsers, totalUsers, totalApplications, invitationsSent] = await Promise.all([
    User.countDocuments({ disabled: false }),
    User.countDocuments(),
    Application.countDocuments(),
    MentorLink.countDocuments(),
  ]);

  res.json({ activeUsers, totalUsers, totalApplications, invitationsSent });
});

export default router;
