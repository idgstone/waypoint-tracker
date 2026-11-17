import { useState } from "react";
import { deletionUnavailable } from "../services/accountDeletion.js";
import AccountDeletionDialog from "./AccountDeletionDialog.jsx";
import "../styles/accountDeletion.css";

export default function DeleteAccountSection({ admin = false, target, disabled = false, available = false, scope, onDelete }) {
  const [open, setOpen] = useState(false);
  return <section className="account-deletion-section" aria-label={admin ? "Account deletion availability" : "Delete account"}>
    <h3>{admin ? "Account deletion" : "Delete account"}</h3>
    {admin ? <p>{deletionUnavailable}</p> : <>
      <p>Deleting your account is permanent and cannot be undone.</p>
      <button type="button" className="button button--danger" disabled={disabled || !target} aria-haspopup="dialog" onClick={() => setOpen(true)}>Delete account</button>
      {open && <AccountDeletionDialog target={target} scope={scope} available={available} onDelete={onDelete} onCancel={() => setOpen(false)} />}
    </>}
  </section>;
}
