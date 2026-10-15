import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { validateRegistration } from "../lib/validators.js";
import { signToken } from "../lib/jwt.js";

const router = Router();

// POST /api/auth/register — FR-1
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  const errors = validateRegistration({ name, email, password, role });
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(" ") });
  }

  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    role: role || "applicant",
  });

  const token = signToken(user);
  res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /api/auth/login — FR-2
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required." });
  }

  const user = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (!user || user.disabled) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

export default router;
