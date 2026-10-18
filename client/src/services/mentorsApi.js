import { validateMentorEmail, normalizeMentorEmail } from "./previewMentors.js";

export function mapMentorLink(link) {
  if (!link || typeof link._id !== "string" || typeof link.mentorEmail !== "string" || !["pending", "accepted", "revoked"].includes(link.status)) throw new Error("The server returned an invalid mentor link.");
  return {
    _id: link._id, mentorEmail: link.mentorEmail, status: link.status,
    mentor: link.mentor && typeof link.mentor === "object" && typeof link.mentor.name === "string"
      ? { _id: link.mentor._id, name: link.mentor.name, email: link.mentor.email } : null,
    createdAt: link.createdAt, updatedAt: link.updatedAt,
  };
}

export function createMentorsApi(api) {
  return {
    async list(signal) {
      const links = await api.request("/mentors", { signal });
      if (!Array.isArray(links)) throw new Error("The server returned an invalid mentor list.");
      return links.map(mapMentorLink).filter((link) => link.status !== "revoked");
    },
    async invite(email, links) {
      const error = validateMentorEmail(email, links);
      if (error) throw new Error(error);
      let response;
      try { response = await api.request("/mentors/invite", { method: "POST", body: { mentorEmail: normalizeMentorEmail(email) } }); }
      catch (failure) {
        if (!failure.status || failure.status >= 500) failure.message += " The invitation may have reached the server. Close the form and refresh Mentors before sending again.";
        throw failure;
      }
      const link = mapMentorLink(response);
      if (link.status !== "pending" || normalizeMentorEmail(link.mentorEmail) !== normalizeMentorEmail(email)) throw new Error("The invitation response could not be confirmed. Refresh Mentors before sending again.");
      return { invitation: { ...link, mentorEmail: email.trim(), emailSent: response.emailSent === true } };
    },
    async revoke(id) {
      const result = mapMentorLink(await api.request(`/mentors/links/${encodeURIComponent(id)}`, { method: "DELETE" }));
      if (result._id !== id || result.status !== "revoked") throw new Error("Revocation could not be confirmed. Refresh Mentors to check its status.");
      return result;
    },
  };
}

export function createMentorLinksLoader(service) {
  let generation = 0;
  let controller;
  function cancel() { generation++; controller?.abort(); }
  return {
    cancel,
    async load(publish) {
      cancel();
      const current = generation;
      controller = new AbortController();
      publish({ loading: true, error: "" });
      try {
        const links = await service.list(controller.signal);
        if (current === generation) publish({ loading: false, error: "", links });
      } catch (failure) {
        if (current === generation) publish({ loading: false, error: failure.message });
      }
    },
  };
}
