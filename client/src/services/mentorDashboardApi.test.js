import test from "node:test";
import assert from "node:assert/strict";
import { createMentorDashboardApi, createMentorResource, createFeedbackSubmission, feedbackRecords, invitationAccountError, mentorOverviewCounts, pipelineRecord } from "./mentorDashboardApi.js";
import { createApi, ApiError } from "./api.js";

const mentor = { id: "mentor-id", email: "mentor@example.com", role: "mentor", name: "Mentor" };
const student = { _id: "student-id", name: "Student", email: "student@example.com" };
const invitation = { _id: "link-id", applicant: student, mentor: mentor.id, mentorEmail: mentor.email, status: "pending" };
const application = { _id: "application-id", company: "Example", position: "Intern", stage: "Interview", notes: [], stageHistory: [] };
const pipeline = { applicant: student, summary: { total: 12, stageCounts: { Applied: 4, "Online Assessment": 3, Interview: 2, Offer: 1, Rejected: 2 } }, applications: [application] };
const feedback = { _id: "feedback-id", mentorId: mentor.id, applicationId: application._id, comment: "Prepare", createdAt: "2026-10-17T12:00:00Z" };
function mock(results) {
  const calls = [];
  const service = createMentorDashboardApi({ request: async (...args) => {
    calls.push(args); const result = results.shift();
    if (result instanceof Error) throw result;
    return structuredClone(result);
  } }, mentor);
  return { service, calls };
}

test("roster/inbox load actual links, including missing accounts; empty lists stay empty", async () => {
  const { service, calls } = mock([[{ ...invitation, status: "accepted" }, { ...invitation, _id: "missing", status: "accepted", applicant: null }], [invitation], [], []]);
  const roster = await service.roster();
  assert.equal(roster[0].applicant._id, student._id); assert.equal(roster[1].applicant, null);
  assert.equal((await service.invitations())[0].status, "pending");
  assert.deepEqual(await service.roster(), []); assert.deepEqual(await service.invitations(), []);
  assert.deepEqual(calls.map(([path]) => path), ["/mentors/roster", "/mentors/invitations", "/mentors/roster", "/mentors/invitations"]);
});

test("selected pipeline validates student identity and uses supplied current counts, combining outcomes", async () => {
  const { service, calls } = mock([pipeline]);
  const result = await service.pipeline(student._id);
  assert.equal(calls[0][0], "/mentors/applicants/student-id/pipeline");
  assert.deepEqual(mentorOverviewCounts(result.summary), [4, 3, 2, 3]);
  assert.equal(result.applications.length, 1); // Counts are not inferred from the visible records.
  assert.throws(() => pipelineRecord(pipeline, "another-student"), /different student's pipeline/);
  assert.equal(pipelineRecord({ ...pipeline, applications: [] }, student._id).applications.length, 0);
});

test("feedback selection maps server authors and rejects another application's feedback", async () => {
  const { service, calls } = mock([[{ ...feedback, mentorId: { _id: "other-mentor", name: "Other Mentor" } }], []]);
  const result = await service.feedback(application._id);
  assert.equal(calls[0][0], "/applications/application-id/feedback");
  assert.equal(result[0].author, "Other Mentor");
  assert.deepEqual(await service.feedback(application._id), []);
  assert.throws(() => feedbackRecords([feedback], "other-app"), /different application/);
});

test("feedback POST sends only trimmed comment; ownership and ID come from backend", async () => {
  const { service, calls } = mock([feedback]);
  await assert.rejects(service.sendFeedback(application._id, " \n "), /Enter feedback/);
  assert.equal(calls.length, 0);
  const result = await service.sendFeedback(application._id, " Prepare ");
  assert.deepEqual(calls[0], ["/applications/application-id/feedback", { method: "POST", body: { comment: "Prepare" } }]);
  assert.equal(result._id, feedback._id);
  const invalid = mock([{ ...feedback, mentorId: "wrong-owner" }]);
  await assert.rejects(invalid.service.sendFeedback(application._id, "Prepare"), /could not be confirmed/);
});

test("feedback double-submit guard sends once, refreshes only after confirmed POST, and preserves failure context", async () => {
  let resolve; let posts = 0; let reads = 0;
  const send = createFeedbackSubmission({ sendFeedback: () => { posts++; return new Promise((done) => { resolve = done; }); } }, application._id);
  const first = send("Prepare", async () => { reads++; return { error: "History offline" }; });
  await assert.rejects(send("Prepare", async () => {}), { status: 409 });
  assert.equal(posts, 1); assert.equal(reads, 0);
  resolve(feedback); const result = await first;
  assert.equal(reads, 1); assert.equal(result.keepDraft, true); assert.match(result.notice, /Feedback saved/);
  const failed = createFeedbackSubmission({ sendFeedback: async () => { throw new ApiError("Rejected", 400); } }, application._id);
  await assert.rejects(failed("Draft text", async () => { reads++; }), /Rejected/);
  assert.equal(reads, 1);
});

test("lost feedback response is not retried automatically; revoked access errors propagate", async () => {
  const { service, calls } = mock([new ApiError("Offline"), new ApiError("Access revoked", 403)]);
  await assert.rejects(service.sendFeedback(application._id, "Draft"), (error) => error.unconfirmedSubmission && /draft is retained/.test(error.message));
  await assert.rejects(service.pipeline(student._id), { status: 403 });
  assert.equal(calls.length, 2);
});

test("new selection clears old data and ignores outdated successes/errors, including cancellation", async () => {
  const pending = [];
  const loader = createMentorResource((key, signal) => new Promise((resolve, reject) => pending.push({ key, signal, resolve, reject })));
  const states = [];
  const first = loader.run("student-one", (state) => states.push(state));
  const second = loader.run("student-two", (state) => states.push(state));
  assert.equal(states.at(-1).key, "student-two"); assert.equal(states.at(-1).data, null);
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ name: "Second" }); await second;
  pending[0].resolve({ name: "First" }); await first;
  assert.equal(states.at(-1).data.name, "Second");
  const third = loader.run("new-app", (state) => states.push(state)); loader.cancel();
  const length = states.length; pending[2].reject(new Error("old failure")); await third;
  assert.equal(states.length, length);
});

test("resource errors clear data and Retry can recover without preview fallbacks", async () => {
  let fail = true; let state;
  const loader = createMentorResource(async () => { if (fail) throw new ApiError("Access revoked", 403); return []; });
  await loader.run("student", (value) => { state = value; });
  assert.equal(state.data, null); assert.equal(state.status, 403);
  fail = false; await loader.run("student", (value) => { state = value; });
  assert.deepEqual(state.data, []);
});

test("accept/decline use exact documented POST endpoints, require invited mentor and confirmed server status", async () => {
  const { service, calls } = mock([{ ...invitation, status: "accepted" }, { ...invitation, status: "revoked" }]);
  assert.equal((await service.respond(invitation, "accept")).status, "accepted");
  assert.equal((await service.respond(invitation, "decline")).status, "revoked");
  assert.deepEqual(calls, [["/mentors/invitations/link-id/accept", { method: "POST" }], ["/mentors/invitations/link-id/decline", { method: "POST" }]]);
  assert.match(invitationAccountError(invitation, { ...mentor, role: "applicant" }), /Mentor account/);
  assert.match(invitationAccountError(invitation, { ...mentor, email: "wrong@example.com" }), /another account/);
  assert.match(invitationAccountError({ ...invitation, applicant: null }, mentor), /unavailable/);
  const blocked = mock([]);
  await assert.rejects(blocked.service.respond({ ...invitation, mentor: "other-id" }, "accept"), { status: 403 });
  assert.equal(blocked.calls.length, 0);
  const unconfirmed = mock([invitation]);
  await assert.rejects(unconfirmed.service.respond(invitation, "accept"), /could not be confirmed/);
  assert.equal(invitation.status, "pending");
});

test("wrong-account/nonpending invitation errors stay errors; session expiration and account changes use shared API", async () => {
  const failed = mock([new ApiError("Pending invitation not found.", 404)]);
  await assert.rejects(failed.service.respond(invitation, "accept"), /invited email/);
  let ended = false;
  const api = createApi({ storage: () => ({ getItem: () => "mock", removeItem() {} }), fetcher: async () => new Response(JSON.stringify({ error: "Session expired" }), { status: 401 }) });
  api.onSessionEnded(() => { ended = true; });
  await assert.rejects(createMentorDashboardApi(api, mentor).roster(), { status: 401 });
  assert.equal(ended, true);
  let resolve;
  const staleApi = createApi({ storage: () => ({ getItem: () => "mock", removeItem() {} }), fetcher: () => new Promise((done) => { resolve = done; }) });
  const pending = createMentorDashboardApi(staleApi, mentor).pipeline(student._id);
  staleApi.clear(); resolve(new Response(JSON.stringify(pipeline)));
  await assert.rejects(pending, { status: 499 });
});
