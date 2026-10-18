import test from "node:test";
import assert from "node:assert/strict";
import { analyticsQuery, analyticsVisuals, createAnalyticsLoader } from "./analyticsApi.js";
import { createApi, ApiError } from "./api.js";

function response(counts = [10, 5, 2, 1], rates = [0.5, 0.4, 0.5]) {
  const stages = ["Applied", "Online Assessment", "Interview", "Offer"];
  return { total: counts[0], stageCounts: { Applied: 2, "Online Assessment": 1, Interview: 1, Offer: 1, Rejected: 5 },
    funnel: stages.map((stage, index) => ({ stage, count: counts[index] })),
    conversions: stages.slice(1).map((to, index) => ({ from: stages[index], to, rate: rates[index] })) };
}

test("query sends optional date-only from/to via URLSearchParams", () => {
  assert.equal(analyticsQuery(), "/analytics");
  assert.equal(analyticsQuery({ from: "2026-09-01" }), "/analytics?from=2026-09-01");
  assert.equal(analyticsQuery({ to: "2026-10-17" }), "/analytics?to=2026-10-17");
  assert.equal(analyticsQuery({ from: "2026-09-01", to: "2026-10-17" }), "/analytics?from=2026-09-01&to=2026-10-17");
});

test("mapping uses current cards, API funnel and supplied rates, with a common height maximum", () => {
  const payload = response([10, 5, 2, 1], [0.4321, 0.3333, 0]);
  payload.funnel.reverse(); payload.conversions.reverse();
  const visual = analyticsVisuals(payload);
  assert.deepEqual(visual.stages.map((stage) => stage.currentCount), [2, 1, 1, 1]);
  assert.deepEqual(visual.stages.map((stage) => stage.count), [10, 5, 2, 1]);
  assert.deepEqual(visual.stages.map((stage) => stage.percentage), ["—", "43%", "33%", "0%"]);
  assert.deepEqual(visual.stages.map((stage) => stage.height), [100, 50, 20, 10]);
  assert.equal(visual.rejected, 5); assert.equal(visual.total, 10);
});

test("zero preceding count gives dash; zero rate with nonzero denominator gives zero percent", () => {
  assert.deepEqual(analyticsVisuals(response([3, 0, 0, 0], [0, 0, 0])).stages.map((stage) => stage.percentage), ["—", "0%", "—", "—"]);
  const empty = analyticsVisuals({ ...response([0, 0, 0, 0], [0, 0, 0]), stageCounts: { Applied: 0, "Online Assessment": 0, Interview: 0, Offer: 0, Rejected: 0 } });
  assert.equal(empty.total, 0);
  assert.ok(empty.stages.every((stage) => stage.height === 0));
  assert.throws(() => analyticsVisuals({}), /invalid analytics/);
});

test("loader fetches each opening/filter change; errors and Retry never use samples", async () => {
  const calls = []; let fail = true;
  const loader = createAnalyticsLoader({ request: async (...args) => { calls.push(args); if (fail) throw new ApiError("from must be on or before to.", 400); return response(); } });
  const states = [];
  await loader.load({ from: "2026-10-17", to: "2026-09-01" }, (state) => states.push(state));
  assert.equal(states.at(-1).data, null); assert.match(states.at(-1).error, /on or before/);
  fail = false;
  await loader.load({}, (state) => states.push(state));
  assert.equal(states.at(-1).data.total, 10);
  loader.cancel();
  await loader.load({}, (state) => states.push(state));
  assert.equal(calls.length, 3); assert.equal(calls[1][0], "/analytics");
});

test("outdated successes and failures are ignored even if fetch ignores cancellation", async () => {
  const pending = [];
  const loader = createAnalyticsLoader({ request: (path, options) => new Promise((resolve, reject) => pending.push({ resolve, reject, options })) });
  const states = [];
  const old = loader.load({}, (state) => states.push(state));
  const recent = loader.load({ from: "2026-10-01" }, (state) => states.push(state));
  assert.equal(pending[0].options.signal.aborted, true);
  pending[1].resolve(response([4, 2, 1, 0])); await recent;
  pending[0].resolve(response()); await old;
  assert.equal(states.at(-1).data.total, 4);
  const abandoned = loader.load({}, (state) => states.push(state));
  loader.cancel(); const length = states.length;
  pending[2].reject(new Error("late failure")); await abandoned;
  assert.equal(states.length, length);
});

test("network failures show errors and expired sessions use shared auth handling", async () => {
  for (const status of [0, 401]) {
    let ended = false;
    const api = createApi({ storage: () => ({ getItem: () => "mock", removeItem() {} }), fetcher: async () => {
      if (!status) throw new Error("offline");
      return new Response(JSON.stringify({ error: "Session expired" }), { status });
    } });
    api.onSessionEnded(() => { ended = true; });
    let last;
    await createAnalyticsLoader(api).load({}, (state) => { last = state; });
    assert.equal(last.data, null); assert.ok(last.error); assert.equal(ended, status === 401);
  }
});

test("session changes discard delayed analytics without displaying previous account data", async () => {
  let resolve;
  const api = createApi({ storage: () => ({ getItem: () => "mock", removeItem() {} }), fetcher: () => new Promise((done) => { resolve = done; }) });
  let state;
  const pending = createAnalyticsLoader(api).load({}, (value) => { state = value; });
  api.clear(); resolve(new Response(JSON.stringify(response()))); await pending;
  assert.equal(state.data, null); assert.match(state.error, /Session changed/);
});
