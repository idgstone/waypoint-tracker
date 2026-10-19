import "../styles/header.css";

const applicantItems = [
  { id: "board", label: "Board" },
  { id: "analytics", label: "Analytics" },
  { id: "mentors", label: "Mentors" },
  { id: "settings", label: "Settings" },
];

function Header({ variant = "guest", activePage, onNavigate, userInitial = "J", accountControl }) {
  const isApplicant = variant === "applicant";
  const isMentor = variant === "mentor";
  const isAdmin = variant === "admin";
  const navigationItems = isAdmin ? [{ id: "users", label: "User Accounts" }, { id: "health", label: "System Health" }] : isMentor ? [{ id: "students", label: "My Students" }, { id: "mentorView", label: "Mentor View" }] : applicantItems;

  return (
    <header className="site-header">
      <div className="content-container site-header__inner">
        <span className="site-header__brand">Waypoint</span>
        <div className="site-header__actions">
        <nav aria-label={isAdmin ? "Admin navigation" : isMentor ? "Mentor navigation" : isApplicant ? "Main navigation" : "Account actions"}>
          {isApplicant || isMentor || isAdmin ? (
            <ul className="site-header__items">
              {navigationItems.map(({ id, label }) => (
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
        {(isApplicant || isMentor || isAdmin) && (
          accountControl || <span className="site-header__avatar" role="img" aria-label={`User initial: ${userInitial}`}>
            {userInitial}
          </span>
        )}
        </div>
      </div>
    </header>
  );
}

export default Header;
