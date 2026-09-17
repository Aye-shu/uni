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
} from "../controllers/trip.controller.js";

const router = express.Router();

router.get("/", getAllTrips);
router.get("/:id/seats", getTripSeats);          // ← MUST be before /:id
router.get("/:id/passengers", requireAuth, getTripPassengers);
router.get("/:id", getTripById);

router.post("/", requireAuth, authorize("admin"), createTrip);
router.put("/:id", requireAuth, authorize("admin"), updateTrip);
router.delete("/:id", requireAuth, authorize("admin"), deleteTrip);

export default router;