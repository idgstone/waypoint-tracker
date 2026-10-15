import { Router } from "express";
import User from "../models/User.js";
import Application from "../models/Application.js";
import MentorLink from "../models/MentorLink.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();
// FR-13/14 Security: every route below is restricted to role "admin".
router.use(requireAuth, requireRole("admin"));

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // "active" = seen in the last 30 days

const SAFE_FIELDS = "-passwordHash -tokenVersion";

// GET /api/admin/users — FR-13: list user accounts and their status
router.get("/users", async (req, res) => {
  const users = await User.find().select(SAFE_FIELDS).sort({ createdAt: -1 });
  res.json(users);
});

/**
 * PATCH /api/admin/users/:id/disable and /enable — FR-13.
 * UC-7 alternate flow: if the account is already in that state, nothing
 * changes and the response says so (alreadyInState: true).
 */
function setDisabled(disabled) {
  return async (req, res) => {
    if (disabled && req.params.id === req.userId) {
      return res.status(400).json({ error: "You can't disable your own admin account." });
    }

    const user = await User.findById(req.params.id).select(SAFE_FIELDS);
    if (!user) return res.status(404).json({ error: "User not found." });

    const alreadyInState = user.disabled === disabled;
    if (!alreadyInState) {
      user.disabled = disabled;
      await user.save();
    }
    res.json({ user, alreadyInState });
  };
}

router.patch("/users/:id/disable", setDisabled(true));
router.patch("/users/:id/enable", setDisabled(false));

// GET /api/admin/metrics — FR-14: basic usage metrics (matches the Admin Dashboard cards)
router.get("/metrics", async (req, res) => {
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const [totalUsers, activeUsers, disabledAccounts, totalApplications, invitationsSent, usersByRole] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ disabled: false, lastActiveAt: { $gte: activeSince } }),
      User.countDocuments({ disabled: true }),
      Application.countDocuments(),
      MentorLink.countDocuments(),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    ]);

  res.json({
    totalUsers,
    activeUsers,
    disabledAccounts,
    totalApplications,
    invitationsSent,
    usersByRole: Object.fromEntries(usersByRole.map((r) => [r._id, r.count])),
  });
});

export default router;
