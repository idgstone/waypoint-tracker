const routes = {
  applicant: { board: "/board", analytics: "/analytics", mentors: "/mentors", settings: "/settings" },
  mentor: { students: "/mentor/students", mentorView: "/mentor/view" },
  admin: { users: "/admin/users", health: "/admin/health" },
};
export function dashboardPath(role, page) {
  const pages = routes[role];
  return pages?.[page] || Object.values(pages || {})[0] || "/login";
}
export function dashboardPage(role, pathname) {
  return Object.entries(routes[role] || {}).find(([, path]) => path === pathname)?.[0] || Object.keys(routes[role] || {})[0];
}
export function isDashboardPath(pathname) {
  return Object.values(routes).some((pages) => Object.values(pages).includes(pathname));
}
// Canonicalize only after session restoration. Role checks remain on the server.
export function sessionPath(pathname, user, restoring) {
  if (restoring) return pathname;
  if (user) return dashboardPath(user.role, dashboardPage(user.role, pathname));
  return isDashboardPath(pathname) ? "/login" : ["/", "/login", "/signup"].includes(pathname) ? pathname : "/";
}
export function writePath(history, location, path, replace = false) {
  if (location.pathname === path) return;
  history[replace ? "replaceState" : "pushState"]({}, "", path);
}
