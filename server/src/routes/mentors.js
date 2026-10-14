import { Router } from "express";
import MentorLink from "../models/MentorLink.js";
import Application from "../models/Application.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// POST /api/mentors/share — FR-5: share the caller's pipeline with a mentor
router.post("/share", async (req, res) => {
  const { mentorId } = req.body;
  if (!mentorId) {
    return res.status(400).json({ error: "mentorId is required." });
  }

  const link = await MentorLink.findOneAndUpdate(
    { applicant: req.userId, mentor: mentorId },
    { $setOnInsert: { status: "pending" } },
    { upsert: true, new: true }
  );

  res.status(201).json(link);
});

// DELETE /api/mentors/share/:mentorId — revoke a mentor's access
router.delete("/share/:mentorId", async (req, res) => {
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
router.get("/roster", async (req, res) => {
  const links = await MentorLink.find({ mentor: req.userId, status: "accepted" }).populate(
    "applicant",
    "name email"
  );
  res.json(links);
});

// GET /api/mentors/applicants/:applicantId/pipeline — FR-9: read-only pipeline view
router.get("/applicants/:applicantId/pipeline", async (req, res) => {
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

// POST /api/mentors/applicants/:applicantId/feedback — FR-10: leave feedback
router.post("/applicants/:applicantId/feedback", async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "message is required." });
  }

  const link = await MentorLink.findOneAndUpdate(
    { mentor: req.userId, applicant: req.params.applicantId, status: "accepted" },
    { $push: { feedback: { author: req.userId, message: message.trim() } } },
    { new: true }
  );
  if (!link) {
    return res.status(403).json({ error: "No accepted mentor link for this applicant." });
  }

  res.status(201).json(link);
});

export default router;
