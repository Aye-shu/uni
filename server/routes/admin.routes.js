// server/routes/admin.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  // Existing
  getUsers, updateUser, deleteUser,
  getBuses, createBus, updateBus, deleteBus,
  getRoutes, createRoute, updateRoute, deleteRoute,
  createTrip,
  getStats,
  // NEW — drivers
  getDrivers, createDriver, updateDriver, resetDriverPassword, deleteDriver,
} from "../controllers/admin.controller.js";

const router = express.Router();

// All admin routes require admin role
router.use(requireAuth, authorize("admin"));

// ---------- Users ----------
router.get("/users", getUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// ---------- Buses ----------
router.get("/buses", getBuses);
router.post("/buses", createBus);
router.put("/buses/:id", updateBus);
router.delete("/buses/:id", deleteBus);

// ---------- Routes ----------
router.get("/routes", getRoutes);
router.post("/routes", createRoute);
router.put("/routes/:id", updateRoute);
router.delete("/routes/:id", deleteRoute);

// ---------- Trips ----------
router.post("/trips", createTrip);

// ---------- Drivers ----------
router.get("/drivers", getDrivers);
router.post("/drivers", createDriver);
router.put("/drivers/:id", updateDriver);
router.put("/drivers/:id/reset-password", resetDriverPassword);
router.delete("/drivers/:id", deleteDriver);

// ---------- Stats ----------
router.get("/stats", getStats);

export default router;