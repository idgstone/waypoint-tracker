import jwt from "jsonwebtoken";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.");
  return s;
}

/**
 * Issues a session token carrying userId, role and tokenVersion (FR-2).
 * The 1-day expiry is only a hard cap; the real session rules (inactivity
 * timeout, logout invalidation) are enforced in middleware/requireAuth.js.
 */
export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 },
    secret(),
    { expiresIn: "1d" }
  );
}

/** Throws if the token is missing/expired/invalid; otherwise returns the payload. */
export function verifyToken(token) {
  return jwt.verify(token, secret());
}
