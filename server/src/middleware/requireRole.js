/**
 * FR-11: role-based access middleware. Use after requireAuth, which sets
 * req.userRole from the JWT. Example: router.get("/admin/users",
 * requireAuth, requireRole("admin"), handler).
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: `Requires role: ${allowedRoles.join(" or ")}.` });
    }
    next();
  };
}
