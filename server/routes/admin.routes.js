// server/routes/admin.routes.js
import express from "express";
import mongoose from "mongoose";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  // Users
  getUsers, getUserById, updateUser, deleteUser,

  // Buses
  getBuses, createBus, updateBus, deleteBus,

  // Routes
  getRoutes, createRoute, updateRoute, deleteRoute,

  // Trips
  createTrip,

  // Stats
  getStats,

  // Drivers
  getDrivers, createDriver, updateDriver, resetDriverPassword, deleteDriver,
} from "../controllers/admin.controller.js";

const router = express.Router();

// All admin routes require admin role
router.use(requireAuth, authorize("admin"));

/* ==================== Self (current admin) ==================== */
router.get("/me", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const email = (req.user?.email || req.user?.user?.email || "").toLowerCase().trim();
    if (!email) return res.status(401).json({ success: false, message: "No email in session" });

    const user = await db.collection("user").findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found", email });

    delete user.password;
    res.json({ success: true, data: user });
  } catch (err) {
    console.error("GET /admin/me error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/me", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const email = (req.user?.email || req.user?.user?.email || "").toLowerCase().trim();
    if (!email) return res.status(401).json({ success: false, message: "No email in session" });

    const { name, phone, address } = req.body;
    const updates = { updatedAt: new Date() };
    if (name    !== undefined) updates.name    = name;
    if (phone   !== undefined) updates.phone   = phone;
    if (address !== undefined) updates.address = address;

    const result = await db.collection("user").updateOne({ email }, { $set: updates });
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
    console.error("PUT /admin/me error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ==================== Users ==================== */
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

/* ==================== Buses ==================== */
router.get("/buses", getBuses);
router.post("/buses", createBus);
router.put("/buses/:id", updateBus);
router.delete("/buses/:id", deleteBus);

/* ==================== Routes ==================== */
router.get("/routes", getRoutes);
router.post("/routes", createRoute);
router.put("/routes/:id", updateRoute);
router.delete("/routes/:id", deleteRoute);

/* ==================== Trips ==================== */
router.post("/trips", createTrip);

/* ==================== Drivers ==================== */
router.get("/drivers", getDrivers);
router.post("/drivers", createDriver);
router.put("/drivers/:id", updateDriver);
router.put("/drivers/:id/reset-password", resetDriverPassword);
router.delete("/drivers/:id", deleteDriver);

/* ==================== Stats ==================== */
router.get("/stats", getStats);

export default router;
