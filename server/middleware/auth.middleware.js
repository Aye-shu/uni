// server/middleware/auth.middleware.js
import { getAuth } from "../config/auth.js";

// Convert Express req.headers (plain object) → Web Headers (required by Better Auth)
const toWebHeaders = (expressHeaders) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(expressHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, String(v)));
    } else {
      headers.set(key, String(value));
    }
  }
  return headers;
};

// ---------- AUTH CHECK ----------
export const requireAuth = async (req, res, next) => {
  try {
    const auth = getAuth();
    const headers = toWebHeaders(req.headers);
    const session = await auth.api.getSession({ headers });

    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// Alias so existing route files using `protect` keep working
export const protect = requireAuth;

// ---------- ROLE CHECK ----------
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

// Alias so existing route files using `authorize("student")` keep working
export const authorize = (...roles) => requireRole(...roles);

export default requireAuth;