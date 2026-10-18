import { useEffect, useMemo, useState } from "react";
import { createMentorResource } from "./mentorDashboardApi.js";

export default function useMentorResource(load, key = "") {
  const resource = useMemo(() => createMentorResource(load), [load]);
  const [state, setState] = useState({ key, data: null, loading: true, error: "", status: 0 });
  useEffect(() => {
    resource.run(key, setState);
    return () => resource.cancel();
  }, [resource, key]);
  // Do not expose the previous key's data during the render before an effect runs.
  const current = state.key === key ? state : { key, data: null, loading: true, error: "", status: 0 };
  return { ...current, retry: () => resource.run(key, setState) };
}
