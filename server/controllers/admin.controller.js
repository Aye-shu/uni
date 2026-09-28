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

// GET /api/admin/users/:id — fetch a single user
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    let user = await User.collection.findOne({ _id: id });

    if (!user) {
      try {
        user = await User.collection.findOne({
          _id: new mongoose.Types.ObjectId(id),
        });
      } catch { /* ignore — invalid ObjectId format */ }
    }

    if (!user) {
      console.log("getUserById: not found for id:", id);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    delete user.password;

    res.json({ success: true, data: user });
  } catch (err) {
    console.error("getUserById error:", err);
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

    console.log("📥 createDriver body:", {
      name, email, phone, licenseNumber, assignedBus, isActive, hasPassword: !!password,
    });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const db = mongoose.connection.db;
    const lowerEmail = String(email).toLowerCase().trim();

    const existing = await db.collection("user").findOne({ email: lowerEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: "A user with this email already exists" });
    }

    // Create user via Better Auth
    const auth = getAuth();
    let userId = null;

    try {
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: lowerEmail,
          password,
          name,
        },
      });

      userId = signUpResult?.user?.id || signUpResult?.user?._id || null;
      console.log("✅ Better Auth created user id:", userId);

      if (!userId) {
        throw new Error("Better Auth returned no user ID");
      }
    } catch (baErr) {
      console.error("❌ Better Auth sign-up failed:", baErr);
      return res.status(500).json({
        success: false,
        message: "Account creation failed: " + (baErr.message || "unknown"),
      });
    }

    // Cast to string (Better Auth uses String _id)
    const userIdStr = String(userId);

    // Safely handle assignedBus
    let assignedBusValue = null;
    if (assignedBus) {
      try {
        assignedBusValue = new mongoose.Types.ObjectId(String(assignedBus));
      } catch {
        assignedBusValue = null;
      }
    }

    const updateData = {
      role: "driver",
      phone: phone || "",
      licenseNumber: licenseNumber || "",
      assignedBus: assignedBusValue,
      isActive: !!isActive,
      updatedAt: new Date(),
    };

    // Update by String _id
    const updateResult = await db.collection("user").updateOne(
      { _id: userIdStr },
      { $set: updateData }
    );

    console.log("📝 Update by _id:", {
      matched: updateResult.matchedCount,
      modified: updateResult.modifiedCount,
    });

    // Fallback: match by email
    if (updateResult.matchedCount === 0) {
      const alt = await db.collection("user").updateOne(
        { email: lowerEmail },
        { $set: updateData }
      );
      console.log("🔁 Fallback update by email:", {
        matched: alt.matchedCount,
        modified: alt.modifiedCount,
      });
    }

    // Verify role
    const newDriver = await db.collection("user").findOne({ email: lowerEmail });
    console.log("✅ Final role in DB:", newDriver?.role);

    if (!newDriver) {
      return res.status(500).json({
        success: false,
        message: "Driver created but could not be read back",
      });
    }

    if (newDriver.role !== "driver") {
      return res.status(500).json({
        success: false,
        message: "Failed to set role=driver — current role: " + newDriver.role,
      });
    }

    delete newDriver.password;

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
    const id = String(req.params.id);

    console.log("🗑️ deleteDriver id:", id);

    // 1. Look up the user first
    let driver = await db.collection("user").findOne({ _id: id });

    // Fallback: try ObjectId
    if (!driver) {
      try {
        driver = await db.collection("user").findOne({
          _id: new mongoose.Types.ObjectId(id),
        });
      } catch { /* ignore */ }
    }

    if (!driver) {
      console.log("❌ Driver not found for id:", id);
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    console.log("🗑️ Found driver:", driver.email, "| role:", driver.role);

    const realId = String(driver._id);

    // 2. Delete the user
    const del = await db.collection("user").deleteOne({ _id: driver._id });
    console.log("✅ Deleted user count:", del.deletedCount);

    // 3. Clean up related collections
    await db.collection("account").deleteMany({ userId: realId });
    await db.collection("session").deleteMany({ userId: realId });

    // 4. Unassign from buses
    await db.collection("buses").updateMany(
      { currentDriver: driver._id },
      { $set: { currentDriver: null } }
    );
    // Also try String match for safety
    await db.collection("buses").updateMany(
      { currentDriver: realId },
      { $set: { currentDriver: null } }
    );

    res.json({ success: true, message: "Driver deleted" });
  } catch (err) {
    console.error("deleteDriver error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
