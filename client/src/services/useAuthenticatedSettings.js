import { useEffect, useMemo, useRef, useState } from "react";
import { createSettingsApi, createSettingsLoader } from "./settingsApi.js";

export default function useAuthenticatedSettings({ api, accountId, active, onProfile }) {
  const service = useMemo(() => createSettingsApi(api, accountId), [api, accountId]);
  const loader = useMemo(() => createSettingsLoader(service), [service]);
  const [state, setState] = useState({ settings: null, loading: false, error: "" });
  const alive = useRef(false);
  const lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; loader.cancel(); }; }, [loader]);
  function publish(update) {
    if (!alive.current) return;
    setState((previous) => ({ ...previous, ...update }));
    if (update.settings) onProfile(update.settings);
  }
  useEffect(() => {
    if (active) loader.load(publish);
    return () => loader.cancel();
  }, [active, loader]);
  async function save(draft) {
    if (lock.current) throw new Error("Settings are already being saved.");
    lock.current = true; loader.cancel();
    try {
      const settings = await service.save(draft, state.settings);
      if (alive.current) publish({ settings, error: "" });
      return { settings };
    } finally { lock.current = false; }
  }
  return { state, save, retry: () => loader.load(publish) };
}
