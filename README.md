# Waypoint

An application-tracking platform for job and internship seekers, built for CSCE 3444 (Software Engineering) at the University of North Texas.

Waypoint centralizes a user's job/internship applications into a single Kanban-style pipeline (Applied → Online Assessment → Interview → Offer/Rejected), with a secondary Mentor role that can view a linked applicant's pipeline and leave feedback.

## Team — Group 8

| Name | Role |
|---|---|
| Dung Nguyen | Backend |
| Mairesse Nkundizanye | Frontend |
| Oguz M. | Testing / QA + Non-Functional Requirements |
| Michael | Backend Support |

## Tech Stack

- **Frontend:** React
- **Backend:** Node.js, Express
- **Database:** MongoDB
- **Email:** Transactional email service (e.g., SendGrid/AWS SES) for deadline reminders

This is the **MERN** stack — chosen to keep the team working in a single language (JavaScript) across the frontend and backend.

## Project Structure

```
waypoint-tracker/
├── client/          # React frontend
├── server/          # Node/Express API
├── README.md
└── .gitignore
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm
- A MongoDB connection (local or Atlas)

### Setup

```bash
# Clone the repo
git clone https://github.com/<your-username>/waypoint-tracker.git
cd waypoint-tracker

# Install server dependencies
cd server
npm install
npm run dev

# In a separate terminal, install client dependencies
cd client
npm install
npm run dev
```

The API runs on `http://localhost:5000` by default; the client runs on `http://localhost:5173` (Vite dev server).

## Documentation

- **Software Requirements Specification (SRS):** see project Information Sheet
- **UI Design / Wireframes:** see project Information Sheet
- **Production Plan:** see project Information Sheet

## Course

CSCE 3444 — Software Engineering, University of North Texas
Instructor: Prof. Hadiseh Gooran
