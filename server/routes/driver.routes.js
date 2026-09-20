// server/routes/driver.routes.js
import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import { MongoClient } from "mongodb";
import {
  getTodayTrips, getPassengerList, startTrip, endTrip,
  reportDelay, getLiveLocation,
} from "../controllers/driver.controller.js";

const router = express.Router();
router.use(protect, authorize("driver"));

/* ================= Trips ================= */
router.get("/trips", getTodayTrips);
router.get("/trips/:id/passengers", getPassengerList);
router.put("/trips/:id/start", startTrip);
router.put("/trips/:id/end", endTrip);
router.get("/trips/:id/live", getLiveLocation);

/* ================= Reports ================= */
router.post("/report-delay", reportDelay);

/* ============================================================
   Profile (NEW) — driver updates their own profile
============================================================ */

// GET /api/driver/profile
router.get("/profile", async (req, res) => {
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
        name:            user.name            || "",
        email:           user.email           || "",
        phone:           user.phone           || "",
        address:         user.address         || "",
        licenseNumber:   user.licenseNumber   || "",
        assignedBus:     user.assignedBus     || null,
        emergencyName:   user.emergencyName   || "",
        emergencyPhone:  user.emergencyPhone  || "",
        createdAt:       user.createdAt       || null,
        isActive:        user.isActive !== false,
      },
    });
  } catch (err) {
    console.error("GET driver profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/driver/profile
router.put("/profile", async (req, res) => {
  try {
    const { phone, address, emergencyName, emergencyPhone } = req.body;

    const updates = { updatedAt: new Date() };
    if (phone          !== undefined) updates.phone          = phone;
    if (address        !== undefined) updates.address        = address;
    if (emergencyName  !== undefined) updates.emergencyName  = emergencyName;
    if (emergencyPhone !== undefined) updates.emergencyPhone = emergencyPhone;

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    await client
      .db("uni")
      .collection("user")
      .updateOne({ _id: req.user.id }, { $set: updates });
    await client.close();

    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("PUT driver profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;