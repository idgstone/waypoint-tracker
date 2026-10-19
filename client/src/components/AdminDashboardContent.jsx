import { filterAdminUsers } from "../services/adminPresentation.js";

export function AdminUserTable({ users, search, adminId, onAction, pending = false, preview = false }) {
  const visible = filterAdminUsers(users, search);
  return <div className="admin-table-scroll" role="region" aria-label="User accounts table, scroll horizontally on small screens" tabIndex={0}>
    <table className="admin-table"><caption>{preview ? "Fictional user accounts — status actions affect this browser only" : "User accounts — filtered by name or email"}</caption>
      <thead><tr>{["Name", "Email", "Role", "Status", "Action"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{visible.map((user) => <tr key={user._id}><th scope="row">{user.name}{user._id === adminId && <span className="admin-self"> (you)</span>}</th><td>{user.email}</td><td className="admin-role">{user.role}</td>
        <td><span className={`admin-status ${user.disabled ? "is-disabled" : "is-enabled"}`}><span aria-hidden="true">{user.disabled ? "✕" : "■"}</span> {user.disabled ? "Disabled" : "Enabled"}</span></td>
        <td>{user._id === adminId ? <span className="admin-self">Cannot disable yourself</span> : <button type="button" className="button button--secondary" disabled={pending} aria-label={`${user.disabled ? "Re-enable" : "Disable"} ${user.name}`} onClick={() => onAction({ user, disabled: !user.disabled })}>{user.disabled ? "Re-enable" : "Disable"}</button>}</td>
      </tr>)}
        {!visible.length && <tr><td colSpan={5}>{users.length ? "No accounts match your search. Try another name or email." : preview ? "No preview accounts available." : "No user accounts found."}</td></tr>}
      </tbody>
    </table>
  </div>;
}

export function AdminStats({ metrics, preview = false }) {
  return <div className="admin-stats">{[
    { label: "Active Users", value: metrics.activeUsers },
    { label: preview ? "Invitations sent this week" : "Invitations (all time)", value: preview ? metrics.invitationsThisWeek : metrics.invitationsSent },
    { label: "Disabled accounts", value: metrics.disabledAccounts },
  ].map(({ label, value }, index) => <div key={label} className={`card admin-stat admin-stat-${index}`}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

export function AdminUsageMetrics({ metrics, preview = false }) {
  return <section className="card admin-metrics" aria-labelledby="admin-metrics-title"><h2 id="admin-metrics-title">Documented usage metrics{preview ? " — preview" : ""}</h2>
    <p>Live service health monitoring is not implemented. {preview ? "These are fictional usage metrics matching GET /api/admin/metrics, not live server checks." : "These usage statistics come from GET /api/admin/metrics; they do not report uptime, latency, or database health."}</p>
    <dl>{[{ label: "Total users", value: metrics.totalUsers }, { label: "Active users", value: metrics.activeUsers }, { label: "Disabled accounts", value: metrics.disabledAccounts }, { label: "Total applications", value: metrics.totalApplications }, { label: "Invitations (all time)", value: metrics.invitationsSent }].map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h2>Users by role</h2><ul>{Object.entries(metrics.usersByRole).map(([role, count]) => <li key={role}>{role}: {count}</li>)}</ul>
    <p>The API provides an all-time invitation-link count, not a weekly count or a count of delivered emails.</p>
  </section>;
}
