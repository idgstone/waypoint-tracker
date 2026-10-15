import { Router } from "express";
import mongoose from "mongoose";
import Application, { STAGES } from "../models/Application.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// GET /api/analytics — FR-7: stage counts + conversion rates between
// consecutive stages, for the caller's own pipeline.
router.get("/", async (req, res) => {
  const counts = await Application.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(req.userId) } },
    { $group: { _id: "$stage", count: { $sum: 1 } } },
  ]);

  const countByStage = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const { _id, count } of counts) {
    if (_id in countByStage) countByStage[_id] = count;
  }

  // Funnel order (Offer and Rejected are both terminal, so the funnel
  // itself only runs Applied -> OA -> Interview -> Offer, matching the
  // wireframe's conversion-funnel chart).
  const funnelStages = ["Applied", "Online Assessment", "Interview", "Offer"];
  const funnel = funnelStages.map((stage) => ({ stage, count: countByStage[stage] }));

  const conversions = [];
  for (let i = 0; i < funnelStages.length - 1; i++) {
    const from = funnel[i];
    const to = funnel[i + 1];
    const rate = from.count > 0 ? to.count / from.count : 0;
    conversions.push({
      from: from.stage,
      to: to.stage,
      rate: Number(rate.toFixed(4)),
    });
  }

  res.json({
    stageCounts: countByStage,
    funnel,
    conversions,
  });
});

export default router;
