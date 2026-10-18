import { useState } from "react";
import { previewAnalytics, filterApplications } from "../data/analytics.js";
import "../styles/analytics.css";

export default function Analytics({ applications }) {
  const [period, setPeriod] = useState("all");
  const cohort = filterApplications(applications, period);
  return <AnalyticsView data={previewAnalytics(cohort)} filters={<label className="analytics-period">Period
    <select value={period} onChange={(event) => setPeriod(event.target.value)}>
      <option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
    </select>
  </label>} />;
}

export function AnalyticsView({ data, filters, loading = false, error = "", onRetry }) {
  const stages = data?.stages || [];
  return <main className="content-container analytics-page">
    <div className="analytics-toolbar">
      <h1>Analytics</h1>
      {filters}
    </div>
    {loading && <p role="status">Loading analytics...</p>}
    {error && <p role="alert">{error} <button type="button" className="button button--secondary" onClick={onRetry}>Retry</button></p>}
    {data && <>
    <div className="analytics-stats" aria-live="polite">
      {stages.map(({ id, label, currentCount }) => <div key={id} className={`analytics-stat analytics-stage--${id}`}>
        <strong>{currentCount}</strong><span>{label}</span>
      </div>)}
    </div>
    <p className="analytics-rejected">Currently Rejected: <strong>{data.rejected}</strong></p>
    <section className="analytics-funnel" aria-labelledby="funnel-title">
      <h2 id="funnel-title">Conversion Funnel</h2>
      {data.total === 0 ? <p className="analytics-empty">No applications in this period. Add your first application on the Board, or choose another period.</p> :
        <div className="analytics-chart" aria-hidden="true">
          {stages.map(({ id, label, count, height, percentage }, index) => <div key={id} className={`analytics-chart-column analytics-stage--${id}`}>
            <div className="analytics-bar-space"><div className="analytics-bar" style={{ height: `${height}%` }} /></div>
            <p>{label} · {count}{index > 0 && ` · ${percentage}`}</p>
          </div>)}
        </div>}
      <table className="analytics-summary">
        <caption>Current stages and cumulative funnel for the selected period — {data.total} applications</caption>
        <thead><tr><th scope="col">Stage</th><th scope="col">Currently</th><th scope="col">Reached</th><th scope="col">Compared with preceding stage</th></tr></thead>
        <tbody>{stages.map(({ id, label, currentCount, count, percentage }) => <tr key={id}><th scope="row">{label}</th><td>{currentCount}</td><td>{count}</td><td>{percentage}</td></tr>)}</tbody>
      </table>
      <p className="analytics-explanation">Cards show current stages. The funnel uses the furthest stage in history, inferring skipped earlier stages; current stage is used when history is empty. Rejected is separate from Offer and retains earlier progress. Rates compare cumulative totals, rather than direct transitions. Applied in the funnel includes every application in this period.</p>
    </section>
    </>}
  </main>;
}
