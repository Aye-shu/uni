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
   Lookup helper — try ID, then email, then return null
============================================================ */
async function findCurrentUser(req) {
  const u = req.user || {};
  const id = u.id || u._id || u.userId || u.user?.id;
  const email = u.email || u.user?.email;

  console.log("🔍 findCurrentUser — id:", id, "| email:", email);

  // Try by ID first
  if (id) {
    const byId = await User.findById(id).lean();
    if (byId) {
      console.log("✅ Found by ID");
      return byId;
    }
  }

  // Fallback: by email
  if (email) {
    const byEmail = await User.findOne({ email }).lean();
    if (byEmail) {
      console.log("✅ Found by EMAIL");
      return byEmail;
    }
  }

  console.log("❌ Not found by ID or email");
  return null;
}

/* ==================== GET /preferences ==================== */
router.get("/preferences", async (req, res) => {
  try {
    const user = await findCurrentUser(req);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        debug: { user: req.user },
      });
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

/* ==================== PUT /preferences ==================== */
router.put("/preferences", async (req, res) => {
  try {
    const user = await findCurrentUser(req);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { year, phone, address, preferences } = req.body;
    const updates = {};
    if (year        !== undefined) updates.year        = year;
    if (phone       !== undefined) updates.phone       = phone;
    if (address     !== undefined) updates.address     = address;
    if (preferences !== undefined) updates.preferences = preferences;

    await User.updateOne({ _id: user._id }, { $set: updates });

    res.json({ success: true, message: "Preferences updated" });
  } catch (err) {
    console.error("PUT preferences error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ==================== PUT /profile ==================== */
router.put("/profile", async (req, res) => {
  try {
    const user = await findCurrentUser(req);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { name, phone, address, department, studentId, year } = req.body;
    const updates = {};
    if (name       !== undefined) updates.name       = name;
    if (phone      !== undefined) updates.phone      = phone;
    if (address    !== undefined) updates.address    = address;
    if (department !== undefined) updates.department = department;
    if (studentId  !== undefined) updates.studentId  = studentId;
    if (year       !== undefined) updates.year       = year;

    await User.updateOne({ _id: user._id }, { $set: updates });

    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("PUT profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;