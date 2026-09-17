// server/routes/tracking.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  getTripLocation,
  updateTripLocation,
  getAllLiveBuses,
} from "../controllers/tracking.controller.js";

const router = express.Router();

// Public — students tracking buses
router.get("/buses", getAllLiveBuses);
router.get("/trip/:tripId", getTripLocation);

// Driver updates location
router.put("/trip/:tripId", requireAuth, authorize("driver"), updateTripLocation);

export default router;