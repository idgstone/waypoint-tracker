import { verifyToken } from "../lib/jwt.js";
import User from "../models/User.js";

const INACTIVITY_MS = Number(process.env.SESSION_INACTIVITY_MINUTES || 30) * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000; // don't write lastActiveAt more than once a minute

/**
 * FR-2 / NFR 5.2: verifies the session token and enforces session rules.
 * - Reads `Authorization: Bearer <token>`.
 * - Rejects disabled accounts immediately (FR-13, UC-7: "access reflects
 *   the change on their next request").
 * - Rejects tokens issued before the last logout (tokenVersion).
 * - Expires the session after SESSION_INACTIVITY_MINUTES of no requests.
 * Sets req.userId and req.userRole (role read from the DB, not the token,
 * so a role change takes effect immediately).
 */
export async function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  const user = await User.findById(payload.sub).select("role disabled tokenVersion lastActiveAt");
  if (!user) {
    return res.status(401).json({ error: "Account no longer exists." });
  }
  if (user.disabled) {
    return res.status(403).json({ error: "This account has been disabled." });
  }
  if ((payload.tv ?? 0) !== user.tokenVersion) {
    return res.status(401).json({ error: "Session has ended. Please log in again." });
  }

  const now = Date.now();
  const lastActive = user.lastActiveAt ? user.lastActiveAt.getTime() : now;
  if (now - lastActive > INACTIVITY_MS) {
    return res.status(401).json({ error: "Session expired due to inactivity. Please log in again." });
  }
  if (now - lastActive > TOUCH_INTERVAL_MS) {
    await User.updateOne({ _id: user._id }, { lastActiveAt: new Date(now) });
  }

  req.userId = String(user._id);
  req.userRole = user.role;
  next();
}
