export function publicScreen(pathname) {
  return pathname === "/login" ? "login" : pathname === "/signup" ? "signup" : "welcome";
}

export function publicPath(screen) {
  return screen === "login" ? "/login" : screen === "signup" ? "/signup" : "/";
}
