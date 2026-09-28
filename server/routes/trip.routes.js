// server/routes/trip.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  getAllTrips,
  getTripById,
  getTripPassengers,
  getTripSeats,
  createTrip,
  updateTrip,
  deleteTrip,
  deleteAllTrips,
} from "../controllers/trip.controller.js";

const router = express.Router();

// ⚠️ Bulk delete MUST come BEFORE /:id, otherwise "all" is treated as an id
router.delete("/all", requireAuth, authorize("admin"), deleteAllTrips);

router.get("/", getAllTrips);
router.get("/:id/seats", getTripSeats);          // ← MUST be before /:id
router.get("/:id/passengers", requireAuth, getTripPassengers);
router.get("/:id", getTripById);

router.post("/", requireAuth, authorize("admin"), createTrip);
router.put("/:id", requireAuth, authorize("admin"), updateTrip);
router.delete("/:id", requireAuth, authorize("admin"), deleteTrip);

export default router;
