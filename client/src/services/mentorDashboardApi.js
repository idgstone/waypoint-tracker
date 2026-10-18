import { ApiError } from "./api.js";

const stages = ["Applied", "Online Assessment", "Interview", "Offer", "Rejected"];
const idOf = (value) => typeof value === "string" ? value : value?._id;

export function mentorLinkRecords(records, status) {
  if (!Array.isArray(records)) throw new Error("The server returned an invalid mentor list.");
  return records.map((record) => {
    if (!record || typeof record._id !== "string" || record.status !== status || typeof record.mentorEmail !== "string") throw new Error("The server returned an invalid mentor link.");
    const applicant = record.applicant && typeof record.applicant === "object" && typeof record.applicant._id === "string" && typeof record.applicant.name === "string"
      ? { _id: record.applicant._id, name: record.applicant.name, email: record.applicant.email } : null;
    return { _id: record._id, status, applicant, mentorEmail: record.mentorEmail, mentor: idOf(record.mentor) };
  });
}

export function pipelineRecord(record, applicantId) {
  if (record?.applicant?._id !== applicantId || typeof record.applicant.name !== "string" || !Array.isArray(record.applications)
    || !Number.isInteger(record.summary?.total) || record.summary.total < 0
    || !stages.every((stage) => Number.isInteger(record.summary.stageCounts?.[stage]) && record.summary.stageCounts[stage] >= 0)) throw new Error("The server returned an invalid or different student's pipeline.");
  for (const application of record.applications) {
    if (typeof application._id !== "string" || typeof application.company !== "string" || typeof application.position !== "string" || !stages.includes(application.stage)) throw new Error("The server returned an invalid application.");
  }
  return record;
}

export function mentorOverviewCounts(summary) {
  const counts = summary.stageCounts;
  return [counts.Applied, counts["Online Assessment"], counts.Interview, counts.Offer + counts.Rejected];
}

export function feedbackRecords(records, applicationId) {
  if (!Array.isArray(records)) throw new Error("The server returned invalid feedback.");
  return records.map((record) => {
    if (!record || typeof record._id !== "string" || record.applicationId !== applicationId || typeof record.comment !== "string" || !Number.isFinite(Date.parse(record.createdAt))) throw new Error("The server returned feedback for an unavailable or different application.");
    return { _id: record._id, comment: record.comment, createdAt: record.createdAt,
      author: record.mentorId?.name || "Mentor account unavailable", mentorId: idOf(record.mentorId), applicationId };
  });
}

export function invitationAccountError(link, user) {
  if (user?.role !== "mentor") return "Sign in with the invited Mentor account to respond to this invitation.";
  if (link.status !== "pending") return "This invitation is no longer pending. Refresh invitations.";
  if (link.mentorEmail?.trim().toLowerCase() !== user.email.trim().toLowerCase() || (link.mentor && link.mentor !== user.id)) return "This invitation belongs to another account. Sign out and sign in with the invited email address.";
  if (!link.applicant) return "The applicant account is unavailable. Refresh your invitations.";
  return "";
}

export function createMentorDashboardApi(api, user) {
  return {
    async roster(signal) { return mentorLinkRecords(await api.request("/mentors/roster", { signal }), "accepted"); },
    async invitations(signal) { return mentorLinkRecords(await api.request("/mentors/invitations", { signal }), "pending"); },
    async pipeline(applicantId, signal) {
      return pipelineRecord(await api.request(`/mentors/applicants/${encodeURIComponent(applicantId)}/pipeline`, { signal }), applicantId);
    },
    async feedback(applicationId, signal) {
      return feedbackRecords(await api.request(`/applications/${encodeURIComponent(applicationId)}/feedback`, { signal }), applicationId);
    },
    async sendFeedback(applicationId, comment) {
      if (!comment.trim()) throw new ApiError("Enter feedback before sending.", 400);
      let record;
      try { record = await api.request(`/applications/${encodeURIComponent(applicationId)}/feedback`, { method: "POST", body: { comment: comment.trim() } }); }
      catch (failure) {
        if (!failure.status || failure.status >= 500) {
          failure.unconfirmedSubmission = true;
          failure.message += " Your draft is retained. The request may have reached the server; refresh feedback history before sending again.";
        }
        throw failure;
      }
      if (record?.applicationId !== applicationId || idOf(record.mentorId) !== user.id || typeof record._id !== "string" || typeof record.comment !== "string") throw Object.assign(new Error("Feedback could not be confirmed. Refresh its history before sending again."), { unconfirmedSubmission: true });
      return record;
    },
    async respond(link, action) {
      const error = invitationAccountError(link, user);
      if (error) throw new ApiError(error, 403);
      if (action !== "accept" && action !== "decline") throw new ApiError("Choose Accept or Decline.", 400);
      let result;
      try { result = await api.request(`/mentors/invitations/${encodeURIComponent(link._id)}/${action}`, { method: "POST" }); }
      catch (failure) {
        if (failure.status === 404) failure.message += " The invitation may no longer be pending or may belong to another account. Sign in with the invited email and refresh.";
        throw failure;
      }
      if (result?._id !== link._id || result.status !== (action === "accept" ? "accepted" : "revoked") || idOf(result.mentor) !== user.id) throw new Error("The invitation response could not be confirmed. Refresh invitations to check its status.");
      return result;
    },
  };
}

// Clearing data at request start and guarding the generation prevents stale
// responses from crossing student/application selections, even without abort support.
export function createMentorResource(load) {
  let generation = 0;
  let controller;
  function cancel() { generation++; controller?.abort(); }
  return {
    cancel,
    async run(key, publish) {
      cancel(); const current = generation;
      controller = new AbortController();
      publish({ key, data: null, loading: true, error: "", status: 0 });
      try {
        const data = await load(key, controller.signal);
        if (current !== generation) return null;
        const state = { key, data, loading: false, error: "", status: 0 };
        publish(state); return state;
      } catch (failure) {
        if (current !== generation) return null;
        const state = { key, data: null, loading: false, error: failure.message, status: failure.status || 0 };
        publish(state); return state;
      }
    },
  };
}

export function createFeedbackSubmission(service, applicationId) {
  let pending = false;
  return async (comment, refresh) => {
    if (pending) throw new ApiError("Feedback is already being sent.", 409);
    pending = true;
    try {
      await service.sendFeedback(applicationId, comment);
      const refreshed = await refresh();
      return refreshed?.error
        ? { keepDraft: true, notice: "Feedback saved, but its history could not be refreshed. Your text is retained for reference; use Retry feedback rather than sending it again." }
        : { notice: "Feedback saved." };
    } finally { pending = false; }
  };
}
