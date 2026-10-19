import { useEffect, useState } from "react";
import { scheduleNoticeDismiss } from "../services/actionNotice.js";

export function useActionNotice() {
  const [notice, setNotice] = useState({ text: "", persistent: false });
  function show(text, options = {}) { setNotice({ text, persistent: Boolean(options.persistent) }); }
  return [notice, show, () => show("")];
}

export default function ActionNotice({ notice, onDismiss }) {
  useEffect(() => scheduleNoticeDismiss(notice, onDismiss), [notice]);
  return <div className="action-notice" role="status" aria-live="polite" aria-atomic="true">
    {notice.text && <><span>{notice.text}</span><button type="button" className="auth-link" onClick={onDismiss} aria-label="Dismiss notification">Dismiss</button></>}
  </div>;
}
