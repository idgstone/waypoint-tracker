# Account deletion integration (FR-15)

## Confirmed contract and policy

Backend PR #4 is merged into main. The source of truth is
server/API_CONTRACT.md, Account deletion, and the auth/admin route implementations.

- Self: DELETE /api/auth/me with JSON { password: currentPassword }.
- Admin: DELETE /api/admin/users/:id with JSON { password: actingAdminPassword }.
  The target must already be disabled. The UI never offers self-deletion through
  this route. The backend also enforces self-delete and last-admin protections.
- Both require Bearer authentication and HTTP 200 with { deleted: true, id }.
  The frontend verifies the exact target ID; 204, other success statuses, missing
  fields, or mismatched IDs are not accepted as confirmed deletion.
- Applicant removal includes the account, all owned applications (notes/history),
  all feedback on those applications, and every mentor link they created.
- Mentor removal includes the account, all links to them (any status), and all
  feedback they authored. Applicants retain their applications.
- Admin removal deletes the account only. Self-deletion by an Admin is supported
  by the API only if another Admin exists; this frontend exposes self-deletion in
  Applicant/Mentor settings, and disabled-target deletion in Admin management.

## Request and UI flow

createAccountDeletionApi uses the existing api.request transport, exact DELETE
paths, JSON password body, and expectedStatus: 200. Passwords are never placed in
URLs, storage, screenshots, or logs. No deletion request is automatically retried.

createDeletionAttempt is kept stable across rerenders and dialog reopenings. It
locks duplicate submissions and refuses another request after an ambiguous result
or a confirmed success. A network error, unreadable/incorrect response, or uncertain
server failure retains local account data and requires checking the account state.

The shared ApiError preserves the documented code. A 400 invalid-password is an
inline password error; the field is cleared and may be re-entered. A 403 last-admin,
not-disabled, or self-delete displays a refusal without clearing the Admin session.
Protected 401 and the existing disabled-account 403 contract still end the session.
A 404 is not treated as successful deletion.

Self-deletion success calls the existing session discard/clear, unmounts the
account-keyed dashboard, and replaces the URL with Welcome. A brief announcement
confirms deletion. It never calls logout on the now-deleted account.

Admin success removes only the verified target row and reloads usage statistics.
The acting Admin session remains active. Statistics failures retain the deletion
confirmation and expose the existing Retry statistics control; they do not repeat
DELETE. Server-side authorization remains authoritative.

Dialogs retain visible identity, approved consequences, current-password labels,
Cancel/Escape clearing, focus containment/restoration, pending/error states, and
password-only validation messages. The Admin dialog explicitly asks for the acting
administrator's current password. Applicant/Mentor previews remain isolated and
have no deletion API integration.

## Verification

128 frontend tests pass, including exact paths/methods/password bodies and Bearer
headers; refusal codes without logout; real authentication expiry/disabled errors;
wrong-role/self/active-target blocking; confirmed self cleanup without logout;
Admin row/statistics updates while retaining its session; malformed or ambiguous
responses; no automatic retry; and stale responses after a session change.
The production build and whitespace checks pass. These are mocked checks; no real
accounts, applications, links, feedback, or email records were mutated.
Previous fictional browser checks exercised Cancel/Escape, focus, password clearing,
and nested Mentor dialogs. The new backend integration has not been exercised with
live disposable accounts during this task.

## Disposable-account manual checks (human only)

1. Use only consenting disposable accounts and records. Never use a real person's
   account or shared project data. Create any fixtures manually; this task does not.
2. Applicant: Settings > Delete account. Check identity and consequences; try Cancel
   and Escape, then reopen to confirm an empty password field and restored focus.
3. Enter an incorrect password. Expect inline Incorrect password, cleared field,
   no success, and a still-active session. Enter the disposable account's current
   password manually to confirm deletion. Expect Welcome, a brief confirmation,
   no logout request, and no authenticated dashboard after refresh or Back.
4. With the backend teammate, verify only that disposable Applicant's owned
   applications/notes/history, feedback on them, and created mentor links are gone.
5. Mentor: repeat through the avatar panel using a disposable Mentor. Verify its
   authored feedback and links are removed; linked Applicants keep applications.
6. Admin: use an authorized consenting test Admin. Active targets and your own row
   offer no Delete action. Disable a disposable target manually if appropriate,
   open Delete, and verify the target identity and acting Admin password label.
7. Cancel/Escape first. Then test incorrect acting Admin password: Admin remains
   signed in and the row/counts remain unchanged. Confirm manually only for the
   disposable target; expect its row removed and statistics refreshed, Admin active.
8. Refusals last-admin/not-disabled/self-delete are covered by mocks. Do not remove
   or alter real Admins to manufacture them. Coordinate any live policy tests with
   Dung in a dedicated disposable environment.
9. For a lost response or network failure, check actual account state with Dung
   before any further attempt. The UI does not automatically retry destructive calls.

## Remaining limitations / review notes

- Live retention/cascades, email/reminder effects, authorization races, and session
  cleanup against actual deletion responses still need the human checks above.
- Atlas implementation uses a transaction. The backend implementation has a
  non-transactional standalone fallback; failures there may leave dependent data
  partially removed. The frontend treats failures as uncertain and does not retry.
- Backend last-admin concurrency guarantees remain the backend team's concern.
- Local-only review files are client/account-deletion-review.html and
  client/account-deletion-review.jsx. They are untracked/ignored, retained locally,
  and excluded from the final PR diff. They are not real authentication or API tests.
