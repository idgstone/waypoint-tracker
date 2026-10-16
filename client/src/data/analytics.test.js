import test from "node:test";
import assert from "node:assert/strict";
import { calculateFunnel, filterApplications } from "./analytics.js";
import { createSampleApplications } from "../services/previewStorage.js";

test("recorded histories preserve rejected journeys, skipped stages and repeated visits", () => {
  const data = [
    { stage: "rejected", history: [{ stage: "onlineAssessment" }, { stage: "interview" }, { stage: "interview" }] },
    { stage: "offer", history: [{ stage: "interview" }] },
    { stage: "applied", history: [] },
  ];
  const result = calculateFunnel(data);
  assert.deepEqual(result.map((stage) => stage.count), [3, 1, 2, 1]);
  assert.deepEqual(result.map((stage) => stage.percentage), ["—", "33%", "200%", "50%"]);
  assert.equal(result[2].height, 2 / 3 * 100);
});
test("zero denominators and empty cohorts remain readable", () => {
  assert.deepEqual(calculateFunnel([]).map((stage) => stage.percentage), ["—", "—", "—", "—"]);
  const result = calculateFunnel([{ stage: "offer", history: [] }]);
  assert.deepEqual(result.map((stage) => stage.count), [1, 0, 0, 1]);
  assert.equal(result[3].percentage, "—");
});
test("calendar cohorts include boundary dates, exclude older and future dates", () => {
  const data = ["2026-07-17", "2026-07-18", "2026-09-15", "2026-09-16", "2026-10-15", "2026-10-16"].map((appliedDate) => ({ appliedDate }));
  assert.deepEqual(filterApplications(data, "30", "2026-10-15").map((a) => a.appliedDate), ["2026-09-16", "2026-10-15"]);
  assert.deepEqual(filterApplications(data, "90", "2026-10-15").map((a) => a.appliedDate), ["2026-07-18", "2026-09-15", "2026-09-16", "2026-10-15"]);
  assert.equal(filterApplications(data, "all").length, 6);
});
test("samples use their incomplete histories and shared state updates change totals", () => {
  const samples = createSampleApplications();
  assert.deepEqual(calculateFunnel(samples).map((s) => s.count), [7, 2, 1, 1]);
  const updated = samples.map((a, i) => i === 0 ? { ...a, stage: "interview", history: [...a.history, { stage: "interview" }] } : a);
  assert.deepEqual(calculateFunnel(updated).map((s) => s.count), [7, 2, 2, 1]);
});
