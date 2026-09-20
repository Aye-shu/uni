// server/routes/student.routes.js
import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import {
  getClasses, addClass, updateClass, deleteClass,
  findBuses, bookSeat, getBookings, getBookingDetails,
  cancelBooking, bookReturnTrip,
} from "../controllers/student.controller.js";
import { MongoClient } from "mongodb";

const router = express.Router();
router.use(protect, authorize("student"));

/* ================= Classes ================= */
router.get("/classes", getClasses);
router.post("/classes", addClass);
router.put("/classes/:id", updateClass);
router.delete("/classes/:id", deleteClass);

/* ================= Booking ================= */
router.post("/find-bus", findBuses);
router.post("/book", bookSeat);
router.post("/book/return", bookReturnTrip);

router.get("/bookings", getBookings);
router.get("/bookings/:id", getBookingDetails);
router.put("/bookings/:id/cancel", cancelBooking);

/* ============================================================
   Profile + Preferences (added to fix 404 on /api/student/preferences)
============================================================ */

// GET /api/student/preferences
router.get("/preferences", async (req, res) => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const user = await client
      .db("uni")
      .collection("user")
      .findOne({ _id: req.user.id });
    await client.close();

    if (!user) {
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

    const updates = { updatedAt: new Date() };
    if (year        !== undefined) updates.year        = year;
    if (phone       !== undefined) updates.phone       = phone;
    if (address     !== undefined) updates.address     = address;
    if (preferences !== undefined) updates.preferences = preferences;

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    await client
      .db("uni")
      .collection("user")
      .updateOne({ _id: req.user.id }, { $set: updates });
    await client.close();

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

    const updates = { updatedAt: new Date() };
    if (name       !== undefined) updates.name       = name;
    if (phone      !== undefined) updates.phone      = phone;
    if (address    !== undefined) updates.address    = address;
    if (department !== undefined) updates.department = department;
    if (studentId  !== undefined) updates.studentId  = studentId;
    if (year       !== undefined) updates.year       = year;

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    await client
      .db("uni")
      .collection("user")
      .updateOne({ _id: req.user.id }, { $set: updates });
    await client.close();

    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("PUT profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;