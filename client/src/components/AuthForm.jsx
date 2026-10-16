import { useRef, useState } from "react";
import "../styles/auth.css";

function AuthForm({ mode, onNavigate }) {
  const isSignUp = mode === "signup";
  const [values, setValues] = useState({ name: "", email: "", password: "", role: "applicant" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const formRef = useRef(null);
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

  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (isSignUp && !values.name.trim()) nextErrors.name = "Enter your full name.";
    if (!values.email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address, such as name@example.com.";
    }
    if (!values.password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    setMessage("");
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      formRef.current.elements.namedItem(firstError).focus();
      return;
    }
    setValues((previous) => ({ ...previous, password: "" }));
    setMessage(isSignUp
      ? "Backend connection is pending. No account was created."
      : "Backend connection is pending. You have not been logged in.");
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="auth-title">
        <h1 id="auth-title">{isSignUp ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-subtitle">{isSignUp ? "Takes less than a minute." : "Log in to continue to your board."}</p>
        <form ref={formRef} onSubmit={submit} noValidate>
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
                    <input type="radio" name="role" value={role} checked={values.role === role} onChange={updateField} />
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
          <button className="button auth-submit" type="submit">{isSignUp ? "Create account" : "Log in"}</button>
          <p className="auth-message" role="status">{message}</p>
        </form>
        <p className="auth-switch">
          {isSignUp ? "Already have an account? " : "New to Waypoint? "}
          <button className="auth-link" onClick={() => onNavigate(isSignUp ? "login" : "signup")}>
            {isSignUp ? "Log in" : "Create an account"}
          </button>
        </p>
        {isSignUp && <p className="auth-note">Password requirements must be confirmed with the backend developer.</p>}
      </section>
    </main>
  );
}

export default AuthForm;
