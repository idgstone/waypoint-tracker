import { useEffect, useRef, useState } from "react";

function ApplicationActions({ application, onOpen, onDelete, disabled = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const menuId = `actions-${application.id}`;
  useEffect(() => {
    if (!open) return;
    menu.current.querySelector("button").focus();
    function outside(event) { if (!root.current.contains(event.target)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close() { setOpen(false); trigger.current.focus(); }
  function keyDown(event) {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = [...menu.current.querySelectorAll("button")];
      const current = items.indexOf(document.activeElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[index].focus();
    }
  }
  return <div className="application-actions-menu" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" disabled={disabled} className="application-actions-trigger" aria-label={`Actions for ${application.role} at ${application.company}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => setOpen((previous) => !previous)} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}>⋯</button>
    {open && <div ref={menu} id={menuId} role="menu" aria-label={`Application actions for ${application.company}`} className="application-menu" onKeyDown={keyDown}>
      <button role="menuitem" tabIndex={-1} type="button" onClick={() => { close(); onOpen(application.id); }}>View details</button>
      <button role="menuitem" tabIndex={-1} type="button" onClick={() => { close(); onDelete(application); }}>Delete application</button>
    </div>}
  </div>;
}

export default ApplicationActions;
