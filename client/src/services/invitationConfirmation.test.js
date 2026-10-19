import test from "node:test";
import assert from "node:assert/strict";
import { invitationConfirmation } from "./invitationConfirmation.js";

test("API emailed wording requires explicit emailSent true", () => {
  const invitation = { mentorEmail: "mentor@example.com" };
  assert.equal(invitationConfirmation({ invitation: { ...invitation, emailSent: true } }).heading, "Invitation sent!");
  for (const emailSent of [false, undefined, "true"]) {
    const result = invitationConfirmation({ invitation: { ...invitation, emailSent } });
    assert.equal(result.heading, "Invitation created");
    assert.match(result.message, /email was not sent/);
  }
});
test("preview success screen uses submitted email and requires development plus preview marker", () => {
  const response = { preview: true, invitation: { mentorEmail: "fictional@example.com" } };
  const result = invitationConfirmation(response, true);
  assert.equal(result.preview, true);
  assert.equal(result.heading, "Invitation sent!");
  assert.match(result.message, /We emailed fictional@example.com/);
  assert.equal(invitationConfirmation(response, false).heading, "Invitation created");
});
test("failed or missing responses never produce a confirmation", () => {
  assert.equal(invitationConfirmation({ error: "Failed", invitation: { mentorEmail: "mentor@example.com", emailSent: true } }), null);
  assert.equal(invitationConfirmation(null), null);
  assert.equal(invitationConfirmation({}), null);
});
