import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewInvitation, loadPreviewMentors, savePreviewMentors, validateMentorEmail, parsePreviewMentors, PREVIEW_MENTORS_KEY } from "./previewMentors.js";

test("invitation validation rejects empty, malformed and case-insensitive duplicates", () => {
  assert.ok(validateMentorEmail(" ", []));
  assert.ok(validateMentorEmail("bad@", []));
  const result = createPreviewInvitation(" Mentor@Example.com ", []);
  assert.equal(result.links.length, 1);
  assert.equal(result.invitation.mentorEmail, "mentor@example.com");
  assert.equal(result.invitation.status, "pending");
  assert.equal(result.invitation.mentor, null);
  assert.match(createPreviewInvitation("MENTOR@example.com", result.links).error, /pending/);
  assert.match(validateMentorEmail("mentor@example.com", [{ ...result.invitation, status: "accepted" }]), /linked/);
});
test("preview storage round-trips links independently and preserves an empty list", () => {
  const saved = new Map();
  const storage = () => ({ getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) });
  const { links } = createPreviewInvitation("mentor@example.com", []);
  assert.equal(savePreviewMentors(links, true, storage), "");
  assert.equal(saved.size, 1);
  assert.ok(saved.has(PREVIEW_MENTORS_KEY));
  assert.deepEqual(loadPreviewMentors(true, storage).links, links);
  savePreviewMentors([], true, storage);
  assert.deepEqual(loadPreviewMentors(true, storage).links, []);
});
test("malformed data and storage failure do not crash; production never accesses storage", () => {
  const broken = () => { throw new Error("Unavailable"); };
  assert.ok(loadPreviewMentors(true, broken).error);
  assert.ok(savePreviewMentors([], true, broken));
  assert.equal(loadPreviewMentors(false, broken).error, "");
  assert.equal(savePreviewMentors([], false, broken), "");
  assert.ok(loadPreviewMentors(true, () => ({ getItem: () => "{}" })).error);
  const { invitation } = createPreviewInvitation("mentor@example.com", []);
  assert.equal(parsePreviewMentors(JSON.stringify([{ ...invitation, token: "omit", password: "omit" }]))[0].token, undefined);
});
