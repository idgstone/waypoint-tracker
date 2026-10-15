import { Router } from "express";
import MentorLink from "../models/MentorLink.js";
import Application from "../models/Application.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth);

// POST /api/mentors/invite — FR-8: Applicant invites a Mentor by email
router.post("/invite", requireRole("applicant"), async (req, res) => {
  const { mentorEmail } = req.body;
  if (!mentorEmail || !mentorEmail.trim()) {
    return res.status(400).json({ error: "mentorEmail is required." });
  }

  const email = mentorEmail.trim().toLowerCase();
  const mentorUser = await User.findOne({ email, role: "mentor" });
  if (!mentorUser) {
    return res.status(404).json({ error: "No mentor account found for that email." });
  }

  const link = await MentorLink.findOneAndUpdate(
    { applicant: req.userId, mentor: mentorUser._id },
    { $setOnInsert: { status: "pending", mentorEmail: email } },
    { upsert: true, new: true }
  );

  // TODO: send the actual invite email via lib/emailService.js once that's wired up.
  res.status(201).json(link);
});

// POST /api/mentors/invitations/:linkId/accept — FR-9: Mentor accepts an invitation
router.post("/invitations/:linkId/accept", requireRole("mentor"), async (req, res) => {
  const link = await MentorLink.findOneAndUpdate(
    { _id: req.params.linkId, mentor: req.userId, status: "pending" },
    { status: "accepted" },
    { new: true }
  );
  if (!link) {
    return res.status(404).json({ error: "Pending invitation not found." });
  }
  res.json(link);
});

// DELETE /api/mentors/share/:mentorId — applicant revokes a mentor's access
router.delete("/share/:mentorId", requireRole("applicant"), async (req, res) => {
  const link = await MentorLink.findOneAndUpdate(
    { applicant: req.userId, mentor: req.params.mentorId },
    { status: "revoked" },
    { new: true }
  );
  if (!link) {
    return res.status(404).json({ error: "Mentor link not found." });
  }
  res.json(link);
});

// GET /api/mentors/roster — FR-9: mentor's list of linked applicants (read-only)
router.get("/roster", requireRole("mentor"), async (req, res) => {
  const links = await MentorLink.find({ mentor: req.userId, status: "accepted" }).populate(
    "applicant",
    "name email"
  );
  res.json(links);
});

// GET /api/mentors/invitations — FR-9: mentor's pending invitations to accept/decline
router.get("/invitations", requireRole("mentor"), async (req, res) => {
  const links = await MentorLink.find({ mentor: req.userId, status: "pending" }).populate(
    "applicant",
    "name email"
  );
  res.json(links);
});

// GET /api/mentors/applicants/:applicantId/pipeline — FR-9: read-only pipeline view
router.get("/applicants/:applicantId/pipeline", requireRole("mentor"), async (req, res) => {
  const link = await MentorLink.findOne({
    mentor: req.userId,
    applicant: req.params.applicantId,
    status: "accepted",
  });
  if (!link) {
    return res.status(403).json({ error: "No accepted mentor link for this applicant." });
  }

  const applications = await Application.find({ owner: req.params.applicantId }).sort({
    createdAt: -1,
  });
  res.json(applications);
});

export default router;
