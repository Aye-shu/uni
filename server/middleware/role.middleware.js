export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }

    next();
  };
};

export const requireStudent = requireRole("student");
export const requireDriver = requireRole("driver");
export const requireAdmin = requireRole("admin");

export default requireRole;