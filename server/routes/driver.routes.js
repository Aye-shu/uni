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
   Profile — driver reads/updates own profile (match by email)
============================================================ */

function getEmail(req) {
  const u = req.user || {};
  return (u.email || u.user?.email || "").toLowerCase().trim();
}

// GET /api/driver/profile
router.get("/profile", async (req, res) => {
  let client;
  try {
    const email = getEmail(req);
    if (!email) {
      return res.status(401).json({ success: false, message: "No email in session" });
    }

    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const user = await client
      .db("uni")
      .collection("user")
      .findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", email });
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
  } finally {
    if (client) await client.close();
  }
});

// PUT /api/driver/profile
router.put("/profile", async (req, res) => {
  let client;
  try {
    const email = getEmail(req);
    if (!email) {
      return res.status(401).json({ success: false, message: "No email in session" });
    }

    const { phone, address, emergencyName, emergencyPhone } = req.body;

    const updates = { updatedAt: new Date() };
    if (phone          !== undefined) updates.phone          = phone;
    if (address        !== undefined) updates.address        = address;
    if (emergencyName  !== undefined) updates.emergencyName  = emergencyName;
    if (emergencyPhone !== undefined) updates.emergencyPhone = emergencyPhone;

    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const result = await client
      .db("uni")
      .collection("user")
      .updateOne({ email }, { $set: updates });

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found", email });
    }

    res.json({
      success: true,
      message: "Profile updated",
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (err) {
    console.error("PUT driver profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (client) await client.close();
  }
});

export default router;
