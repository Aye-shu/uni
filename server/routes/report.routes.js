// server/routes/report.routes.js
import express from "express";
import mongoose from "mongoose";
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

// Student reports an issue
router.post("/", requireAuth, createReport);

// Driver reports a delay
router.post("/delay", requireAuth, authorize("driver"), reportDelay);

// Current user's own reports (drivers + students)
router.get("/my", requireAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const userId = String(req.user?.id || req.user?._id || req.user?.userId || "");
    if (!userId) {
      return res.status(401).json({ success: false, message: "No user id in session" });
    }

    const reports = await db.collection("delayreports")
      .find({ $or: [{ driver: userId }, { reportedBy: userId }] })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    res.json({ success: true, data: reports });
  } catch (err) {
    console.error("GET /reports/my error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin views all
router.get("/", requireAuth, authorize("admin"), getAllReports);
router.get("/pending", requireAuth, authorize("admin"), getPendingReports);
router.get("/daily", requireAuth, authorize("admin"), getDailyStats);
router.put("/:id", requireAuth, authorize("admin"), updateReportStatus);

export default router;
