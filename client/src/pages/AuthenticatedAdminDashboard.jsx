import { useEffect, useMemo, useRef, useState } from "react";
import { AdminStats, AdminUsageMetrics, AdminUserTable } from "../components/AdminDashboardContent.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { createAdminApi, createAdminResource, createAdminStatusAction } from "../services/adminApi.js";
import "../styles/admin.css";

export default function AuthenticatedAdminDashboard({ api, user, page }) {
  const service = useMemo(() => createAdminApi(api, user), [api, user.id, user.role]);
  const usersResource = useMemo(() => createAdminResource(service.users), [service]);
  const metricsResource = useMemo(() => createAdminResource(service.metrics), [service]);
  const action = useMemo(() => createAdminStatusAction(service), [service]);
  const initial = { data: null, loading: true, error: "", status: 0 };
  const [users, setUsers] = useState(initial);
  const [metrics, setMetrics] = useState(initial);
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [forbiddenAction, setForbiddenAction] = useState(false);
  const heading = useRef(null);
  const alive = useRef(false);
  const forbidden = users.status === 403 || metrics.status === 403 || forbiddenAction;
  function publishUsers(update) { if (alive.current) setUsers(update); }
  function publishMetrics(update) { if (alive.current) setMetrics(update); }
  function refreshUsers() { return usersResource.run(publishUsers); }
  function refreshMetrics() { return metricsResource.run(publishMetrics); }
  useEffect(() => {
    alive.current = true;
    refreshUsers(); refreshMetrics();
    return () => { alive.current = false; usersResource.cancel(); metricsResource.cancel(); };
  }, [usersResource, metricsResource]);
  useEffect(() => { heading.current?.focus(); }, [page]);
  async function confirm() {
    setPending(true); setActionError(""); setNotice("");
    try {
      const message = await action(confirmation.user, confirmation.disabled, (result) => {
        if (alive.current) usersResource.replace((records) => (records || []).map((record) => record._id === result.user._id ? result.user : record), publishUsers);
      }, async () => {
        if (alive.current) await Promise.all([refreshUsers(), refreshMetrics()]);
      });
      if (alive.current) { setNotice(message); setConfirmation(null); requestAnimationFrame(() => heading.current?.focus()); }
    } catch (failure) {
      if (alive.current) {
        setActionError(`${failure.message} The displayed account data has not been changed by this action. Refresh accounts to check the server before retrying.`);
        if (failure.status === 403) setForbiddenAction(true);
      }
      throw failure;
    } finally { if (alive.current) setPending(false); }
  }
  return <main className="content-container admin-page">
    <div className="admin-toolbar"><h1 ref={heading} tabIndex={-1}>{page === "health" ? "System Health" : "User Accounts"}</h1>
      {page !== "health" && <label className="admin-search" htmlFor="real-admin-search">Search by name or email<input id="real-admin-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" /></label>}
    </div>
    <p role="status" className="admin-notice">{notice}</p>
    {actionError && <p role="alert">{actionError}</p>}
    {forbidden && <p role="alert">Administrator access is required. Use Log out and sign in with an authorized admin account. No role-promotion control is available here.</p>}
    {metrics.loading && <p role="status">Loading usage statistics...</p>}
    {metrics.error && <p role="alert">{metrics.error} <button className="button button--secondary" disabled={pending || metrics.loading} onClick={refreshMetrics}>Retry statistics</button>{metrics.data && " Showing last confirmed statistics."}</p>}
    {page === "health" ? <>
      <button className="auth-link" disabled={pending || metrics.loading} onClick={refreshMetrics}>Refresh statistics</button>
      {!forbidden && metrics.data && <AdminUsageMetrics metrics={metrics.data} />}
      {!metrics.data && <p>Only documented usage statistics are available. Live service monitoring is not implemented.</p>}
    </> : <>
      {!forbidden && metrics.data && <AdminStats metrics={metrics.data} />}
      <p className="admin-metric-note">Active users are enabled accounts used in the last 30 days. Invitations is an all-time count of invitation links, including revoked links—not delivered emails. These totals apply to all accounts, regardless of search.</p>
      <p className="admin-metric-note">Search filters the full loaded account list in this browser. The API currently has no search parameters or pagination.</p>
      <button className="auth-link" disabled={pending || users.loading} onClick={refreshUsers}>Refresh accounts</button>
      {users.loading && <p role="status">Loading user accounts...</p>}
      {users.error && <p role="alert">{users.error} <button className="button button--secondary" disabled={pending || users.loading} onClick={refreshUsers}>Retry accounts</button>{users.data && " Showing last confirmed accounts."}</p>}
      {!forbidden && users.data && <AdminUserTable users={users.data} search={search} adminId={user.id} pending={pending || users.loading} onAction={setConfirmation} />}
    </>}
    {confirmation && <ConfirmDialog title={`${confirmation.disabled ? "Disable" : "Re-enable"} account?`} confirmLabel={confirmation.disabled ? "Disable" : "Re-enable"} onCancel={() => setConfirmation(null)} onConfirm={confirm}>
      <p>{confirmation.disabled ? "Disable" : "Re-enable"} <strong>{confirmation.user.name}</strong> ({confirmation.user.email})?</p>
      <p>This changes a real account. It takes effect on the user's next request.</p>
    </ConfirmDialog>}
  </main>;
}
