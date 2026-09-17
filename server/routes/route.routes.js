// server/routes/route.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  addStopToRoute,
} from "../controllers/route.controller.js";

const router = express.Router();

// Public read
router.get("/", getAllRoutes);
router.get("/:id", getRouteById);

// Admin only
router.post("/", requireAuth, authorize("admin"), createRoute);
router.put("/:id", requireAuth, authorize("admin"), updateRoute);
router.delete("/:id", requireAuth, authorize("admin"), deleteRoute);
router.post("/:id/stops", requireAuth, authorize("admin"), addStopToRoute);

export default router;