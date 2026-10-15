# Backend tasks — Dung

Working notes for the backend half of Waypoint (`server/`). Kept here so
any new session picks up exactly where the last one left off without me
re-explaining the whole project.

## Status

**Branch:** `dung/backend-core` → PR #1 (not yet merged into `main`)

All backend FRs (1–14) are implemented and pass `npm run smoke`
(59 end-to-end checks against a MongoDB-compatible database).

### Done

- **Auth (FR-1, FR-2)**: register, login, logout, `/me`. bcrypt hashing,
  server-side validation with user-facing messages, JWT sessions.
  Sessions end after 30 min inactivity, on logout (`tokenVersion`), or
  when an admin disables the account (NFR 5.2).
- **Factory Method** (`src/lib/userFactory.js`): role-specific user
  creation, used by register and `scripts/createAdmin.js`.
- **Role-based access (FR-11)**: applicant-only application routes,
  mentor read-only, admin can't read application data.
- **Applications (FR-3, FR-4)**: company, position, link, dateApplied,
  deadline; timestamped stage history.
- **Notes (FR-5)**: add/edit/delete.
- **Reminders (FR-6)**: SendGrid, hourly job, one email per deadline,
  both opt-ins honored, closed applications skipped.
- **Analytics (FR-7)**: funnel based on stage *reached* (from
  stageHistory), conversion rates, date-range filter.
- **Mentors (FR-8, FR-9)**: invite by email (with or without an account),
  invite email, accept/decline, revoke, re-invite, read-only pipeline
  with summary.
- **Feedback (FR-10)**: mentor-only post, visible to applicant and
  linked mentor.
- **Admin (FR-13, FR-14)**: list/disable/enable, metrics.
- **Observer pattern** (`src/lib/applicationEvents.js`).
- **Stability**: Express 5, so a bad id returns 400 instead of crashing
  the server.

### Still open

1. **Run `npm run smoke` against Atlas** — the sandbox test used
   FerretDB (MongoDB-compatible). Run once against the real cluster.
2. **Real email send** — needs a live `EMAIL_SERVICE_API_KEY` and a
   verified sender address in SendGrid.
3. **Deployment** (for the final presentation) — backend on
   Render/Railway, HTTPS (NFR 5.2), `CLIENT_URL` set to the frontend URL.
4. **Test Plan document (Week 10)** — originally Michael's; confirm who
   owns it.

## Running it

```
cd server
npm install
cp .env.example .env      # fill in MONGODB_URI and JWT_SECRET
npm run smoke             # end-to-end test, uses a throwaway database
npm run dev               # API on http://localhost:5000
npm run create-admin -- "Name" admin@example.com Password1
```

## Conventions

- Branch names: `<firstname>/<short-topic>` (e.g. `dung/backend-core`).
- No direct push to `main` — branch ruleset requires a PR with 1
  approval.
- Server code lives under `server/src/` (`models/`, `routes/`, `lib/`,
  `middleware/`, `config/`). `src/app.js` builds the Express app;
  `index.js` only connects the DB, starts it, and schedules reminders.
- Run `npm run smoke` before opening a PR.
- Use `bcryptjs` (pure JS), not `bcrypt` (native build).

## Reference docs

- `server/API_CONTRACT.md` — REST API reference (source of truth for
  the frontend)
- `Group8_Waypoint_Production_Plan.xlsx` — the authoritative task
  breakdown with FR numbers
- The SRS doc — exact FR wording when a requirement is ambiguous
