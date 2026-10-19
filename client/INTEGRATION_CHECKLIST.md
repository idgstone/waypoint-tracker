# Waypoint real-account integration checklist

Use this checklist manually with your own consenting test accounts. These
authenticated browser scenarios have **not** been signed off by the automated
mock tests or guest/preview browser checks.

## Before starting

- Use the configured running backend and frontend. Open `http://localhost:5173/`.
- Use separate browser profiles/private windows for Applicant, Mentor, and Admin.
- Enter credentials locally. Do not paste passwords, tokens, or `.env` contents
  into chat or screenshots. Report the result and any visible error message.
- Use only your own disposable application data. Keep reminder preferences off
  unless you intend to test real email delivery.
- No smoke test is needed. None of the actions below is performed automatically.

## 1. Authentication and account separation

- [ ] Open `/login` directly; sign in with an existing Applicant test account.
- [ ] Refresh: `/api/auth/me` restores the correct name and role.
- [ ] Log out; verify the account screen disappears and refresh stays signed out.
- [ ] Sign in with a different test account: the previous user's records never
  appear, even while requests are loading. Sample companies never substitute for
  an empty/error real account list.
- [ ] If testing Sign Up, use your own new email manually. Only Applicant and
  Mentor are offered; password validation matches the backend.
- [ ] With the backend unavailable or browser Network set offline manually,
  failed login/restoration offers an error and Retry rather than fake success.
- [ ] Leave a session idle for the backend-configured inactivity window without
  protected requests. Returning to the tab or making a request sends an expired
  session to Login. Expiry is enforced by the backend; there is no keepalive poll.

## 2. Applicant Board and Detail

- [ ] On a genuinely empty account, confirm the useful empty state and no samples.
- [ ] Manually add a disposable application with reminders off and one note.
  Confirm one database ID/card, then refresh and confirm it remains.
- [ ] Use Interview's `+ New`: one application is created, then its stage is
  changed. Check the server's Applied/Interview history entries.
- [ ] Open details; add and edit individual notes. Check their server timestamps
  after refreshing. Do not expect one combined notes string.
- [ ] Change stage through the selector and through drag-and-drop. Counts follow
  confirmed changes. Dropping in the same column adds no history entry.
- [ ] Drop into Offer/Rejected: Cancel/Escape changes nothing; Save requires an
  explicit outcome. Card order is not persisted.
- [ ] Check three-dot actions and Cancel in the delete dialog. If testing actual
  deletion, delete only the disposable record you created, by your own choice.
- [ ] During an offline/failed save, verify the draft and original card stage
  remain. An uncertain create response requires checking the Board before retry.

## 3. Applicant Analytics

- [ ] Compare `/api/analytics` with the display: cards = `stageCounts`, bars =
  `funnel`, percentages = `conversions`, empty state = `total`.
- [ ] Rejected remains separate from Offer; skipped earlier funnel stages are
  inferred according to backend history semantics.
- [ ] Check All time, Last 30/90 days, From-only, To-only, and a custom date range.
  Dates filter the applied-date cohort; To includes the entire UTC day.
- [ ] Reverse From/To and verify the backend's 400 error is visible.
- [ ] After changing your Board, return to Analytics and confirm a fresh request.
- [ ] Rapidly change filters; an older response must not replace the latest one.

## 4. Applicant Settings

- [ ] Email and role are read-only; unchanged Save is disabled.
- [ ] Blank name cannot save. Type a name draft, navigate away/back, and confirm
  it remains unsaved. A refresh of saved settings must not replace edited fields.
- [ ] Manually save a test name and chosen preference booleans. Success occurs
  only after PATCH confirms, the avatar changes, and refresh retains saved values.
- [ ] Confirm per-application `reminderEnabled` choices remain unchanged.
- [ ] On a recoverable failed save, the draft remains and no success is shown.

## 5. Applicant invitation and Mentor acceptance/feedback

This section may send a real invitation email. Perform it only yourself with a
consenting test recipient; skip it if email/link mutations are not desired yet.

- [ ] Applicant manually invites the exact Mentor test email. `emailSent: true`
  permits “We emailed…”; false must say the invitation exists but no email was sent.
- [ ] The pending invitation is not an accepted mentor connection.
- [ ] Mentor opens `/login` (or manually registers as Mentor at `/signup` using
  that email). The inbox shows only invitations for the authenticated account.
- [ ] Wrong-account/nonpending/revoked invitations show errors, not local acceptance.
- [ ] Mentor manually confirms Accept. Only after the server confirms does the
  refreshed roster include the student. Decline is also server-confirmed.
- [ ] Select the student and an application. Overview counts use current stages,
  with Offer/Rejected combined; application information is read-only.
- [ ] Blank feedback is rejected. Send one comment manually; it appears once with
  the server-assigned mentor identity/timestamp and is visible to the Applicant.
- [ ] On a failed feedback POST, text remains. If POST succeeds but history refresh
  fails, retry reading history instead of sending the comment again.
- [ ] If you have multiple consenting students/applications, switch rapidly:
  previous data clears while loading and cannot appear under the new selection.
- [ ] Optional: Applicant manually revokes access. The next Mentor pipeline or
  feedback request must reject access and clear the inaccessible view.

## 6. Authorized Administrator

- [ ] Sign in with an existing backend-provisioned Admin test account. There is
  no public Admin signup or frontend role-promotion control.
- [ ] Compare real users and `/api/admin/metrics` with the display.
- [ ] Search name/email using different casing; no results has an empty state.
  The current endpoint is unpaginated, so search is local over the fetched array.
- [ ] Self-disable is unavailable. Open another consenting test user's status
  dialog, verify the name/email, and Cancel without changing status.
- [ ] Only if desired, manually Disable/Re-enable that test user. Confirm one
  request, server-confirmed status, refreshed statistics, and effect on that
  user's next protected request. The assistant does not perform these actions.
- [ ] Failed status actions retain prior displayed data and expose the error.
- [ ] System Health displays documented usage counts only, with no claim of
  uptime/database monitoring. Invitations is all-time link count, not weekly mail.

Backend teammates provision an authorized new test admin using the existing
`server/` command `npm run create-admin -- "Test Admin" "<approved-new-email>" "<local-password>"`.
It refuses existing emails and does not promote an existing account. Run it only
with the team's approval; it was not run during this review.

## Record the result

For each unchecked item, report **pass / fail / skipped**, role, visible error,
and the expected versus actual behavior. Screenshots should exclude credentials
and Authorization headers. Do not mark preview or mocked checks as real-account
verification.
