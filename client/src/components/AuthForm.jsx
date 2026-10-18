import { useRef, useState } from "react";
import "../styles/auth.css";
import { validateAuth } from "../services/api.js";

function AuthForm({ mode, onNavigate, onAuthenticate, sessionMessage = "" }) {
  const isSignUp = mode === "signup";
  const [values, setValues] = useState({ name: "", email: "", password: "", role: "applicant" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const formRef = useRef(null);
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const fields = [
    ...(isSignUp ? [{ name: "name", label: "Full name", type: "text", autoComplete: "name" }] : []),
    { name: "email", label: "Email address", type: "email", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", autoComplete: isSignUp ? "new-password" : "current-password" },
  ];

  function updateField(event) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
    setMessage("");
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const nextErrors = validateAuth(mode, values);
    setErrors(nextErrors);
    setMessage("");
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      formRef.current.elements.namedItem(firstError)?.focus();
      return;
    }
    submitting.current = true;
    setLoading(true);
    try { await onAuthenticate(mode, values); }
    catch (error) { setMessage(error.message || "Unable to sign in. Please try again."); }
    finally {
      setValues((previous) => ({ ...previous, password: "" }));
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="auth-title">
        <h1 id="auth-title">{isSignUp ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-subtitle">{isSignUp ? "Takes less than a minute." : "Log in to continue to your board."}</p>
        <p className="auth-note">Invited mentors: {isSignUp ? "register as Mentor using the invited email address" : "log in with the invited Mentor account"}. You can review and accept invitations after signing in.</p>
        <form ref={formRef} onSubmit={submit} noValidate aria-busy={loading}>
          {sessionMessage && <p role="alert" className="auth-error">{sessionMessage}</p>}
          {fields.map(({ name, label, type, autoComplete }) => (
            <div className="auth-field" key={name}>
              <label htmlFor={`auth-${name}`}>{label}</label>
              <input
                id={`auth-${name}`}
                name={name}
                type={type}
                autoComplete={autoComplete}
                value={values[name]}
                onChange={updateField}
                required
                disabled={loading}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? `auth-${name}-error` : undefined}
              />
              {errors[name] && <p className="auth-error" id={`auth-${name}-error`} role="alert">{errors[name]}</p>}
            </div>
          ))}
          {isSignUp ? (
            <fieldset className="auth-roles">
              <legend>I am signing up as</legend>
              <div className="auth-roles__options">
                {["applicant", "mentor"].map((role) => (
                  <label key={role} className={values.role === role ? "auth-role auth-role--selected" : "auth-role"}>
                    <input disabled={loading} type="radio" name="role" value={role} checked={values.role === role} onChange={updateField} />
                    {role === "applicant" ? "Applicant" : "Mentor"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <button className="auth-link auth-recovery" type="button" onClick={() => setMessage("Password recovery is not connected yet.")}>
              Forgot password?
            </button>
          )}
          {errors.role && <p role="alert" className="auth-error">{errors.role}</p>}
          <button className="button auth-submit" type="submit" disabled={loading}>{loading ? "Please wait..." : isSignUp ? "Create account" : "Log in"}</button>
          <p className="auth-message" role="status">{message}</p>
        </form>
        <p className="auth-switch">
          {isSignUp ? "Already have an account? " : "New to Waypoint? "}
          <button className="auth-link" disabled={loading} onClick={() => onNavigate(isSignUp ? "login" : "signup")}>
            {isSignUp ? "Log in" : "Create an account"}
          </button>
        </p>
        {isSignUp && <p className="auth-note">Use at least 8 characters, including a letter and a number.</p>}
      </section>
    </main>
  );
}

export default AuthForm;
