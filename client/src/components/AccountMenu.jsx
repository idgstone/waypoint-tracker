import { useEffect, useRef, useState } from "react";

export default function AccountMenu({ user, onLogout, pending, error, warning, onSettings }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    function outside(event) { if (!root.current?.contains(event.target)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="account-menu" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className="account-menu__trigger" aria-label={`Open account menu for ${user.name}`} aria-expanded={open} aria-controls="mentor-account-menu" onClick={() => setOpen(!open)}><span className="account-menu__name">{user.name}</span><span className="site-header__avatar" aria-hidden="true">{Array.from(user.name.trim())[0]?.toUpperCase() || "?"}</span></button>
    {open && <section id="mentor-account-menu" className="account-menu__panel" aria-label="Account">
      <strong>{user.name}</strong><p>{user.email}</p>
      {warning && <p role="status">{warning}</p>}{error && <p role="alert">{error}</p>}
      {onSettings && <button type="button" className="button button--secondary" onClick={() => { setOpen(false); onSettings(); }}>Settings</button>}
      <button type="button" className="button button--secondary" disabled={pending} onClick={onLogout}>{pending ? "Logging out..." : "Log out"}</button>
    </section>}
  </div>;
}
