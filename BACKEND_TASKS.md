# Backend tasks — Dung

Working notes for the backend half of Waypoint (`server/`). Kept here so
any new session picks up exactly where the last one left off without me
re-explaining the whole project.

## Status

**Branch:** `dung/backend-core` → PR #1 (not yet merged into `main`)

### Done

- **Auth (FR-1, FR-2)**: `POST /api/auth/register`, `/login` — bcrypt
  password hashing, server-side email/password validation
  (`src/lib/validators.js`), JWT session tokens (`src/lib/jwt.js`)
- **Role-based access (FR-11)**: `requireRole` middleware, used on
  mentor-only and admin-only routes
- **Applications (FR-3, FR-4)**: create, edit, move stage, delete
- **Notes (FR-5)**: add/edit/delete — `notes[]` array on each
  application
- **Mentors (FR-8, FR-9)**: invite by email, accept invitation,
  read-only pipeline view, roster
- **Feedback (FR-10)**: `POST /api/applications/:id/feedback`
  (mentor-only, requires an accepted mentor link); separate `Feedback`
  model
- **Analytics (FR-7)**: `GET /api/analytics` — stage counts + funnel
  conversion rates
- **Admin (FR-13, FR-14)**: list/disable/enable users, usage metrics,
  restricted to `role: "admin"`
- **Observer pattern** (`src/lib/applicationEvents.js`): stage changes
  emit `STAGE_CHANGED`; analytics and reminders subscribe independently
  (per the Design Patterns UML doc)
- **Email (FR-6)**: `src/lib/emailService.js` (SendGrid REST API) +
  `src/lib/reminderJob.js`, runs hourly, only emails users who are
  opted in
- `server/API_CONTRACT.md` — full endpoint reference for the frontend

### Still open

1. **MongoDB integration test** — everything above is validated with
   `node --check` and unit-style checks (validators, bcrypt, JWT, role
   middleware, Observer), but not against a real database yet. Run it
   against a real `MONGODB_URI` (Atlas or local) before merging PR #1.
2. **Real email send untested** — needs a live `EMAIL_SERVICE_API_KEY`.
3. **`/api/mentors/invite` limitation** — currently requires the
   mentor to already have an account. If a mentor hasn't signed up
   yet, that needs a different flow (store a pending email-only
   invite + send a signup link).

## Conventions

- Branch names: `<firstname>/<short-topic>` (e.g. `dung/backend-core`).
- No direct push to `main` — branch ruleset requires a PR with 1
  approval.
- Server code lives under `server/src/` (`models/`, `routes/`, `lib/`,
  `middleware/`, `config/`). `server/index.js` only wires things
  together.
- Run `node --check` on every changed `.js` file before opening a PR;
  prefer a full MongoDB integration test when a `MONGODB_URI` is
  reachable.
- Use `bcryptjs` (pure JS), not `bcrypt` (native build) — avoids
  native-module build issues in sandboxed environments.

## Reference docs

- `server/API_CONTRACT.md` — REST API reference (source of truth for
  the frontend)
- `Group8_Waypoint_Production_Plan.xlsx` — the authoritative task
  breakdown with FR numbers
- The SRS doc — exact FR wording when a requirement is ambiguous
