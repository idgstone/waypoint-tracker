export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

// One client instance owns the token. Preview storage is never read here.
export function createApi({ fetcher = (...args) => fetch(...args), storage = () => window.sessionStorage } = {}) {
  const key = "waypoint.auth.token.v1";
  let token = null;
  let sessionVersion = 0;
  let authAttempt = 0;
  let onSessionEnded = () => {};
  let onActivity = () => {};
  let storageWarning = "";
  try { token = storage().getItem(key); } catch { /* Memory-only session remains available. */ }
  function setToken(value) {
    sessionVersion++;
    authAttempt++;
    token = value;
    storageWarning = "";
    try { if (value) storage().setItem(key, value); else storage().removeItem(key); }
    catch { storageWarning = "Browser session storage is unavailable. This session will not survive a refresh."; }
  }
  async function request(path, { method = "GET", body, protectedRequest = true, signal } = {}) {
    const version = sessionVersion;
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (protectedRequest && token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetcher(`/api${path}`, { method, headers, signal, cache: "no-store", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw new ApiError("Cannot reach Waypoint. Check your connection and that the backend is running, then try again."); }
    let data = null;
    if (response.status !== 204) {
      try { data = await response.json(); } catch { /* Report malformed responses without exposing request data. */ }
    }
    if (protectedRequest && version !== sessionVersion) throw new ApiError("Session changed. This response was discarded.", 499);
    if (!response.ok) {
      const message = typeof data?.error === "string" ? data.error : "The server could not complete the request. Please try again.";
      if (protectedRequest && (response.status === 401 || (response.status === 403 && /account has been disabled/i.test(message)))) {
        setToken(null);
        onSessionEnded(message);
      }
      throw new ApiError(message, response.status);
    }
    if (response.status !== 204 && data === null) throw new ApiError("The server returned an unreadable response. Please try again.");
    if (protectedRequest) onActivity();
    return data;
  }
  function validUser(user) {
    return user && typeof user.id === "string" && typeof user.name === "string" && typeof user.email === "string" && ["applicant", "mentor", "admin"].includes(user.role);
  }
  return {
    request,
    hasToken: () => Boolean(token),
    cancelAuthentication() { authAttempt++; },
    clear: () => setToken(null),
    storageWarning: () => storageWarning,
    onSessionEnded(callback) { onSessionEnded = callback; },
    onActivity(callback) { onActivity = callback; },
    async authenticate(mode, values) {
      const attempt = ++authAttempt;
      const version = sessionVersion;
      const body = mode === "signup"
        ? { name: values.name.trim(), email: values.email.trim(), password: values.password, role: values.role }
        : { email: values.email.trim(), password: values.password };
      const result = await request(mode === "signup" ? "/auth/register" : "/auth/login", { method: "POST", body, protectedRequest: false });
      if (attempt !== authAttempt || version !== sessionVersion) throw new ApiError("This sign-in request is no longer current. Please try again.", 499);
      if (!validUser(result?.user) || typeof result.token !== "string" || !result.token) throw new ApiError("The server returned an invalid session. Please try logging in again.");
      setToken(result.token);
      return result.user;
    },
    async me() {
      const user = await request("/auth/me");
      if (!validUser(user)) throw new ApiError("The server returned an invalid profile. Please try again.");
      return user;
    },
    async logout() { await request("/auth/logout", { method: "POST" }); setToken(null); },
  };
}

export function validateAuth(mode, values) {
  const errors = {};
  if (mode === "signup" && !values.name.trim()) errors.name = "Enter your full name.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!values.password) errors.password = "Enter your password.";
  else if (mode === "signup" && (values.password.length < 8 || !/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password))) errors.password = "Password must be at least 8 characters and include a letter and a number.";
  if (mode === "signup" && !["applicant", "mentor"].includes(values.role)) errors.role = "Choose Applicant or Mentor.";
  return errors;
}
