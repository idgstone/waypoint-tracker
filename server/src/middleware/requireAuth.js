/**
 * TEMPORARY auth stub so FR-3/4/5/11 routes can be built and tested before
 * Michael's JWT auth (FR-1/FR-2) lands. Reads a user id from the
 * `x-user-id` header and attaches it as req.userId.
 *
 * TODO(Michael): replace this with real JWT verification
 * (read Authorization: Bearer <token>, verify with JWT_SECRET, set
 * req.userId from the token payload). Once that's merged, delete this
 * file and update the route imports.
 */
export function requireAuth(req, res, next) {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id header (temporary auth stub)." });
  }
  req.userId = userId;
  next();
}
