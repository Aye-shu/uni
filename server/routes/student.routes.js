// server/routes/student.routes.js
import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import {
  getClasses, addClass, updateClass, deleteClass,
  findBuses, bookSeat, getBookings, getBookingDetails,
  cancelBooking, bookReturnTrip,
} from "../controllers/student.controller.js";
import User from "../models/User.js";

const router = express.Router();
router.use(protect, authorize("student"));

/* ==================== Classes ==================== */
router.get("/classes", getClasses);
router.post("/classes", addClass);
router.put("/classes/:id", updateClass);
router.delete("/classes/:id", deleteClass);

/* ==================== Booking ==================== */
router.post("/find-bus", findBuses);
router.post("/book", bookSeat);
router.post("/book/return", bookReturnTrip);

router.get("/bookings", getBookings);
router.get("/bookings/:id", getBookingDetails);
router.put("/bookings/:id/cancel", cancelBooking);

/* ============================================================
   Profile + Preferences — uses User model (String _id, matches Better Auth)
============================================================ */

// GET /api/student/preferences
router.get("/preferences", async (req, res) => {
  try {
    // User._id is String — no conversion needed
    const user = await User.findById(req.user.id).lean();

    if (!user) {
      console.log("Preferences: user not found for id:", req.user.id);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      data: {
        year:        user.year        || "",
        phone:       user.phone       || "",
        address:     user.address     || "",
        preferences: user.preferences || {},
      },
    });
  } catch (err) {
    console.error("GET preferences error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/student/preferences
router.put("/preferences", async (req, res) => {
  try {
    const { year, phone, address, preferences } = req.body;

    const updates = {};
    if (year        !== undefined) updates.year        = year;
    if (phone       !== undefined) updates.phone       = phone;
    if (address     !== undefined) updates.address     = address;
    if (preferences !== undefined) updates.preferences = preferences;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Preferences updated" });
  } catch (err) {
    console.error("PUT preferences error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/student/profile
router.put("/profile", async (req, res) => {
  try {
    const { name, phone, address, department, studentId, year } = req.body;

    const updates = {};
    if (name       !== undefined) updates.name       = name;
    if (phone      !== undefined) updates.phone      = phone;
    if (address    !== undefined) updates.address    = address;
    if (department !== undefined) updates.department = department;
    if (studentId  !== undefined) updates.studentId  = studentId;
    if (year       !== undefined) updates.year       = year;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("PUT profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;