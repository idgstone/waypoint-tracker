// Local examples from the supplied design; these do not create real accounts.
export const previewAdmin = { _id: "admin-preview-mairesse", name: "Mairesse Nkundizanye", email: "mairesse.n@myunt.edu" };
export const adminUsers = [
  { _id: "admin-user-dung", name: "Dung Nguyen", email: "dung.nguyen@myunt.edu", role: "applicant", disabled: false, lastActiveAt: "2026-10-14T12:00:00.000Z" },
  { _id: "admin-user-oguz", name: "Oguz M.", email: "oguz.m@myunt.edu", role: "applicant", disabled: false, lastActiveAt: "2026-10-13T12:00:00.000Z" },
  { ...previewAdmin, role: "admin", disabled: false, lastActiveAt: "2026-10-15T12:00:00.000Z" },
  { _id: "admin-user-michael", name: "Michael", email: "michael@myunt.edu", role: "applicant", disabled: true, lastActiveAt: "2026-10-13T12:00:00.000Z" },
  { _id: "admin-user-gooran", name: "Prof. Gooran", email: "gooran@unt.edu", role: "mentor", disabled: false, lastActiveAt: "2026-10-12T12:00:00.000Z" },
];
export const adminInvitations = [
  { _id: "admin-invite-1", createdAt: "2026-10-12T14:00:00.000Z" },
  { _id: "admin-invite-2", createdAt: "2026-10-14T14:00:00.000Z" },
  { _id: "admin-invite-3", createdAt: "2026-10-05T14:00:00.000Z" },
];
export const adminApplicationFixtures = [
  { _id: "admin-application-1" }, { _id: "admin-application-2" }, { _id: "admin-application-3" },
];
