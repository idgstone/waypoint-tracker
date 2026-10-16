import { Router } from "express";
import MentorLink from "../models/MentorLink.js";
import Application, { STAGES } from "../models/Application.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { isValidEmail } from "../lib/validators.js";
import { sendMentorInvite } from "../lib/emailService.js";

const router = Router();
router.use(requireAuth);

const applicantOnly = requireRole("applicant");
const mentorOnly = requireRole("mentor");

// ---------------- Applicant side ----------------

/**
 * POST /api/mentors/invite — FR-8: Applicant invites a Mentor by email.
 * Works whether or not the mentor has an account yet (UC-4). Re-inviting
 * a revoked mentor reopens the same link as pending.
 */
router.post("/invite", applicantOnly, async (req, res) => {
  const { mentorEmail } = req.body;
  if (!isValidEmail(mentorEmail)) {
    return res.status(400).json({ error: "Enter a valid mentor email address." });
  }
  const email = mentorEmail.trim().toLowerCase();

  const applicant = await User.findById(req.userId).select("name email");
  if (email === applicant.email) {
    return res.status(400).json({ error: "You can't invite yourself as a mentor." });
  }

  const existingUser = await User.findOne({ email }).select("role");
  if (existingUser && existingUser.role !== "mentor") {
    return res
      .status(400)
      .json({ error: "That email belongs to a non-mentor account. Ask them to use a Mentor account." });
  }
  const mentorId = existingUser ? existingUser._id : null;

  let link = await MentorLink.findOne({ applicant: req.userId, mentorEmail: email });
  if (link?.status === "accepted") {
    return res.status(409).json({ error: "This mentor already has access to your pipeline." });
  }

  let status = 201;
  if (link) {
    link.status = "pending";
    link.mentor = mentorId;
    await link.save();
    status = 200; // reopened / resent
  } else {
    link = await MentorLink.create({ applicant: req.userId, mentor: mentorId, mentorEmail: email });
  }

  let emailSent = false;
  try {
    const result = await sendMentorInvite({
      applicantName: applicant.name,
      mentorEmail: email,
      hasAccount: Boolean(mentorId),
    });
    emailSent = result.sent;
  } catch (err) {
    console.error("[mentors] invite email failed:", err.message);
  }

  res.status(status).json({ ...link.toObject(), emailSent });
});

// GET /api/mentors — Applicant's mentors (pending + accepted), for Settings / Invite dialog
router.get("/", applicantOnly, async (req, res) => {
  const links = await MentorLink.find({ applicant: req.userId, status: { $ne: "revoked" } })
    .sort({ createdAt: -1 })
    .populate("mentor", "name email");
  res.json(links);
});

// DELETE /api/mentors/links/:linkId — UC-4 alternate flow: revoke access immediately
router.delete("/links/:linkId", applicantOnly, async (req, res) => {
  const link = await MentorLink.findOneAndUpdate(
    { _id: req.params.linkId, applicant: req.userId },
    { status: "revoked" },
    { new: true }
  );
  if (!link) return res.status(404).json({ error: "Mentor link not found." });
  res.json(link);
});

// DELETE /api/mentors/share/:mentorId — same as above, addressed by mentor user id
router.delete("/share/:mentorId", applicantOnly, async (req, res) => {
  const link = await MentorLink.findOneAndUpdate(
    { applicant: req.userId, mentor: req.params.mentorId },
    { status: "revoked" },
    { new: true }
  );
  if (!link) return res.status(404).json({ error: "Mentor link not found." });
  res.json(link);
});

// ---------------- Mentor side ----------------

// GET /api/mentors/invitations — FR-9: pending invitations to accept/decline
router.get("/invitations", mentorOnly, async (req, res) => {
  const links = await MentorLink.find({ mentor: req.userId, status: "pending" }).populate(
    "applicant",
    "name email"
  );
  res.json(links);
});

// POST /api/mentors/invitations/:linkId/accept — FR-9
router.post("/invitations/:linkId/accept", mentorOnly, async (req, res) => {
  const link = await MentorLink.findOneAndUpdate(
    { _id: req.params.linkId, mentor: req.userId, status: "pending" },
    { status: "accepted" },
    { new: true }
  );
  if (!link) return res.status(404).json({ error: "Pending invitation not found." });
  res.json(link);
});

// POST /api/mentors/invitations/:linkId/decline
router.post("/invitations/:linkId/decline", mentorOnly, async (req, res) => {
  const link = await MentorLink.findOneAndUpdate(
    { _id: req.params.linkId, mentor: req.userId, status: "pending" },
    { status: "revoked" },
    { new: true }
  );
  if (!link) return res.status(404).json({ error: "Pending invitation not found." });
  res.json(link);
});

// GET /api/mentors/roster — FR-9: applicants this mentor can view
router.get("/roster", mentorOnly, async (req, res) => {
  const links = await MentorLink.find({ mentor: req.userId, status: "accepted" }).populate(
    "applicant",
    "name email"
  );
  res.json(links);
});

/**
 * GET /api/mentors/applicants/:applicantId/pipeline — FR-9 read-only view.
 * Returns the summary the Mentor View needs (SRS 3.3: counts per stage,
 * recent activity, upcoming deadlines) plus the applications themselves
 * (notes and stage history included). There is no mentor write route for
 * applications; every mutation route requires the applicant role.
 */
router.get("/applicants/:applicantId/pipeline", mentorOnly, async (req, res) => {
  const link = await MentorLink.findOne({
    mentor: req.userId,
    applicant: req.params.applicantId,
    status: "accepted",
  }).populate("applicant", "name email");
  if (!link) {
    return res.status(403).json({ error: "No accepted mentor link for this applicant." });
  }

  const applications = await Application.find({ owner: req.params.applicantId })
    .select("-reminderSentFor -reminderEnabled")
    .sort({ updatedAt: -1 })
    .lean();

  const stageCounts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const a of applications) stageCounts[a.stage]++;

  const now = new Date();
  const upcomingDeadlines = applications
    .filter((a) => a.deadline && new Date(a.deadline) >= now && !["Offer", "Rejected"].includes(a.stage))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .map((a) => ({ applicationId: a._id, company: a.company, position: a.position, deadline: a.deadline }));

  const recentActivity = applications
    .flatMap((a) =>
      (a.stageHistory || []).map((h) => ({
        applicationId: a._id,
        company: a.company,
        stage: h.stage,
        changedAt: h.changedAt,
      }))
    )
    .sort((x, y) => new Date(y.changedAt) - new Date(x.changedAt))
    .slice(0, 10);

  res.json({
    applicant: link.applicant,
    summary: { total: applications.length, stageCounts, upcomingDeadlines, recentActivity },
    applications,
  });
});

export default router;
