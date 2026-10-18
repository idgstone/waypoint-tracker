import { useEffect, useMemo, useRef, useState } from "react";
import Mentors from "./Mentors.jsx";
import { createMentorsApi, createMentorLinksLoader } from "../services/mentorsApi.js";

export default function ApplicantMentors({ api, onBackToBoard }) {
  const service = useMemo(() => createMentorsApi(api), [api]);
  const loader = useMemo(() => createMentorLinksLoader(service), [service]);
  const [state, setState] = useState({ links: [], loading: true, error: "" });
  const [notice, setNotice] = useState("");
  const links = useRef([]);
  const pending = useRef(false);
  const alive = useRef(false);
  function publish(update) {
    if (!alive.current) return;
    if (update.links) links.current = update.links;
    setState((previous) => ({ ...previous, ...update }));
  }
  useEffect(() => {
    alive.current = true;
    loader.load(publish);
    return () => { alive.current = false; loader.cancel(); };
  }, [loader]);
  async function invite(email) {
    if (pending.current) throw new Error("An invitation request is already in progress.");
    pending.current = true;
    loader.cancel(); setNotice("");
    try {
      const result = await service.invite(email, links.current);
      // Creation is confirmed independently of a subsequent list refresh.
      if (alive.current) {
        const next = [result.invitation, ...links.current.filter((link) => link._id !== result.invitation._id)];
        publish({ links: next });
        await loader.load(publish);
      }
      return result;
    } finally { pending.current = false; }
  }
  async function revoke(link) {
    if (pending.current) throw new Error("Another mentor request is in progress.");
    pending.current = true; loader.cancel(); setNotice("");
    try {
      await service.revoke(link._id);
      if (alive.current) {
        publish({ links: links.current.filter((item) => item._id !== link._id) });
        setNotice(link.status === "accepted" ? `Pipeline access revoked for ${link.mentorEmail}.` : `Invitation cancelled for ${link.mentorEmail}.`);
        await loader.load(publish);
      }
    } finally { pending.current = false; }
  }
  return <Mentors {...state} preview={false} notice={notice} onInvite={invite} onRevoke={revoke} onRetry={() => loader.load(publish)} onBackToBoard={onBackToBoard} />;
}
