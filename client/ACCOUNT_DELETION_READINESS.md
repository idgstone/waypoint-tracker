# FR-15 frontend readiness — awaiting agreement

## Evidence inspected

- `server/API_CONTRACT.md` documents FR-1–14. Auth supports register/login/me/logout;
  Settings supports GET/PATCH; Admin supports list/disable/enable/metrics.
- Actual auth, settings, and admin routes contain no permanent account-deletion
  endpoint. Application/note/link deletion does not authorize account deletion.
- README refers to the SRS and Production Plan through an Information Sheet, but
  provides no document contents or link. BACKEND_TASKS.md names
  `Group8_Waypoint_Production_Plan.xlsx`; that file and an SRS were not found in
  the repository, Downloads, Documents, or Desktop filename searches.
- Available `Downloads/Trello_Task_List.md` covers FR-1–14 and contains no FR-15.
  Its task notes are context, not authorization to change backend files or run
  smoke tests. No AGENTS.md was found in the project.

## Current production behavior

Applicant Settings and the Mentor account panel show separated Delete account
sections. Their buttons open the real confirmation component. Admin shows only
"Account deletion is not available yet.";
no target-row deletion action is exposed. Profile save, logout, account status
actions, and previews are unchanged. No password is collected for unavailable
deletion. No deletion URL or HTTP method has been guessed.

`AccountDeletionDialog` is mounted by the settings sections when opened. It shows
the current password field, Cancel, and Permanently delete account. While the API
is unavailable, the final action is disabled and the password field is read-only.
The only availability message is "Account deletion is not available yet." No
retention promises or implementation blockers appear in product copy.
`createDeletionAttempt` accepts injected execution, confirmation validation, and
completion callbacks. These are internal interfaces tested with mocks, not a
proposed server response schema. The caller must supply approved scope text.
Admin eligibility fails closed without an explicitly approved policy and always
denies self-deletion. A disabled-only rule exists only as a hypothetical test
fixture, not an agreed project restriction.

## Callback/request handoff

`DeleteAccountSection` accepts `target` (the saved profile's name/email),
`disabled` (loading or other pending actions), `available` (default false),
`scope` (approved detailed removal wording), and `onDelete(password)`.
Both actual self-service locations supply only the saved profile and disabled
state today. No request adapter is connected and no deletion is simulated.

Before setting `available=true`, provide all three: the approved scope text, a
real request adapter, and confirmed API availability. `deletionReady` rejects
missing/blank scope and missing callbacks even if the flag is accidentally true.

Create a stable `onDelete` with `createDeletionAttempt({ execute, isConfirmed,
onConfirmed })`. `execute(password)` must use the existing `api.request` with the
agreed path/method and password JSON-body field, not a URL parameter. None of those
server contract details is assumed by this code. `isConfirmed(result)` must check
the documented response and affected-account identity; support 204 only if that
is explicitly the agreed success contract. A resolved promise alone is not proof.

For self-deletion, `onConfirmed` clears the existing session via its discard/clear
method and replaces navigation with Welcome, unmounting account-specific state.
For Admin deletion, it removes the validated target row and refreshes statistics
without discarding the acting Admin session. Do not clear state on rejection or
an ambiguous response. Keep the attempt instance stable so pending/uncertain/
completed guards cannot reset on an incidental rerender.

The dialog keeps the password only in component memory and clears it on Cancel,
Escape, completion/failure, and unmount. While a destructive request is pending,
Cancel/Escape clear the field but do not pretend to cancel the sent request or
dismiss its pending result. Recoverable adapter errors stay visible; uncertain
responses disable another submission and never trigger an automatic retry.

### Final handoff verification

119 frontend tests and the production build pass. The finished Applicant and
Mentor controls were checked in a fictional-profile browser harness: real
Delete account buttons open the dialog, final submission stays disabled with
the concise availability message, and no success is simulated. Nested Mentor
Tab containment, Cancel, Escape, and focus restoration were verified. Password
entry is intentionally read-only while no adapter is available. Earlier enabled
mock-dialog tests covered clearing and error paths; these are not live API tests.
The screenshot review harness and all fixtures remain isolated from real auth.

## Decisions needed from the team / Dung

1. Publish FR-15 wording and the approved SRS/Production Plan revision.
2. Define self-deletion roles, disabled-account behavior, and any protection for
   administrator accounts (including the last administrator).
3. Define the exact removal scope: user profile/credentials/sessions, owned
   applications and notes/history, mentor links and invitations, reminder state,
   feedback authored by a departing mentor and feedback on deleted applications.
   Decide delete vs retain/anonymize, including historical email/audit records.
4. Define Admin eligibility: disabled-only or other restrictions, allowed target
   roles, and server-enforced self-deletion prevention.
5. Specify whose password authorizes each operation. The UI is prepared to label
   an acting Admin's password only if the approved contract says so; it is not an
   existing backend rule. Never request the target user's password by assumption.
6. Document exact endpoint, method, body, success response (including any 204),
   invalid-password and forbidden errors, and transaction/partial-failure rules.
   The current API helper treats protected 401 as session expiry: distinguish
   incorrect confirmation password from expired authentication in the contract.
7. Define timeout/ambiguous-result reconciliation and session invalidation so the
   client can check state without automatically repeating a destructive request.

## Future integration after agreement

- Use the existing API helper for the documented request, sending the password
  only in its body. No local/session storage, logs, or URL parameters.
- Add an explicit response validator; empty/unknown JSON is not assumed success.
  Enable controls only after approved scope, eligibility, and adapter are present.
- On verified self-deletion, use existing session discard/clear, unmount the
  account-keyed dashboard state, and replace navigation with Welcome. Do not call
  logout against an already deleted account as a substitute for local cleanup.
- On verified Admin deletion, remove only the returned/validated target and
  reload statistics. Retain the acting Admin session. Never modify rows on error.
- Keep unrelated preview records separate. No real deletion was performed during
  this task. Production integration and actual retention guarantees remain blocked.
