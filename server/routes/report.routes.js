// server/routes/report.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  reportDelay,
  getAllReports,
  getPendingReports,
  getDailyStats,
  updateReportStatus,
  createReport,
} from "../controllers/report.controller.js";

const router = express.Router();

// Student reports an issue (also works for drivers)
router.post("/", requireAuth, createReport);

// Driver reports delay
router.post("/delay", requireAuth, authorize("driver"), reportDelay);

// Admin views and manages
router.get("/", requireAuth, authorize("admin"), getAllReports);
router.get("/pending", requireAuth, authorize("admin"), getPendingReports);
router.get("/daily", requireAuth, authorize("admin"), getDailyStats);
router.put("/:id", requireAuth, authorize("admin"), updateReportStatus);

export default router;