/**
 * End-to-end smoke test for every backend FR, against a real MongoDB.
 *
 *   npm run smoke
 *
 * Uses MONGODB_URI from .env but a separate database (waypoint_smoketest)
 * that is dropped at the end, so your real data is never touched.
 * Outgoing emails are intercepted (nothing is actually sent).
 */
import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { UserFactory } from "../src/lib/userFactory.js";
import { checkAndSendDeadlineReminders } from "../src/lib/reminderJob.js";
import User from "../src/models/User.js";
import Application from "../src/models/Application.js";

const TEST_DB = "waypoint_smoketest";
process.env.JWT_SECRET ||= "smoke-test-secret";
process.env.EMAIL_SERVICE_API_KEY = "smoke-test-key"; // enables sending; fetch below intercepts it

// --- intercept outgoing email ---
const sentEmails = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes("api.sendgrid.com")) {
    const body = JSON.parse(opts.body);
    sentEmails.push({ to: body.personalizations[0].to[0].email, subject: body.subject });
    return new Response(null, { status: 202 });
  }
  return realFetch(url, opts);
};

// --- tiny test harness ---
let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}

let base;
async function api(method, path, { token, body } = {}) {
  const res = await realFetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

// --- run ---
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI, { dbName: TEST_DB });
await mongoose.connection.db.dropDatabase();
await Promise.all([User.init(), Application.init()]); // build indexes (unique email)

const server = createApp().listen(0);
base = `http://127.0.0.1:${server.address().port}`;

try {
  section("Robustness");
  let r = await api("GET", "/");
  check("FR-12 public root reachable without auth", r.status === 200, r);
  r = await api("GET", "/api/applications");
  check("Protected route without token → 401", r.status === 401, r);

  section("FR-1 Register");
  r = await api("POST", "/api/auth/register", { body: { name: "", email: "bad", password: "short" } });
  check("Invalid input → 400 with specific messages", r.status === 400 && /Name is required/.test(r.data.error), r);
  r = await api("POST", "/api/auth/register", {
    body: { name: "Alice", email: "Alice@Example.com", password: "Password1", role: "applicant" },
  });
  check("Applicant registers → 201 + token", r.status === 201 && r.data.token, r);
  let alice = r.data.token;
  const aliceId = r.data.user?.id;
  const stored = await User.findById(aliceId);
  check("Password stored as bcrypt hash, not plaintext", stored.passwordHash.startsWith("$2"), stored.passwordHash);
  r = await api("POST", "/api/auth/register", { body: { name: "A2", email: "alice@example.com", password: "Password1" } });
  check("Duplicate email → 409", r.status === 409, r);
  r = await api("POST", "/api/auth/register", { body: { name: "X", email: "x@x.com", password: "Password1", role: "admin" } });
  check("Self-registering as admin → 400", r.status === 400, r);

  section("FR-2 Login / logout / session");
  r = await api("POST", "/api/auth/login", { body: { email: "alice@example.com", password: "wrong" } });
  check("Wrong password → 401", r.status === 401, r);
  r = await api("POST", "/api/auth/login", { body: { email: "alice@example.com", password: "Password1" } });
  check("Correct login → 200 + token", r.status === 200 && r.data.token, r);
  alice = r.data.token;
  r = await api("GET", "/api/auth/me", { token: alice });
  check("GET /me returns the user", r.status === 200 && r.data.email === "alice@example.com", r);
  r = await api("POST", "/api/auth/logout", { token: alice });
  check("Logout → 204", r.status === 204, r);
  r = await api("GET", "/api/auth/me", { token: alice });
  check("Token rejected after logout", r.status === 401, r);
  alice = (await api("POST", "/api/auth/login", { body: { email: "alice@example.com", password: "Password1" } })).data.token;
  await User.updateOne({ _id: aliceId }, { lastActiveAt: new Date(Date.now() - 31 * 60 * 1000) });
  r = await api("GET", "/api/auth/me", { token: alice });
  check("Session expires after 30 min inactivity", r.status === 401 && /inactivity/.test(r.data.error), r);
  alice = (await api("POST", "/api/auth/login", { body: { email: "alice@example.com", password: "Password1" } })).data.token;

  section("FR-3 Create application");
  r = await api("POST", "/api/applications", { token: alice, body: { company: "", position: "" } });
  check("Missing company/role → 400 'Company name is required.'", r.status === 400 && /Company name is required/.test(r.data.error), r);
  r = await api("POST", "/api/applications", {
    token: alice,
    body: { company: "Optiver", position: "SWE Intern", link: "https://optiver.com/jobs/1", dateApplied: "2026-09-10" },
  });
  check("Create → 201, stage defaults to Applied", r.status === 201 && r.data.stage === "Applied", r);
  check("dateApplied and link saved", r.data.link === "https://optiver.com/jobs/1" && r.data.dateApplied?.startsWith("2026-09-10"), r.data);
  const app1 = r.data._id;
  r = await api("GET", "/api/applications/not-a-real-id", { token: alice });
  check("Malformed id → 400 (server stays up)", r.status === 400, r);
  r = await api("GET", "/api/health");
  check("Server still alive after bad id", r.status === 200, r);

  section("FR-4 Stage transitions");
  r = await api("PATCH", `/api/applications/${app1}/stage`, { token: alice, body: { stage: "Online Assessment" } });
  check("Move to OA → 200", r.status === 200 && r.data.stage === "Online Assessment", r);
  r = await api("PATCH", `/api/applications/${app1}/stage`, { token: alice, body: { stage: "Interview" } });
  check("Each transition is timestamped in stageHistory", r.data.stageHistory.length === 3 && r.data.stageHistory.every((h) => h.changedAt), r.data.stageHistory);
  r = await api("PATCH", `/api/applications/${app1}/stage`, { token: alice, body: { stage: "Interview" } });
  check("Same stage again adds no duplicate history", r.data.stageHistory.length === 3, r.data.stageHistory);
  r = await api("PATCH", `/api/applications/${app1}/stage`, { token: alice, body: { stage: "Hired" } });
  check("Invalid stage → 400", r.status === 400, r);

  section("FR-5 Notes");
  r = await api("POST", `/api/applications/${app1}/notes`, { token: alice, body: { text: "Recruiter: Jane" } });
  check("Add note → 201", r.status === 201 && r.data._id, r);
  const noteId = r.data._id;
  r = await api("PATCH", `/api/applications/${app1}/notes/${noteId}`, { token: alice, body: { text: "Recruiter: Jane D." } });
  check("Edit note → 200", r.status === 200 && r.data.text === "Recruiter: Jane D.", r);
  r = await api("DELETE", `/api/applications/${app1}/notes/${noteId}`, { token: alice });
  check("Delete note → 204", r.status === 204, r);

  section("FR-7 Analytics");
  const mk = async (company, stages, dateApplied) => {
    const a = (await api("POST", "/api/applications", { token: alice, body: { company, position: "SWE", dateApplied } })).data;
    for (const stage of stages) await api("PATCH", `/api/applications/${a._id}/stage`, { token: alice, body: { stage } });
    return a._id;
  };
  await mk("A-Applied", [], "2026-09-12");
  await mk("B-OA", ["Online Assessment"], "2026-09-15");
  await mk("C-Rejected-after-OA", ["Online Assessment", "Rejected"], "2026-09-20");
  await mk("D-Offer-skip-OA", ["Interview", "Offer"], "2026-10-01");
  // Totals: 5 apps (Optiver at Interview + 4 above)
  r = await api("GET", "/api/analytics", { token: alice });
  const f = Object.fromEntries(r.data.funnel.map((x) => [x.stage, x.count]));
  check("Funnel counts apps that *reached* each stage", f.Applied === 5 && f["Online Assessment"] === 4 && f.Interview === 2 && f.Offer === 1, f);
  check("Applied→OA conversion = 0.8", r.data.conversions[0].rate === 0.8, r.data.conversions);
  check("Current stage counts still reported", r.data.stageCounts.Rejected === 1 && r.data.stageCounts.Interview === 1, r.data.stageCounts);
  r = await api("GET", "/api/analytics?from=2026-09-14&to=2026-09-30", { token: alice });
  check("Time-range filter (FR-7) limits to dateApplied in range", r.data.total === 2, r.data);
  r = await api("GET", "/api/analytics?from=nope", { token: alice });
  check("Bad date → 400", r.status === 400, r);

  section("FR-8 / FR-9 Mentor invite + accept");
  r = await api("POST", "/api/mentors/invite", { token: alice, body: { mentorEmail: "mentor@example.com" } });
  check("Invite before mentor has an account → 201 (pending)", r.status === 201 && r.data.status === "pending" && r.data.mentor === null, r);
  check("Invite email sent", sentEmails.some((e) => e.to === "mentor@example.com"), sentEmails);
  r = await api("POST", "/api/auth/register", {
    body: { name: "Mona Mentor", email: "mentor@example.com", password: "Password1", role: "mentor" },
  });
  const mentor = r.data.token;
  const mentorId = r.data.user.id;
  r = await api("GET", "/api/mentors/invitations", { token: mentor });
  check("Mentor sees invitation after signing up", r.status === 200 && r.data.length === 1, r);
  const linkId = r.data[0]?._id;
  r = await api("GET", `/api/mentors/applicants/${aliceId}/pipeline`, { token: mentor });
  check("Pipeline blocked before accepting → 403", r.status === 403, r);
  r = await api("POST", `/api/mentors/invitations/${linkId}/accept`, { token: mentor });
  check("Accept → 200 accepted", r.status === 200 && r.data.status === "accepted", r);
  r = await api("GET", `/api/mentors/applicants/${aliceId}/pipeline`, { token: mentor });
  check("Read-only pipeline with summary", r.status === 200 && r.data.applications.length === 5 && r.data.summary.total === 5, r.data?.summary);
  r = await api("GET", "/api/mentors/roster", { token: mentor });
  check("Roster lists the applicant", r.data.length === 1 && r.data[0].applicant.email === "alice@example.com", r);
  r = await api("PATCH", `/api/applications/${app1}/stage`, { token: mentor, body: { stage: "Offer" } });
  check("FR-9 Mentor cannot move a stage → 403", r.status === 403, r);
  r = await api("POST", "/api/applications", { token: mentor, body: { company: "X", position: "Y" } });
  check("FR-11 Mentor cannot create applications → 403", r.status === 403, r);
  r = await api("POST", "/api/mentors/invite", { token: alice, body: { mentorEmail: "mentor@example.com" } });
  check("Re-inviting an accepted mentor → 409", r.status === 409, r);

  section("FR-10 Feedback");
  r = await api("POST", `/api/applications/${app1}/feedback`, { token: mentor, body: { comment: "Prep system design." } });
  check("Mentor leaves feedback → 201", r.status === 201, r);
  r = await api("GET", `/api/applications/${app1}/feedback`, { token: alice });
  check("Applicant sees feedback with mentor name", r.status === 200 && r.data[0]?.mentorId?.name === "Mona Mentor", r);
  r = await api("POST", `/api/applications/${app1}/feedback`, { token: alice, body: { comment: "self" } });
  check("Applicant cannot post mentor feedback → 403", r.status === 403, r);

  section("Revoke (UC-4/UC-5 alternate flows)");
  r = await api("DELETE", `/api/mentors/links/${linkId}`, { token: alice });
  check("Applicant revokes → revoked", r.status === 200 && r.data.status === "revoked", r);
  r = await api("POST", `/api/applications/${app1}/feedback`, { token: mentor, body: { comment: "late" } });
  check("Revoked mentor's feedback blocked → 403", r.status === 403, r);
  r = await api("POST", "/api/mentors/invite", { token: alice, body: { mentorEmail: "mentor@example.com" } });
  check("Re-invite after revoke reopens as pending", r.status === 200 && r.data.status === "pending", r);

  section("FR-6 Deadline reminders");
  const soon = new Date(Date.now() + 3 * 60 * 60 * 1000);
  r = await api("POST", "/api/applications", { token: alice, body: { company: "Jane Street", position: "SWE", deadline: soon.toISOString() } });
  const dueApp = r.data._id;
  await api("POST", "/api/applications", { token: alice, body: { company: "NoReminder", position: "SWE", deadline: soon.toISOString(), reminderEnabled: false } });
  sentEmails.length = 0;
  await checkAndSendDeadlineReminders();
  check("Reminder sent for opted-in app only", sentEmails.length === 1 && /Jane Street/.test(sentEmails[0].subject), sentEmails);
  await checkAndSendDeadlineReminders();
  check("Second hourly run does not resend", sentEmails.length === 1, sentEmails);
  await api("PATCH", `/api/applications/${dueApp}`, { token: alice, body: { deadline: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString() } });
  await checkAndSendDeadlineReminders();
  check("Changed deadline → reminded again", sentEmails.length === 2, sentEmails);
  await api("PATCH", "/api/settings", { token: alice, body: { notificationPreferences: { deadlineReminders: false } } });
  await api("PATCH", `/api/applications/${dueApp}`, { token: alice, body: { deadline: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() } });
  await checkAndSendDeadlineReminders();
  check("User-level opt-out honored", sentEmails.length === 2, sentEmails);

  section("FR-13 / FR-14 Admin");
  await UserFactory.create("admin", { name: "Root", email: "admin@example.com", password: "Password1" });
  const admin = (await api("POST", "/api/auth/login", { body: { email: "admin@example.com", password: "Password1" } })).data.token;
  r = await api("GET", "/api/admin/users", { token: alice });
  check("Non-admin → 403", r.status === 403, r);
  r = await api("GET", "/api/admin/users", { token: admin });
  check("Admin lists users without password hashes", r.status === 200 && r.data.length === 3 && r.data.every((u) => !u.passwordHash), r);
  r = await api("PATCH", `/api/admin/users/${mentorId}/disable`, { token: admin });
  check("Disable mentor → disabled", r.status === 200 && r.data.user.disabled === true, r);
  r = await api("GET", "/api/mentors/invitations", { token: mentor });
  check("Disabled user's existing token stops working immediately", r.status === 403, r);
  r = await api("POST", "/api/auth/login", { body: { email: "mentor@example.com", password: "Password1" } });
  check("Disabled user cannot log in", r.status === 403, r);
  r = await api("PATCH", `/api/admin/users/${mentorId}/disable`, { token: admin });
  check("Disable again → alreadyInState", r.data.alreadyInState === true, r);
  r = await api("PATCH", `/api/admin/users/${mentorId}/enable`, { token: admin });
  check("Re-enable → active", r.data.user.disabled === false, r);
  r = await api("GET", "/api/admin/metrics", { token: admin });
  check("Metrics", r.status === 200 && r.data.totalUsers === 3 && r.data.invitationsSent === 1 && r.data.disabledAccounts === 0, r.data);
  r = await api("GET", "/api/applications", { token: admin });
  check("FR-11 Admin cannot read application data → 403", r.status === 403, r);
} catch (err) {
  failed++;
  console.error("\nTest run crashed:", err);
} finally {
  server.close();
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
