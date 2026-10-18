export function linkedStudent(links, studentId) {
  return links?.find((link) => link.status === "accepted" && link.applicant?._id === studentId)?.applicant || null;
}
