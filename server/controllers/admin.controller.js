// server/controllers/admin.controller.js
import User from "../models/User.js";
import Bus from "../models/Bus.js";
import Route from "../models/Route.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import DelayReport from "../models/DelayReport.js";
import { getAuth } from "../config/auth.js";
import mongoose from "mongoose";

// ==================== USERS ====================
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).lean();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== BUSES ====================
export const getBuses = async (req, res) => {
  try {
    const buses = await Bus.find({}).populate("currentDriver", "name email");
    res.json({ success: true, data: buses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createBus = async (req, res) => {
  try {
    const bus = await Bus.create(req.body);
    res.status(201).json({ success: true, data: bus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!bus) return res.status(404).json({ success: false, message: "Bus not found" });
    res.json({ success: true, data: bus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteBus = async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Bus deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== ROUTES ====================
export const getRoutes = async (req, res) => {
  try {
    const routes = await Route.find({}).populate("stops");
    res.json({ success: true, data: routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createRoute = async (req, res) => {
  try {
    const route = await Route.create(req.body);
    res.status(201).json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateRoute = async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteRoute = async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Route deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== TRIPS ====================
export const createTrip = async (req, res) => {
  try {
    const trip = await Trip.create(req.body);
    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== STATS ====================
export const getStats = async (req, res) => {
  try {
    const [totalUsers, totalBuses, totalRoutes, totalTrips, totalBookings, pendingReports] =
      await Promise.all([
        User.countDocuments(),
        Bus.countDocuments(),
        Route.countDocuments(),
        Trip.countDocuments({ status: { $ne: "cancelled" } }),
        Booking.countDocuments({ status: "confirmed" }),
        DelayReport.countDocuments({ status: "pending" }),
      ]);
    res.json({
      success: true,
      data: { totalUsers, totalBuses, totalRoutes, totalTrips, totalBookings, pendingReports },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== DRIVERS ====================

// GET /api/admin/drivers — list all drivers
export const getDrivers = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const drivers = await db.collection("user")
      .find({ role: "driver" })
      .project({ password: 0 })
      .toArray();
    res.json({ success: true, data: drivers });
  } catch (err) {
    console.error("getDrivers error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/drivers — create a driver account
export const createDriver = async (req, res) => {
  try {
    const { name, email, phone, licenseNumber, assignedBus, isActive = true, password } = req.body;

    console.log("📥 createDriver body:", { name, email, phone, licenseNumber, assignedBus, isActive, hasPassword: !!password });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const db = mongoose.connection.db;

    // Check existing user
    const existing = await db.collection("user").findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "A user with this email already exists" });
    }

    // Use Better Auth to create the user (handles password hashing)
    const auth = getAuth();
    let userId = null;

    try {
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: email.toLowerCase(),
          password,
          name,
          role: "driver",
        },
      });

      console.log("✅ Better Auth signUp result:", signUpResult);

      userId = signUpResult?.user?.id || signUpResult?.user?._id || null;

      if (!userId) {
        throw new Error("Better Auth returned no user ID");
      }
    } catch (baErr) {
      console.error("❌ Better Auth sign-up failed:", baErr);
      return res.status(500).json({
        success: false,
        message: "Account creation failed: " + baErr.message,
      });
    }

    // Update extra fields on the user document
    const updateData = {
      role: "driver",
      phone: phone || "",
      licenseNumber: licenseNumber || "",
      assignedBus: assignedBus ? new mongoose.Types.ObjectId(assignedBus) : null,
      isActive: !!isActive,
      updatedAt: new Date(),
    };

    await db.collection("user").updateOne({ _id: userId }, { $set: updateData });

    const newDriver = await db.collection("user").findOne({ _id: userId });

    console.log("✅ Driver created:", newDriver?.email);

    res.status(201).json({ success: true, data: newDriver });
  } catch (err) {
    console.error("❌ createDriver error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/admin/drivers/:id — update driver
export const updateDriver = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const { name, phone, licenseNumber, assignedBus, isActive } = req.body;

    const updates = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
    if (assignedBus !== undefined) {
      updates.assignedBus = assignedBus ? new mongoose.Types.ObjectId(assignedBus) : null;
    }
    if (isActive !== undefined) updates.isActive = !!isActive;

    const result = await db.collection("user").findOneAndUpdate(
      { _id: req.params.id, role: "driver" },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("updateDriver error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/admin/drivers/:id/reset-password
export const resetDriverPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const db = mongoose.connection.db;
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash(password, 10);

    const result = await db.collection("account").findOneAndUpdate(
      { userId: req.params.id, providerId: "credential" },
      { $set: { password: hash, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "Driver credentials not found" });
    }

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("resetDriverPassword error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/drivers/:id
export const deleteDriver = async (req, res) => {
  try {
    const db = mongoose.connection.db;

    // Remove driver user
    await db.collection("user").deleteOne({ _id: req.params.id, role: "driver" });
    // Remove credentials
    await db.collection("account").deleteMany({ userId: req.params.id });
    // Remove sessions
    await db.collection("session").deleteMany({ userId: req.params.id });
    // Unassign from any buses
    await db.collection("buses").updateMany(
      { currentDriver: req.params.id },
      { $set: { currentDriver: null } }
    );

    res.json({ success: true, message: "Driver deleted" });
  } catch (err) {
    console.error("deleteDriver error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};