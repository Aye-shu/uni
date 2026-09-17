import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import {
  getClasses, addClass, updateClass, deleteClass,
  findBuses, bookSeat, getBookings, getBookingDetails,
  cancelBooking, bookReturnTrip,
} from "../controllers/student.controller.js";

const router = express.Router();
router.use(protect, authorize("student"));

router.get("/classes", getClasses);
router.post("/classes", addClass);
router.put("/classes/:id", updateClass);
router.delete("/classes/:id", deleteClass);

router.post("/find-bus", findBuses);
router.post("/book", bookSeat);
router.post("/book/return", bookReturnTrip);

router.get("/bookings", getBookings);
router.get("/bookings/:id", getBookingDetails);
router.put("/bookings/:id/cancel", cancelBooking);

export default router;