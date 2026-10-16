import { Router } from "express";
import Application, { STAGES } from "../models/Application.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth, requireRole("applicant"));

// Funnel order. Offer and Rejected are both terminal; Rejected is not a
// funnel step, but an application rejected after an interview still
// counts as having reached Interview.
export const FUNNEL_STAGES = ["Applied", "Online Assessment", "Interview", "Offer"];

/**
 * Pure helper (exported for tests): given applications with stageHistory,
 * returns how many reached each funnel stage and the conversion rate
 * between consecutive stages.
 *
 * "Reached" uses the furthest funnel stage in each application's history,
 * so skipping a stage (Applied -> Interview with no OA) still counts as
 * passing through the earlier ones. Counting only *current* stages, as the
 * first version did, made every rate wrong once applications moved on.
 */
export function computeFunnel(applications) {
  const reached = FUNNEL_STAGES.map(() => 0);

  for (const app of applications) {
    const history = app.stageHistory?.length ? app.stageHistory : [{ stage: app.stage }];
    let furthest = 0; // every application starts at Applied
    for (const { stage } of history) {
      const idx = FUNNEL_STAGES.indexOf(stage);
      if (idx > furthest) furthest = idx;
    }
    for (let i = 0; i <= furthest; i++) reached[i]++;
  }

  const funnel = FUNNEL_STAGES.map((stage, i) => ({ stage, count: reached[i] }));
  const conversions = [];
  for (let i = 0; i < FUNNEL_STAGES.length - 1; i++) {
    const from = reached[i];
    const to = reached[i + 1];
    conversions.push({
      from: FUNNEL_STAGES[i],
      to: FUNNEL_STAGES[i + 1],
      rate: from > 0 ? Number((to / from).toFixed(4)) : 0,
    });
  }
  return { funnel, conversions };
}

function parseOptionalDate(value) {
  if (value === undefined || value === "") return { value: undefined };
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? { error: true } : { value: d };
}

/**
 * GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD — FR-7
 * Stage counts (current stage), funnel (reached stage) and conversion
 * rates for the caller's applications, optionally limited to those whose
 * dateApplied falls within [from, to] (both inclusive, both optional).
 */
router.get("/", async (req, res) => {
  const from = parseOptionalDate(req.query.from);
  const to = parseOptionalDate(req.query.to);
  if (from.error || to.error) {
    return res.status(400).json({ error: "from and to must be valid dates (e.g. 2026-09-01)." });
  }
  if (to.value && typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) {
    to.value.setUTCHours(23, 59, 59, 999); // a bare date means "through the end of that day"
  }
  if (from.value && to.value && from.value > to.value) {
    return res.status(400).json({ error: "from must be on or before to." });
  }

  const filter = { owner: req.userId };
  if (from.value || to.value) {
    filter.dateApplied = {};
    if (from.value) filter.dateApplied.$gte = from.value;
    if (to.value) filter.dateApplied.$lte = to.value;
  }

  const applications = await Application.find(filter).select("stage stageHistory").lean();

  const stageCounts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const app of applications) {
    if (app.stage in stageCounts) stageCounts[app.stage]++;
  }

  res.json({
    range: { from: from.value ?? null, to: to.value ?? null },
    total: applications.length,
    stageCounts,
    ...computeFunnel(applications),
  });
});

export default router;
