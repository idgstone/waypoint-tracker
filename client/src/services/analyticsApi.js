import { funnelStages } from "../data/analytics.js";

export function analyticsQuery({ from = "", to = "" } = {}) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return query.size ? `/analytics?${query}` : "/analytics";
}

// Counts and rates are supplied by the API, never reconstructed from Board data.
export function analyticsVisuals(response) {
  const validCount = (value) => Number.isInteger(value) && value >= 0;
  if (!response || !validCount(response.total) || !Array.isArray(response.funnel) || !Array.isArray(response.conversions)) throw new Error("The server returned invalid analytics.");
  const counts = funnelStages.map(({ label }) => response.funnel.find((entry) => entry.stage === label)?.count);
  if (!counts.every(validCount) || ![...funnelStages.map(({ label }) => label), "Rejected"].every((label) => validCount(response.stageCounts?.[label]))) throw new Error("The server returned invalid analytics counts.");
  const maximum = Math.max(...counts, 1);
  return {
    total: response.total, rejected: response.stageCounts.Rejected,
    stages: funnelStages.map((stage, index) => {
      let percentage = "—";
      if (index > 0) {
        const rate = response.conversions.find((entry) => entry.from === funnelStages[index - 1].label && entry.to === stage.label)?.rate;
        if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error("The server returned an invalid analytics rate.");
        if (counts[index - 1] > 0) percentage = `${Math.round(rate * 100)}%`;
      }
      return { ...stage, count: counts[index], currentCount: response.stageCounts[stage.label], height: counts[index] / maximum * 100, percentage };
    }),
  };
}

// A new filter/navigation request cancels and supersedes the previous one, even
// if a transport ignores AbortSignal. The shared API additionally guards sessions.
export function createAnalyticsLoader(api) {
  let generation = 0;
  let controller;
  function cancel() { generation++; controller?.abort(); }
  return {
    cancel,
    async load(filters, publish) {
      cancel();
      const current = generation;
      controller = new AbortController();
      publish({ loading: true, error: "", data: null });
      try {
        const response = await api.request(analyticsQuery(filters), { signal: controller.signal });
        if (current === generation) publish({ loading: false, error: "", data: analyticsVisuals(response) });
      } catch (error) {
        if (current === generation) publish({ loading: false, error: error.message, data: null });
      }
    },
  };
}
