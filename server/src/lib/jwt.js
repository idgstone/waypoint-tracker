import jwt from "jsonwebtoken";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.");
  return s;
}

/** Issues a session token carrying userId + role (FR-2, used by FR-11 role checks). */
export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, secret(), { expiresIn: "7d" });
}

/** Throws if the token is missing/expired/invalid; otherwise returns the payload. */
export function verifyToken(token) {
  return jwt.verify(token, secret());
}
