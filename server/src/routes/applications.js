import { Router } from "express";
import Application, { STAGES } from "../models/Application.js";
import Feedback from "../models/Feedback.js";
import MentorLink from "../models/MentorLink.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { applicationEvents, STAGE_CHANGED } from "../lib/applicationEvents.js";

const router = Router();
router.use(requireAuth);

// GET /api/applications — list the current user's board (FR-3/FR-4 support)
router.get("/", async (req, res) => {
  const applications = await Application.find({ owner: req.userId }).sort({ createdAt: -1 });
  res.json(applications);
});

// POST /api/applications — FR-3: add a new application to the board
router.post("/", async (req, res) => {
  const { company, position, deadline, reminderEnabled } = req.body;
  if (!company || !position) {
    return res.status(400).json({ error: "company and position are required." });
  }

  const application = await Application.create({
    owner: req.userId,
    company,
    position,
    deadline: deadline || null,
    reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : true,
  });

  res.status(201).json(application);
});

// PATCH /api/applications/:id/stage — FR-4: move to next stage
router.patch("/:id/stage", async (req, res) => {
  const { stage } = req.body;
  if (!STAGES.includes(stage)) {
    return res.status(400).json({ error: `stage must be one of: ${STAGES.join(", ")}` });
  }

  const application = await Application.findOne({ _id: req.params.id, owner: req.userId });
  if (!application) {
    return res.status(404).json({ error: "Application not found." });
  }

  const previousStage = application.stage;
  application.stage = stage;
  application.stageHistory.push({ stage, changedAt: new Date() });
  await application.save();

  // Observer pattern: notify analytics + reminder listeners without this
  // route needing to know what they do (see lib/applicationEvents.js).
  applicationEvents.emit(STAGE_CHANGED, { application, previousStage, newStage: stage });

  res.json(application);
});

// PATCH /api/applications/:id — edit company/position/deadline/reminderEnabled
router.patch("/:id", async (req, res) => {
  const { company, position, deadline, reminderEnabled } = req.body;

  const application = await Application.findOne({ _id: req.params.id, owner: req.userId });
  if (!application) {
    return res.status(404).json({ error: "Application not found." });
  }

  if (company !== undefined) application.company = company;
  if (position !== undefined) application.position = position;
  if (deadline !== undefined) application.deadline = deadline;
  if (reminderEnabled !== undefined) application.reminderEnabled = reminderEnabled;

  await application.save();
  res.json(application);
});

// DELETE /api/applications/:id
router.delete("/:id", async (req, res) => {
  const result = await Application.deleteOne({ _id: req.params.id, owner: req.userId });
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "Application not found." });
  }
  res.status(204).send();
});

// --- FR-5: Notes (add / edit / delete free-text notes) ---

router.post("/:id/notes", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text is required." });
  }

  const application = await Application.findOne({ _id: req.params.id, owner: req.userId });
  if (!application) {
    return res.status(404).json({ error: "Application not found." });
  }

  application.notes.push({ text: text.trim() });
  await application.save();
  res.status(201).json(application.notes[application.notes.length - 1]);
});

router.patch("/:id/notes/:noteId", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text is required." });
  }

  const application = await Application.findOne({ _id: req.params.id, owner: req.userId });
  if (!application) {
    return res.status(404).json({ error: "Application not found." });
  }

  const note = application.notes.id(req.params.noteId);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }

  note.text = text.trim();
  await application.save();
  res.json(note);
});

router.delete("/:id/notes/:noteId", async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, owner: req.userId });
  if (!application) {
    return res.status(404).json({ error: "Application not found." });
  }

  const note = application.notes.id(req.params.noteId);
  if (!note) {
    return res.status(404).json({ error: "Note not found." });
  }

  note.deleteOne();
  await application.save();
  res.status(204).send();
});

// --- FR-10: Mentor feedback on this application (visible to the Applicant) ---

// GET /api/applications/:id/feedback — Applicant reads feedback left on their application
router.get("/:id/feedback", async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, owner: req.userId });
  if (!application) {
    return res.status(404).json({ error: "Application not found." });
  }

  const feedback = await Feedback.find({ applicationId: application._id }).sort({ createdAt: -1 });
  res.json(feedback);
});

// POST /api/applications/:id/feedback — Mentor leaves feedback (requires an accepted MentorLink)
router.post("/:id/feedback", async (req, res) => {
  const { comment } = req.body;
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: "comment is required." });
  }

  const application = await Application.findById(req.params.id);
  if (!application) {
    return res.status(404).json({ error: "Application not found." });
  }

  const link = await MentorLink.findOne({
    mentor: req.userId,
    applicant: application.owner,
    status: "accepted",
  });
  if (!link) {
    return res.status(403).json({ error: "No accepted mentor link for this applicant." });
  }

  const feedback = await Feedback.create({
    mentorId: req.userId,
    applicationId: application._id,
    comment: comment.trim(),
  });

  res.status(201).json(feedback);
});

export default router;
