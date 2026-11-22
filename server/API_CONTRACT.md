# Waypoint API Contract

Base URL (dev): `http://localhost:5000`

**Auth:** `POST /api/auth/register` or `/login` return `{ token, user }`
where `user = { id, name, email, role }`. Send
`Authorization: Bearer <token>` on every other request below.

**Sessions (NFR 5.2):** a session ends after 30 minutes with no requests
(`SESSION_INACTIVITY_MINUTES`), on logout, or when an admin disables the
account. Any `401` means "send the user back to Login". A `403` with
"This account has been disabled." means the account was disabled.

**Roles (FR-11):** `applicant` owns applications; `mentor` gets read-only
access to applicants who invited them; `admin` manages accounts only and
cannot read application data. Wrong role → `403`.

## Auth (FR-1, FR-2)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password, role? }` | `role` ∈ `applicant` \| `mentor` (default `applicant`). Password: 8+ chars, 1 letter, 1 number. `409` if the email exists. |
| POST | `/api/auth/login` | `{ email, password }` | `401` wrong credentials, `403` disabled account |
| POST | `/api/auth/logout` | — | `204`. Every token issued before this stops working. |
| GET | `/api/auth/me` | — | `{ id, name, email, role }`; use on page load to restore a session |
| DELETE | `/api/auth/me` | `{ password }` (your own) | FR-15. See **Account deletion** below. |

Admin accounts are created with `npm run create-admin -- "Name" email Password1`.

## Applications (FR-3, FR-4) — role: applicant

Application shape:

```json
{
  "_id": "…", "owner": "…",
  "company": "Optiver", "position": "SWE Intern",
  "link": "https://…", "dateApplied": "2026-09-10T00:00:00.000Z",
  "stage": "Interview", "deadline": "2026-10-20T17:00:00.000Z" | null,
  "reminderEnabled": true,
  "notes": [{ "_id": "…", "text": "…", "createdAt": "…", "updatedAt": "…" }],
  "stageHistory": [{ "stage": "Applied", "changedAt": "…" }, …],
  "createdAt": "…", "updatedAt": "…"
}
```

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/applications` | — | The caller's board, newest first |
| GET | `/api/applications/:id` | — | One application (detail view) |
| POST | `/api/applications` | `{ company, position, link?, dateApplied?, deadline?, reminderEnabled? }` | Always starts in `Applied`. `dateApplied` defaults to now. `400` "Company name is required." / "Role title is required." |
| PATCH | `/api/applications/:id` | any of `{ company, position, link, dateApplied, deadline, reminderEnabled }` | Partial edit. `deadline: null` clears it. Stage is changed via `/stage`. |
| PATCH | `/api/applications/:id/stage` | `{ stage }` | `stage` ∈ `Applied`, `Online Assessment`, `Interview`, `Offer`, `Rejected`. Appends a timestamped `stageHistory` entry (none if the stage is unchanged). |
| DELETE | `/api/applications/:id` | — | `204`; also deletes its mentor feedback |

## Notes (FR-5) — role: applicant

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/applications/:id/notes` | `{ text }` | `201` → the new note |
| PATCH | `/api/applications/:id/notes/:noteId` | `{ text }` | → the edited note |
| DELETE | `/api/applications/:id/notes/:noteId` | — | `204` |

## Analytics (FR-7) — role: applicant

`GET /api/analytics?from=2026-09-01&to=2026-09-30` (both optional; filters
on `dateApplied`, `to` is inclusive of that whole day)

```json
{
  "range": { "from": "…" | null, "to": "…" | null },
  "total": 5,
  "stageCounts": { "Applied": 1, "Online Assessment": 1, "Interview": 1, "Offer": 1, "Rejected": 1 },
  "funnel": [
    { "stage": "Applied", "count": 5 },
    { "stage": "Online Assessment", "count": 4 },
    { "stage": "Interview", "count": 2 },
    { "stage": "Offer", "count": 1 }
  ],
  "conversions": [
    { "from": "Applied", "to": "Online Assessment", "rate": 0.8 },
    { "from": "Online Assessment", "to": "Interview", "rate": 0.5 },
    { "from": "Interview", "to": "Offer", "rate": 0.5 }
  ]
}
```

- `stageCounts` = where applications are **now** (summary cards).
- `funnel` = how many **reached** each stage, including ones later
  rejected (funnel chart). `rate` is 0–1; multiply by 100 for %.
- `total: 0` → show the empty state ("Add your first application").

## Mentors (FR-8, FR-9)

| Method | Path | Body | Role | Notes |
|---|---|---|---|---|
| POST | `/api/mentors/invite` | `{ mentorEmail }` | applicant | Works even if the mentor has no account yet. Sends an invite email. `201` new, `200` re-sent/reopened, `409` already accepted, `400` email belongs to a non-mentor account. Response includes `emailSent`. |
| GET | `/api/mentors` | — | applicant | My mentors (pending + accepted), `mentor` populated when they have an account |
| DELETE | `/api/mentors/links/:linkId` | — | applicant | Revoke access immediately |
| DELETE | `/api/mentors/share/:mentorId` | — | applicant | Same, addressed by mentor user id |
| GET | `/api/mentors/invitations` | — | mentor | Pending invitations (`applicant` populated) |
| POST | `/api/mentors/invitations/:linkId/accept` | — | mentor | |
| POST | `/api/mentors/invitations/:linkId/decline` | — | mentor | |
| GET | `/api/mentors/roster` | — | mentor | Accepted applicants |
| GET | `/api/mentors/applicants/:applicantId/pipeline` | — | mentor | Read-only. `{ applicant, summary: { total, stageCounts, upcomingDeadlines[], recentActivity[] }, applications[] }`. `403` if not accepted/revoked. |

A mentor who signs up with the invited email automatically sees the
invitation in `/api/mentors/invitations`.

## Feedback (FR-10)

| Method | Path | Body | Role | Notes |
|---|---|---|---|---|
| GET | `/api/applications/:id/feedback` | — | applicant (owner) or linked mentor | Newest first, `mentorId` populated with `{ name, email }` |
| POST | `/api/applications/:id/feedback` | `{ comment }` | mentor | `403` if access was revoked |

## Settings (FR-6, FR-11)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/settings` | — | Profile + `notificationPreferences` |
| PATCH | `/api/settings` | `{ name?, notificationPreferences?: { deadlineReminders?, mentorFeedback? } }` | Booleans only |

Deadline reminders (FR-6) are sent once per deadline, within 24 hours of
it, only when both `notificationPreferences.deadlineReminders` and the
application's `reminderEnabled` are `true`, and never for Offer/Rejected.

## Admin (FR-13, FR-14) — role: admin

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/users` | All accounts (no password data) |
| PATCH | `/api/admin/users/:id/disable` | `{ user, alreadyInState }`. Takes effect on the user's next request. Can't disable yourself. |
| PATCH | `/api/admin/users/:id/enable` | `{ user, alreadyInState }` |
| DELETE | `/api/admin/users/:id` | FR-15. Body `{ password }` (the admin's own). Account must already be disabled. See **Account deletion**. |
| GET | `/api/admin/metrics` | `{ totalUsers, activeUsers, disabledAccounts, totalApplications, invitationsSent, usersByRole }`. "Active" = used the app in the last 30 days. |

## Account deletion (FR-15)

Deletion is permanent and runs as one unit (a transaction on Atlas), so an
account is never left half-deleted.

**What is removed**
- Applicant: the account, all their applications (notes and stage history
  included), all feedback on those applications, and every mentor link they created.
- Mentor: the account, every link to them (any status), and all feedback they wrote.
  Applicants keep their applications.
- Admin: the account only.

**Who can delete what**
- `DELETE /api/auth/me`: any applicant or mentor. An admin only if another admin exists.
- `DELETE /api/admin/users/:id`: admins only; the target must be disabled first
  (FR-13); never yourself; never the last admin.

**Responses** (both endpoints)

| Status | Body | When |
|---|---|---|
| `200` | `{ deleted: true, id }` | Done. The deleted user's tokens stop working (`401`); clear the session and redirect. |
| `400` | `{ error, code: "password-required" }` | No password sent |
| `400` | `{ error: "Incorrect password.", code: "invalid-password" }` | Wrong password. The session is still valid, so let them retry. |
| `401` | `{ error }` | Not logged in / session ended (same as every other route) |
| `403` | `{ error, code }` | `last-admin`, `not-disabled`, `self-delete`, or wrong role (no `code`) |
| `404` | `{ error }` | Admin route: user not found |

## Errors

All errors: `{ "error": "human-readable message" }`, plus a `code` on the FR-15 routes. `400` validation or
malformed id, `401` not logged in / session ended, `403` wrong role or
disabled, `404` not found (or not yours), `409` conflict, `500` server.
The messages are written to be shown to the user as-is.
