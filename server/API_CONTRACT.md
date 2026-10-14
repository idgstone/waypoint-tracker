# Waypoint API Contract — Sprint One

Base URL (dev): `http://localhost:5000`

**Auth (temporary):** until Michael's JWT auth lands, every protected route
reads the caller's user id from an `x-user-id` header. Send it on every
request below. This header requirement disappears once real auth is merged
(it'll become `Authorization: Bearer <token>` instead) — Frontend will only
need to swap how the id/token is attached, not how routes are called.

## Applications (FR-3, FR-4)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/applications` | — | List the caller's board, newest first |
| POST | `/api/applications` | `{ company, position, deadline?, notes? }` | Creates with `stage: "Applied"` |
| PATCH | `/api/applications/:id` | `{ company?, position?, deadline?, notes?, reminderEnabled? }` | Partial edit |
| PATCH | `/api/applications/:id/stage` | `{ stage }` | `stage` ∈ `Applied`, `Online Assessment`, `Interview`, `Offer`, `Rejected` |
| DELETE | `/api/applications/:id` | — | 204 on success |

Application shape:
```json
{
  "_id": "...",
  "owner": "...",
  "company": "Acme Corp",
  "position": "SWE Intern",
  "stage": "Applied",
  "deadline": "2026-11-01T00:00:00.000Z",
  "notes": "",
  "reminderEnabled": true,
  "stageHistory": [{ "stage": "Applied", "changedAt": "..." }],
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Mentors (FR-5, and FR-9/FR-10 stubs for Sprint Two)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/mentors/share` | `{ mentorId }` | Creates a pending mentor link |
| DELETE | `/api/mentors/share/:mentorId` | — | Revokes access |
| GET | `/api/mentors/roster` | — | Mentor-only: accepted applicants |
| GET | `/api/mentors/applicants/:applicantId/pipeline` | — | Mentor-only, read-only board |
| POST | `/api/mentors/applicants/:applicantId/feedback` | `{ message }` | Mentor-only |

## Settings (FR-11)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/settings` | — | Current user profile + notification prefs |
| PATCH | `/api/settings` | `{ name?, notificationPreferences?: { deadlineReminders?, mentorFeedback? } }` | Partial update |

## Errors

All error responses: `{ "error": "message" }` with a 4xx/5xx status.

## Not yet built (Sprint Two)

- `/api/auth/*` — signup/login (Michael)
- `/api/admin/*` — FR-13 (Michael)
- `/api/analytics` — FR-7 funnel stats
