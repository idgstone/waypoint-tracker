import { useState } from "react";
import { calculateFunnel, filterApplications } from "../data/analytics.js";
import "../styles/analytics.css";

export default function Analytics({ applications }) {
  const [period, setPeriod] = useState("all");
  const cohort = filterApplications(applications, period);
  const stages = calculateFunnel(cohort);
  return <main className="content-container analytics-page">
    <div className="analytics-toolbar">
      <h1>Analytics</h1>
      <label className="analytics-period">Period
        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        </select>
      </label>
    </div>
    <div className="analytics-stats" aria-live="polite">
      {stages.map(({ id, label, count }) => <div key={id} className={`analytics-stat analytics-stage--${id}`}>
        <strong>{count}</strong><span>{label}</span>
      </div>)}
    </div>
    <section className="analytics-funnel" aria-labelledby="funnel-title">
      <h2 id="funnel-title">Conversion Funnel</h2>
      {cohort.length === 0 ? <p className="analytics-empty">No applications in this period. Choose another period or add an application on the Board.</p> :
        <div className="analytics-chart" aria-hidden="true">
          {stages.map(({ id, label, count, height, percentage }, index) => <div key={id} className={`analytics-chart-column analytics-stage--${id}`}>
            <div className="analytics-bar-space"><div className="analytics-bar" style={{ height: `${height}%` }} /></div>
            <p>{label} · {count}{index > 0 && ` · ${percentage}`}</p>
          </div>)}
        </div>}
      <table className="analytics-summary">
        <caption>Recorded stage totals for the selected period</caption>
        <thead><tr><th scope="col">Stage</th><th scope="col">Applications</th><th scope="col">Compared with preceding stage</th></tr></thead>
        <tbody>{stages.map(({ id, label, count, percentage }) => <tr key={id}><th scope="row">{label}</th><td>{count}</td><td>{percentage}</td></tr>)}</tbody>
      </table>
      <p className="analytics-explanation">Rates compare recorded stage totals. Skipped stages mean these are not necessarily direct transition probabilities. Applied includes every application in this cohort.</p>
    </section>
  </main>;
}
