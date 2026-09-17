import { requireRole } from "./role.middleware.js";

export const requireAdmin = requireRole("admin");

export default requireAdmin;