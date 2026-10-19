// Preview success-screen wording is explicitly separate from API delivery status.
export function invitationConfirmation(result, development = false) {
  if (!result || result.error || !result.invitation?.mentorEmail) return null;
  const preview = development && result.preview === true;
  const emailed = result.invitation.emailSent === true;
  return {
    email: result.invitation.mentorEmail,
    preview,
    heading: preview || emailed ? "Invitation sent!" : "Invitation created",
    message: preview || emailed
      ? `We emailed ${result.invitation.mentorEmail} with an invitation to view your pipeline. You'll see them appear on your Mentors page once they accept.`
      : `The invitation for ${result.invitation.mentorEmail} was created, but the email was not sent.`,
  };
}
