// server/routes/notification.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  getMyNotifications,
  getUnreadNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", requireAuth, getMyNotifications);
router.get("/unread", requireAuth, getUnreadNotifications);
router.put("/read-all", requireAuth, markAllAsRead);
router.put("/:id/read", requireAuth, markAsRead);
router.delete("/:id", requireAuth, deleteNotification);

// Admin can create
router.post("/", requireAuth, authorize("admin"), createNotification);

export default router;