// Fictional, isolated mentor demonstration; no applicant invitations are consumed.
export const previewMentor = { _id: "preview-mentor-g", name: "Grace Preview", email: "grace@example.com" };
export const mentorStudents = [
  { _id: "mentor-student-jack", name: "Jack W.", email: "jack.student@example.com", applications: [
    { _id: "mentor-app-acme", company: "Acme Corp", position: "Software Intern", stage: "Applied", dateApplied: "2026-09-10", deadline: "2026-11-01", notes: [{ text: "Preparing for the technical assessment." }] },
    { _id: "mentor-app-orbit", company: "Orbit Labs", position: "Firmware Intern", stage: "Online Assessment", dateApplied: "2026-09-12", deadline: null, notes: [] },
    { _id: "mentor-app-north", company: "North Robotics", position: "Embedded Intern", stage: "Interview", dateApplied: "2026-09-14", deadline: null, notes: [] },
    { _id: "mentor-app-maple", company: "Maple Systems", position: "Backend Intern", stage: "Rejected", dateApplied: "2026-09-16", deadline: null, notes: [] },
    { _id: "mentor-app-cobalt", company: "Cobalt Tech", position: "Frontend Intern", stage: "Offer", dateApplied: "2026-09-18", deadline: null, notes: [] },
  ] },
  { _id: "mentor-student-riley", name: "Riley N.", email: "riley.student@example.com", applications: [
    { _id: "mentor-app-summit", company: "Summit Software", position: "QA Intern", stage: "Applied", dateApplied: "2026-09-20", deadline: null, notes: [] },
  ] },
  { _id: "mentor-student-sam", name: "Sam M.", email: "sam.student@example.com", applications: [] },
];
export const mentorSampleFeedback = [
  { _id: "mentor-feedback-example", applicationId: "mentor-app-acme", mentorId: previewMentor._id,
    author: previewMentor.name, comment: "Practice explaining your project decisions before the interview.", createdAt: "2026-10-01T15:00:00.000Z" },
];
