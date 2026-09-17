import { requireRole } from "./role.middleware.js";

export const requireStudent = requireRole("student");

export default requireStudent;