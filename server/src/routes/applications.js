import { Router } from "express";
import Application, { STAGES } from "../models/Application.js";
import Feedback from "../models/Feedback.js";
import MentorLink from "../models/MentorLink.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { applicationEvents, STAGE_CHANGED } from "../lib/applicationEvents.js";

const router = Router();
router.use(requireAuth);

// FR-11: only Applicants own and edit applications. Mentors get read-only
// access through /api/mentors; Administrators never touch application data.
const applicantOnly = requireRole("applicant");

function parseDate(value, label) {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: `${label} must be a valid date.` };
  return { value: d };
}

async function findOwned(req, res) {
  const application = await Application.findOne({ _id: req.params.id, owner: req.userId });
  if (!application) res.status(404).json({ error: "Application not found." });
  return application;
}

// GET /api/applications — the current Applicant's board
router.get("/", applicantOnly, async (req, res) => {
  const applications = await Application.find({ owner: req.userId }).sort({ createdAt: -1 });
  res.json(applications);
});

// GET /api/applications/:id — detail view
router.get("/:id", applicantOnly, async (req, res) => {
  const application = await findOwned(req, res);
  if (application) res.json(application);
});

// POST /api/applications — FR-3: add a new application (always starts in "Applied")
router.post("/", applicantOnly, async (req, res) => {
  const { company, position, link, dateApplied, deadline, reminderEnabled } = req.body;

  const errors = [];
  if (typeof company !== "string" || !company.trim()) errors.push("Company name is required.");
  if (typeof position !== "string" || !position.trim()) errors.push("Role title is required.");
  const applied = parseDate(dateApplied, "Date applied");
  const due = parseDate(deadline, "Deadline");
  if (applied.error) errors.push(applied.error);
  if (due.error) errors.push(due.error);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const application = await Application.create({
    owner: req.userId,
    company,
    position,
    link: link || "",
    ...(applied.value ? { dateApplied: applied.value } : {}),
    deadline: due.value ?? null,
    reminderEnabled: reminderEnabled !== undefined ? Boolean(reminderEnabled) : true,
  });

  res.status(201).json(application);
});

// PATCH /api/applications/:id/stage — FR-4: move stage, timestamp the transition
router.patch("/:id/stage", applicantOnly, async (req, res) => {
  const { stage } = req.body;
  if (!STAGES.includes(stage)) {
    return res.status(400).json({ error: `Stage must be one of: ${STAGES.join(", ")}.` });
  }

  const application = await findOwned(req, res);
  if (!application) return;

  const previousStage = application.stage;
  if (previousStage === stage) {
    return res.json(application); // no-op: don't add a duplicate history entry
  }

  application.stage = stage;
  application.stageHistory.push({ stage, changedAt: new Date() });
  await application.save();

  // Observer pattern: notify analytics + reminder listeners without this
  // route needing to know what they do (see lib/applicationEvents.js).
  applicationEvents.emit(STAGE_CHANGED, { application, previousStage, newStage: stage });

  res.json(application);
});

// PATCH /api/applications/:id — edit details (not stage; use /stage for that)
router.patch("/:id", applicantOnly, async (req, res) => {
  const { company, position, link, dateApplied, deadline, reminderEnabled } = req.body;

  const errors = [];
  if (company !== undefined && (typeof company !== "string" || !company.trim())) {
    errors.push("Company name cannot be empty.");
  }
  if (position !== undefined && (typeof position !== "string" || !position.trim())) {
    errors.push("Role title cannot be empty.");
  }
  const applied = parseDate(dateApplied, "Date applied");
  const due = parseDate(deadline, "Deadline");
  if (applied.error) errors.push(applied.error);
  if (due.error) errors.push(due.error);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const application = await findOwned(req, res);
  if (!application) return;

  if (company !== undefined) application.company = company;
  if (position !== undefined) application.position = position;
  if (link !== undefined) application.link = link || "";
  if (applied.value) application.dateApplied = applied.value;
  if (due.value !== undefined) application.deadline = due.value;
  if (reminderEnabled !== undefined) application.reminderEnabled = Boolean(reminderEnabled);

  await application.save();
  res.json(application);
});

// DELETE /api/applications/:id — also removes mentor feedback attached to it
router.delete("/:id", applicantOnly, async (req, res) => {
  const result = await Application.deleteOne({ _id: req.params.id, owner: req.userId });
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "Application not found." });
  }
  await Feedback.deleteMany({ applicationId: req.params.id });
  res.status(204).send();
});

// --- FR-5: Notes (add / edit / delete free-text notes) ---

router.post("/:id/notes", applicantOnly, async (req, res) => {
  const { text } = req.body;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Note text is required." });
  }

  const application = await findOwned(req, res);
  if (!application) return;

  application.notes.push({ text: text.trim() });
  await application.save();
  res.status(201).json(application.notes[application.notes.length - 1]);
});

router.patch("/:id/notes/:noteId", applicantOnly, async (req, res) => {
  const { text } = req.body;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Note text is required." });
  }

  const application = await findOwned(req, res);
  if (!application) return;

  const note = application.notes.id(req.params.noteId);
  if (!note) return res.status(404).json({ error: "Note not found." });

  note.text = text.trim();
  await application.save();
  res.json(note);
});

router.delete("/:id/notes/:noteId", applicantOnly, async (req, res) => {
  const application = await findOwned(req, res);
  if (!application) return;

  const note = application.notes.id(req.params.noteId);
  if (!note) return res.status(404).json({ error: "Note not found." });

  note.deleteOne();
  await application.save();
  res.status(204).send();
});

// --- FR-10: Mentor feedback on an application ---

/**
 * GET /api/applications/:id/feedback
 * Visible to the owning Applicant, and to any Mentor with an accepted link
 * to that Applicant (so the Mentor View can show earlier comments).
 */
router.get("/:id/feedback", requireRole("applicant", "mentor"), async (req, res) => {
  const application = await Application.findById(req.params.id).select("owner");
  if (!application) return res.status(404).json({ error: "Application not found." });

  const isOwner = String(application.owner) === req.userId;
  if (!isOwner) {
    const link = await MentorLink.exists({
      mentor: req.userId,
      applicant: application.owner,
      status: "accepted",
    });
    if (!link) return res.status(404).json({ error: "Application not found." });
  }

  const feedback = await Feedback.find({ applicationId: application._id })
    .sort({ createdAt: -1 })
    .populate("mentorId", "name email");
  res.json(feedback);
});

// POST /api/applications/:id/feedback — Mentor leaves feedback (needs an accepted MentorLink)
router.post("/:id/feedback", requireRole("mentor"), async (req, res) => {
  const { comment } = req.body;
  if (typeof comment !== "string" || !comment.trim()) {
    return res.status(400).json({ error: "Comment is required." });
  }

  const application = await Application.findById(req.params.id).select("owner");
  if (!application) return res.status(404).json({ error: "Application not found." });

  // UC-5 alternate flow: access revoked mid-session -> access denied.
  const link = await MentorLink.exists({
    mentor: req.userId,
    applicant: application.owner,
    status: "accepted",
  });
  if (!link) {
    return res.status(403).json({ error: "You no longer have access to this applicant's pipeline." });
  }

  const feedback = await Feedback.create({
    mentorId: req.userId,
    applicationId: application._id,
    comment: comment.trim(),
  });

  res.status(201).json(feedback);
});

export default router;
