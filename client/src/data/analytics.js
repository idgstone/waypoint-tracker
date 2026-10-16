import { localDate } from "./applicationStages.js";

export const funnelStages = [
  { id: "applied", label: "Applied" },
  { id: "onlineAssessment", label: "Online Assessment" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
];

// Calendar-day cohorts include today and the preceding 29 or 89 days.
export function filterApplications(applications, period, today = localDate()) {
  if (period === "all") return applications;
  const days = period === "30" ? 30 : 90;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const firstDay = start.toISOString().slice(0, 10);
  return applications.filter(({ appliedDate }) => appliedDate >= firstDay && appliedDate <= today);
}

export function calculateFunnel(applications) {
  const counts = { applied: applications.length, onlineAssessment: 0, interview: 0, offer: 0 };
  for (const application of applications) {
    const reached = new Set([application.stage, ...(application.history ?? []).map((entry) => entry.stage)]);
    for (const { id } of funnelStages.slice(1)) if (reached.has(id)) counts[id] += 1;
  }
  const maximum = Math.max(...Object.values(counts), 1);
  return funnelStages.map((stage, index) => {
    const denominator = index === 0 ? null : counts[funnelStages[index - 1].id];
    return { ...stage, count: counts[stage.id], height: counts[stage.id] / maximum * 100,
      percentage: denominator ? `${Math.round(counts[stage.id] / denominator * 100)}%` : "—" };
  });
}
