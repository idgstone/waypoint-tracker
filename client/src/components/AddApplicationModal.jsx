import { useEffect, useRef, useState } from "react";
import { applicationStages, localDate } from "../data/applicationStages.js";

function AddApplicationModal({ initialStage, onSave, onClose }) {
  const dialogRef = useRef(null);
  const submitted = useRef(false);
  const [values, setValues] = useState({ company: "", role: "", appliedDate: localDate(), deadline: "", reminder: false, notes: "", stage: initialStage });
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uncertain, setUncertain] = useState(false);

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector("input").focus();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  function change(event) {
    const { name, value, type, checked } = event.target;
    setValues((previous) => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
  }

  function keepFocusInside(event) {
    if (event.key !== "Tab") return;
    const controls = [...dialogRef.current.querySelectorAll("input, select, textarea, button")].filter((control) => !control.disabled);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (submitted.current) return;
    const nextErrors = {};
    if (!values.company.trim()) nextErrors.company = "Enter a company.";
    if (!values.role.trim()) nextErrors.role = "Enter a role.";
    if (!values.appliedDate) nextErrors.appliedDate = "Choose an applied date.";
    if (!applicationStages[values.stage]) nextErrors.stage = "Choose Offer or Rejected.";
    if (values.reminder && !values.deadline) nextErrors.deadline = "Choose a deadline to record a reminder preference.";
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      dialogRef.current.querySelector(`[name="${firstError}"]`).focus();
      return;
    }
    submitted.current = true;
    setPending(true);
    setSaveError("");
    try { await onSave({ ...values, company: values.company.trim(), role: values.role.trim() }); }
    catch (error) {
      setSaveError(error.creationUncertain ? `${error.message} Creation may have reached the server. Close this form and refresh the Board to check before creating again. Your draft remains here until closed.` : error.message);
      setUncertain(Boolean(error.creationUncertain));
    } finally { submitted.current = false; setPending(false); }
  }

  function field(name, label, type = "text", required = false, placeholder) {
    return <div className="application-field">
      <label htmlFor={`new-${name}`}>{label}{required && <span className="application-required"> *</span>}</label>
      <input id={`new-${name}`} name={name} type={type} placeholder={placeholder} value={values[name]} onChange={change} required={required} disabled={pending}
        aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `new-${name}-error` : undefined} />
      {errors[name] && <p className="application-error" id={`new-${name}-error`} role="alert">{errors[name]}</p>}
    </div>;
  }

  return (
    <dialog className="application-modal application-modal--add" ref={dialogRef} aria-labelledby="add-title" onKeyDown={keepFocusInside} onCancel={(event) => { event.preventDefault(); if (!submitted.current) onClose(); }}>
      <h2 id="add-title">Add New Application</h2>
      <form onSubmit={submit} noValidate aria-busy={pending}>
        {field("company", "Company", "text", true, "e.g. Optiver")}
        {field("role", "Role", "text", true, "e.g. SWE Intern")}
        <div className="application-date-fields">
          {field("appliedDate", "Applied Date", "date", true)}
          {field("deadline", "Deadline (Optional)", "date")}
        </div>
        {initialStage === "" && <div className="application-field">
          <label htmlFor="new-stage">Outcome<span className="application-required"> *</span></label>
          <select id="new-stage" name="stage" value={values.stage} onChange={change} disabled={pending} required aria-invalid={Boolean(errors.stage)} aria-describedby={errors.stage ? "new-stage-error" : undefined}>
            <option value="">Choose an outcome</option><option value="offer">Offer</option><option value="rejected">Rejected</option>
          </select>
          {errors.stage && <p className="application-error" id="new-stage-error" role="alert">{errors.stage}</p>}
        </div>}
        <label className="application-reminder" htmlFor="new-reminder"><input id="new-reminder" name="reminder" type="checkbox" role="switch" checked={values.reminder} onChange={change} disabled={pending} /> <span>Email me a reminder before this deadline</span></label>
        <div className="application-field"><label htmlFor="new-notes">Notes</label><textarea id="new-notes" name="notes" value={values.notes} onChange={change} disabled={pending} rows={2} placeholder="Recruiter contact, prep notes..." /></div>
        {saveError && <p role="alert" className="application-error">{saveError}</p>}
        <div className="application-actions"><button type="button" aria-disabled={pending} className="button button--secondary" onClick={() => { if (!submitted.current) onClose(); }}>Cancel</button><button type="submit" disabled={pending || uncertain} className="button">{pending ? "Saving..." : "Save Application"}</button></div>
      </form>
    </dialog>
  );
}

export default AddApplicationModal;
