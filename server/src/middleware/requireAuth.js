import { verifyToken } from "../lib/jwt.js";

/**
 * FR-2: verifies the session token issued at login/register.
 * Reads `Authorization: Bearer <token>`, sets req.userId and req.userRole.
 */
export function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}
