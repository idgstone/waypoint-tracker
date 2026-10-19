import test from "node:test";
import assert from "node:assert/strict";
import { createMentorsApi, createMentorLinksLoader, mapMentorLink } from "./mentorsApi.js";
import { invitationConfirmation } from "./invitationConfirmation.js";
import { createApi, ApiError } from "./api.js";

const link = { _id: "link-id", mentorEmail: "mentor@example.com", status: "pending", mentor: null };
function mock(results) {
  const calls = [];
  const service = createMentorsApi({ request: async (...args) => {
    calls.push(args); const result = results.shift();
    if (result instanceof Error) throw result;
    return result;
  } });
  return { service, calls };
}

test("real links map pending, accepted, unavailable mentors and exclude revoked", async () => {
  const accepted = { ...link, _id: "accepted", status: "accepted", mentor: { _id: "mentor-id", name: "Mentor Name", email: link.mentorEmail } };
  const { service } = mock([[link, accepted, { ...accepted, _id: "unavailable", mentor: null }, { ...link, status: "revoked" }]]);
  const links = await service.list();
  assert.equal(links.length, 3); assert.equal(links[1].mentor.name, "Mentor Name");
  assert.equal(links[2].mentor, null);
  assert.equal(mapMentorLink({ ...link, mentor: "unpopulated-id" }).mentor, null);
  assert.throws(() => mapMentorLink({ ...link, status: "invented" }), /invalid mentor link/);
});

test("invite sends documented normalized body and confirmation uses submitted email and strict delivery boolean", async () => {
  for (const emailSent of [true, false, undefined, "true"]) {
    const { service, calls } = mock([{ ...link, emailSent }]);
    const result = await service.invite(" Mentor@Example.com ", []);
    assert.deepEqual(calls[0], ["/mentors/invite", { method: "POST", body: { mentorEmail: "mentor@example.com" } }]);
    const confirmation = invitationConfirmation(result, true);
    assert.equal(confirmation.preview, false);
    assert.match(confirmation.message, /Mentor@Example.com/);
    assert.equal(confirmation.message.startsWith("We emailed"), emailSent === true);
    if (emailSent !== true) assert.match(confirmation.message, /email was not sent/);
  }
});

test("validation and case-insensitive pending/accepted duplicates prevent network requests", async () => {
  const { service, calls } = mock([]);
  for (const email of ["", "invalid"]) await assert.rejects(service.invite(email, []));
  for (const status of ["pending", "accepted"]) await assert.rejects(service.invite("MENTOR@example.com", [{ ...link, status }]), /already/);
  assert.equal(calls.length, 0);
  const reopened = mock([link]);
  await reopened.service.invite(link.mentorEmail, [{ ...link, status: "revoked" }]);
  assert.equal(reopened.calls.length, 1);
});

test("backend errors and invalid invite responses do not return success or retry automatically", async () => {
  for (const status of [400, 401, 403, 404, 409, 500, 0]) {
    const { service, calls } = mock([new ApiError("Backend error", status)]);
    await assert.rejects(service.invite(link.mentorEmail, []), /Backend error/);
    assert.equal(calls.length, 1);
  }
  const { service } = mock([{ ...link, status: "accepted", emailSent: true }]);
  await assert.rejects(service.invite(link.mentorEmail, []), /could not be confirmed/);
});

test("confirmed invite can refresh links without a second POST; failed refresh remains an error", async () => {
  const { service, calls } = mock([{ ...link, emailSent: false }, new ApiError("Refresh unavailable", 500), [link]]);
  const result = await service.invite(link.mentorEmail, []);
  assert.equal(result.invitation.emailSent, false);
  let state;
  const loader = createMentorLinksLoader(service);
  await loader.load((update) => { state = update; });
  assert.match(state.error, /Refresh unavailable/);
  await loader.load((update) => { state = update; });
  assert.equal(state.links[0]._id, link._id);
  assert.equal(calls.filter(([path]) => path === "/mentors/invite").length, 1);
});

test("pending cancellation and accepted revocation use only documented link DELETE", async () => {
  const { service, calls } = mock([{ ...link, status: "revoked" }]);
  const result = await service.revoke(link._id);
  assert.equal(result.status, "revoked");
  assert.deepEqual(calls[0], ["/mentors/links/link-id", { method: "DELETE" }]);
});

test("superseded loads and unmounted views ignore delayed results", async () => {
  const resolvers = [];
  const loader = createMentorLinksLoader({ list: (signal) => new Promise((resolve) => resolvers.push({ resolve, signal })) });
  const states = [];
  const first = loader.load((update) => states.push(update));
  const second = loader.load((update) => states.push(update));
  assert.equal(resolvers[0].signal.aborted, true);
  resolvers[1].resolve([link]); await second;
  resolvers[0].resolve([]); await first;
  assert.equal(states.at(-1).links.length, 1);
  const third = loader.load((update) => states.push(update)); loader.cancel();
  const length = states.length;
  resolvers[2].resolve([]); await third;
  assert.equal(states.length, length);
});

test("shared protected requests handle expired sessions without creating links", async () => {
  let ended = false;
  const api = createApi({ storage: () => ({ getItem: () => "mock-token", removeItem() {} }), fetcher: async () => new Response(JSON.stringify({ error: "Session expired" }), { status: 401 }) });
  api.onSessionEnded(() => { ended = true; });
  await assert.rejects(createMentorsApi(api).list(), { status: 401 });
  assert.equal(ended, true); assert.equal(api.hasToken(), false);
});
