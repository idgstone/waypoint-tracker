import { useEffect, useMemo, useState } from "react";
import { AnalyticsView } from "./Analytics.jsx";
import { periodDates } from "../data/analytics.js";
import { createAnalyticsLoader } from "../services/analyticsApi.js";

export default function ApplicantAnalytics({ api }) {
  const loader = useMemo(() => createAnalyticsLoader(api), [api]);
  const [period, setPeriod] = useState("all");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ data: null, loading: true, error: "" });
  useEffect(() => {
    loader.load(dates, setResult);
    return () => loader.cancel();
  }, [loader, dates.from, dates.to, retry]);
  return <AnalyticsView {...result} onRetry={() => setRetry((value) => value + 1)} filters={<div className="analytics-filters">
    <label className="analytics-period">Period<select value={period} onChange={(event) => {
      const value = event.target.value;
      setPeriod(value);
      if (value !== "custom") setDates(periodDates(value));
    }}>
      <option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option>
    </select></label>
    <label className="analytics-period">From<input type="date" value={dates.from} onChange={(event) => { setPeriod("custom"); setDates((previous) => ({ ...previous, from: event.target.value })); }} /></label>
    <label className="analytics-period">To<input type="date" value={dates.to} onChange={(event) => { setPeriod("custom"); setDates((previous) => ({ ...previous, to: event.target.value })); }} /></label>
  </div>} />;
}
