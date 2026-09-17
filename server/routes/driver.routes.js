import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import {
  getTodayTrips, getPassengerList, startTrip, endTrip,
  reportDelay, getLiveLocation,
} from "../controllers/driver.controller.js";

const router = express.Router();
router.use(protect, authorize("driver"));

router.get("/trips", getTodayTrips);
router.get("/trips/:id/passengers", getPassengerList);
router.put("/trips/:id/start", startTrip);
router.put("/trips/:id/end", endTrip);
router.get("/trips/:id/live", getLiveLocation);
router.post("/report-delay", reportDelay);

export default router;