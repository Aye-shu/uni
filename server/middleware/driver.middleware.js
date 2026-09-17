import { requireRole } from "./role.middleware.js";

export const requireDriver = requireRole("driver");

export default requireDriver;