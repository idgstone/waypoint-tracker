import { Router } from "express";
import Application, { STAGES } from "../models/Application.js";
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
  const { company, position, deadline, notes } = req.body;
  if (!company || !position) {
    return res.status(400).json({ error: "company and position are required." });
  }

  const application = await Application.create({
    owner: req.userId,
    company,
    position,
    deadline: deadline || null,
    notes: notes || "",
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

// PATCH /api/applications/:id — edit company/position/deadline/notes
router.patch("/:id", async (req, res) => {
  const { company, position, deadline, notes, reminderEnabled } = req.body;

  const application = await Application.findOne({ _id: req.params.id, owner: req.userId });
  if (!application) {
    return res.status(404).json({ error: "Application not found." });
  }

  if (company !== undefined) application.company = company;
  if (position !== undefined) application.position = position;
  if (deadline !== undefined) application.deadline = deadline;
  if (notes !== undefined) application.notes = notes;
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

export default router;
