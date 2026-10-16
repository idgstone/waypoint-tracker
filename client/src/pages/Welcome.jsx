import "../styles/auth.css";

function Welcome({ onNavigate }) {
  return (
    <main className="auth-layout">
      <section className="welcome" aria-labelledby="welcome-title">
        <p className="welcome__brand">Waypoint</p>
        <h1 id="welcome-title">Track every application, from apply to offer.</h1>
        <p className="welcome__description">
          One board for every job and internship you're applying to — deadlines,
          stages, and mentor feedback, all in one place.
        </p>
        <div className="welcome__actions">
          <button className="button" onClick={() => onNavigate("signup")}>Get Started</button>
          <button className="button button--secondary" onClick={() => onNavigate("login")}>
            I already have an account
          </button>
        </div>
        {import.meta.env.DEV && (
          <p className="auth-note">
            <button type="button" className="button button--secondary" onClick={() => onNavigate("preview")}>
              Preview Board
            </button>
          </p>
        )}
      </section>
    </main>
  );
}

export default Welcome;
