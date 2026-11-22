import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import MentorLink from "../models/MentorLink.js";
import { validateRegistration } from "../lib/validators.js";
import { signToken } from "../lib/jwt.js";
import { UserFactory } from "../lib/userFactory.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { deleteAccount, anotherAdminExists } from "../lib/accountDeletion.js";

const router = Router();

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

// POST /api/auth/register — FR-1
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  const errors = validateRegistration({ name, email, password, role });
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(" ") });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  // Factory Method: role-specific defaults live in lib/userFactory.js.
  const user = await UserFactory.create(role || "applicant", { name, email, password });

  // UC-4: an applicant may have invited this email before the mentor had
  // an account. Attach those pending invitations to the new mentor.
  if (user.role === "mentor") {
    await MentorLink.updateMany({ mentorEmail: normalizedEmail, mentor: null }, { mentor: user._id });
  }

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login — FR-2
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (user.disabled) {
    return res.status(403).json({ error: "This account has been disabled. Contact an administrator." });
  }

  user.lastActiveAt = new Date();
  await user.save();

  res.json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/logout — FR-2 / NFR 5.2: invalidates every token issued so far
router.post("/logout", requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.userId }, { $inc: { tokenVersion: 1 } });
  res.status(204).send();
});

// GET /api/auth/me — who am I (frontend uses this to restore a session)
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(publicUser(user));
});

/**
 * DELETE /api/auth/me — FR-15: delete your own account.
 * Body: { password } (your current password, re-entered to confirm).
 * Applicants and mentors can always delete themselves; an admin only if
 * another admin account remains. See lib/accountDeletion.js for what is removed.
 */
router.delete("/me", requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Enter your password to confirm.", code: "password-required" });
  }

  const user = await User.findById(req.userId);
  if (!(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(400).json({ error: "Incorrect password.", code: "invalid-password" });
  }
  if (user.role === "admin" && !(await anotherAdminExists(user._id))) {
    return res.status(403).json({ error: "You are the only admin, so this account can't be deleted.", code: "last-admin" });
  }

  await deleteAccount(user);
  res.json({ deleted: true, id: String(user._id) });
});

export default router;
