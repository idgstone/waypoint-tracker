import "../styles/header.css";

const applicantItems = [
  { id: "board", label: "Board" },
  { id: "analytics", label: "Analytics" },
  { id: "mentors", label: "Mentors" },
  { id: "settings", label: "Settings" },
];

function Header({ variant = "guest", activePage, onNavigate, userInitial = "J" }) {
  const isApplicant = variant === "applicant";

  return (
    <header className="site-header">
      <div className="content-container site-header__inner">
        <span className="site-header__brand">Waypoint</span>
        <div className="site-header__actions">
        <nav aria-label={isApplicant ? "Main navigation" : "Account actions"}>
          {isApplicant ? (
            <ul className="site-header__items">
              {applicantItems.map(({ id, label }) => (
                <li key={id}>
                  <button
                    type="button"
                    className="site-header__nav-button"
                    aria-current={activePage === id ? "page" : undefined}
                    onClick={() => onNavigate?.(id)}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="site-header__items">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => onNavigate?.("login")}
              >
                Login
              </button>
              <button
                type="button"
                className="button"
                onClick={() => onNavigate?.("signup")}
              >
                Sign Up
              </button>
            </div>
          )}
        </nav>
        {isApplicant && (
          <span className="site-header__avatar" role="img" aria-label={`User initial: ${userInitial}`}>
            {userInitial}
          </span>
        )}
        </div>
      </div>
    </header>
  );
}

export default Header;
