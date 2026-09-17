// server/routes/booking.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
  deleteBooking,
} from "../controllers/booking.controller.js";

const router = express.Router();

// List / get
router.get("/", requireAuth, getAllBookings);
router.get("/:id", requireAuth, getBookingById);

// Create (students only)
router.post("/", requireAuth, authorize("student"), createBooking);

// Update
router.put("/:id", requireAuth, updateBooking);
router.put("/:id/cancel", requireAuth, cancelBooking);

// Delete (admin only)
router.delete("/:id", requireAuth, authorize("admin"), deleteBooking);

export default router;