import { useRef, useState } from "react";
import Header from "../components/Header.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { AdminStats, AdminUsageMetrics, AdminUserTable } from "../components/AdminDashboardContent.jsx";
import { adminApplicationFixtures, adminInvitations, previewAdmin } from "../data/adminFixtures.js";
import { adminMetrics, loadAdminPreview, saveAdminPreview, updateAdminAccount } from "../services/adminPreview.js";
import "../styles/admin.css";

export default function AdminDashboard({ onBack }) {
  const [startup] = useState(() => loadAdminPreview(import.meta.env.DEV));
  const [users, setUsers] = useState(startup.users);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState("users");
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState("");
  const heading = useRef(null);
  const metrics = adminMetrics(users, adminInvitations, adminApplicationFixtures);
  function confirm() {
    const result = updateAdminAccount(users, confirmation.user._id, confirmation.disabled);
    if (result.error) setNotice(result.error);
    else {
      const error = saveAdminPreview(result.users, import.meta.env.DEV);
      if (error) setNotice(error);
      else { setUsers(result.users); setNotice(`${confirmation.user.name} ${confirmation.disabled ? "disabled" : "re-enabled"} in this browser's preview only. No real account was changed.`); }
    }
    setConfirmation(null);
  }
  return <>
    <aside className="dev-preview"><p>Development admin preview — fictional accounts and local actions only. No backend requests or real account changes.</p><button type="button" className="auth-link" onClick={onBack}>Back to Welcome</button></aside>
    <Header variant="admin" activePage={page} onNavigate={(next) => { setPage(next); requestAnimationFrame(() => heading.current?.focus()); }} userInitial={previewAdmin.name[0]} />
    <main className="content-container admin-page">
      <div className="admin-toolbar"><h1 ref={heading} tabIndex={-1}>{page === "users" ? "User Accounts" : "System Health"}</h1>
        {page === "users" && <label className="admin-search" htmlFor="admin-search">Search by name or email<input id="admin-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" /></label>}
      </div>
      {startup.error && <p role="status">{startup.error}</p>}
      <p role="status" className="admin-notice">{notice}</p>
      {page === "users" ? <>
        <AdminStats metrics={metrics} preview />
        <p className="admin-metric-note">Active means not disabled and active in the last 30 days. Invitation week starts Monday at 00:00 UTC. Counts include all preview accounts, regardless of search.</p>
        <AdminUserTable users={users} search={search} adminId={previewAdmin._id} onAction={setConfirmation} preview />
      </> : <AdminUsageMetrics metrics={metrics} preview />}
      {confirmation && <ConfirmDialog title={`${confirmation.disabled ? "Disable" : "Re-enable"} account?`} confirmLabel={confirmation.disabled ? "Disable" : "Re-enable"} onCancel={() => setConfirmation(null)} onConfirm={confirm}>
        <p>{confirmation.disabled ? "Disable" : "Re-enable"} <strong>{confirmation.user.name}</strong> ({confirmation.user.email})?</p><p>This updates fictional account status in this browser only.</p>
      </ConfirmDialog>}
    </main>
  </>;
}
