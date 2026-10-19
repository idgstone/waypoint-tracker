import { useEffect, useRef, useState } from "react";
import { createApi } from "./api.js";

export default function useSession() {
  const [api] = useState(() => createApi());
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(() => api.hasToken());
  const [error, setError] = useState("");
  const [ended, setEnded] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    api.onSessionEnded((message) => { generation.current++; setUser(null); setError(""); setRestoring(false); setEnded(message); });
    return () => { api.onSessionEnded(() => {}); api.onActivity(() => {}); };
  }, [api]);
  async function restore(showLoading = true) {
    const current = ++generation.current;
    if (showLoading) setRestoring(true);
    setError("");
    try {
      const restored = await api.me();
      if (current === generation.current) setUser(restored);
    } catch (failure) {
      if (current === generation.current && api.hasToken()) setError(failure.message);
    } finally { if (current === generation.current || !api.hasToken()) setRestoring(false); }
  }
  useEffect(() => { if (api.hasToken()) restore(); }, [api]);
  // Revalidate on returning to the tab, without a keepalive polling loop.
  useEffect(() => {
    function focus() { if (api.hasToken() && user) restore(false); }
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [api, user]);
  // Expiry is authoritative on the server (its inactivity window is configurable).
  // Focus checks and normal protected requests handle 401 without keepalive polling.
  return {
    api,
    cancelAuthentication() { api.cancelAuthentication(); },
    updateProfile(profile) {
      generation.current++;
      setUser((previous) => previous && previous.id === profile.id
        ? { id: profile.id, name: profile.name, email: profile.email, role: profile.role } : previous);
    },
    user, restoring, error, ended, warning: api.storageWarning(), retry: () => restore(),
    discard() { generation.current++; api.clear(); setError(""); setUser(null); setRestoring(false); },
    async authenticate(mode, values) {
      const authenticated = await api.authenticate(mode, values);
      generation.current++; setUser(authenticated); setEnded(""); setError(""); setRestoring(false);
    },
    async logout() { await api.logout(); generation.current++; setUser(null); setError(""); setRestoring(false); setEnded(""); },
  };
}
