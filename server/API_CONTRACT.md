# Waypoint API Contract

Base URL (dev): `http://localhost:5000`

**Auth:** `POST /api/auth/register` or `/login` return `{ token, user }`.
Send `Authorization: Bearer <token>` on every other request below.
The token carries the user's role, which gates mentor/admin-only routes.

## Auth (FR-1, FR-2)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password, role? }` | `role` ∈ `applicant` \| `mentor` (default `applicant`); admin accounts aren't self-registered. Password: 8+ chars, 1 letter, 1 number. |
| POST | `/api/auth/login` | `{ email, password }` | Returns a 7-day JWT |

## Applications (FR-3, FR-4)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/applications` | — | List the caller's board, newest first |
| POST | `/api/applications` | `{ company, position, deadline?, reminderEnabled? }` | Creates with `stage: "Applied"` |
| PATCH | `/api/applications/:id` | `{ company?, position?, deadline?, reminderEnabled? }` | Partial edit |
| PATCH | `/api/applications/:id/stage` | `{ stage }` | `stage` ∈ `Applied`, `Online Assessment`, `Interview`, `Offer`, `Rejected` |
| DELETE | `/api/applications/:id` | — | 204 on success |

## Notes (FR-5)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/applications/:id/notes` | `{ text }` | Adds a note |
| PATCH | `/api/applications/:id/notes/:noteId` | `{ text }` | Edits a note |
| DELETE | `/api/applications/:id/notes/:noteId` | — | Deletes a note |

## Mentors (FR-8, FR-9)

| Method | Path | Body | Role | Notes |
|---|---|---|---|---|
| POST | `/api/mentors/invite` | `{ mentorEmail }` | applicant | Creates a pending link to an existing mentor account |
| POST | `/api/mentors/invitations/:linkId/accept` | — | mentor | Accepts a pending invitation |
| GET | `/api/mentors/invitations` | — | mentor | List pending invitations |
| DELETE | `/api/mentors/share/:mentorId` | — | applicant | Revokes an accepted/pending link |
| GET | `/api/mentors/roster` | — | mentor | Accepted applicants |
| GET | `/api/mentors/applicants/:applicantId/pipeline` | — | mentor | Read-only board for one accepted applicant |

## Feedback (FR-10)

| Method | Path | Body | Role | Notes |
|---|---|---|---|---|
| GET | `/api/applications/:id/feedback` | — | applicant (owner) | Feedback left on that application |
| POST | `/api/applications/:id/feedback` | `{ comment }` | mentor | Requires an accepted mentor link to that applicant |

## Analytics (FR-7)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/analytics` | `{ stageCounts, funnel, conversions }` for the caller's own pipeline |

## Admin (FR-13, FR-14) — role: admin only

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/admin/users` | — | List all accounts |
| PATCH | `/api/admin/users/:id/disable` | — | |
| PATCH | `/api/admin/users/:id/enable` | — | |
| GET | `/api/admin/metrics` | — | `{ activeUsers, totalUsers, totalApplications, invitationsSent }` |

## Settings (FR-6, FR-11 — profile/notification UI)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/settings` | — | Current profile + notification prefs |
| PATCH | `/api/settings` | `{ name?, notificationPreferences?: { deadlineReminders?, mentorFeedback? } }` | Partial update |

## Errors

All error responses: `{ "error": "message" }` with a 4xx/5xx status.
