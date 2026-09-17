// server/controllers/student.controller.js
import ClassSchedule from "../models/ClassSchedule.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";

// ---------- CLASS SCHEDULE ----------
export const getClasses = async (req, res) => {
  try {
    const classes = await ClassSchedule.find({ student: req.user.id });
    res.json({ success: true, data: classes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addClass = async (req, res) => {
  try {
    const newClass = await ClassSchedule.create({
      ...req.body,
      student: req.user.id,
    });
    res.status(201).json({ success: true, data: newClass });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateClass = async (req, res) => {
  try {
    const updated = await ClassSchedule.findOneAndUpdate(
      { _id: req.params.id, student: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Class not found" });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteClass = async (req, res) => {
  try {
    const deleted = await ClassSchedule.findOneAndDelete({
      _id: req.params.id,
      student: req.user.id,
    });
    if (!deleted) return res.status(404).json({ success: false, message: "Class not found" });
    res.json({ success: true, message: "Class deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- FIND BUS / RECOMMENDATION ----------
export const findBuses = async (req, res) => {
  try {
    const { day, endTime, direction = "outbound", date } = req.body;

    // Validate input
    if (!day || !endTime) {
      return res.status(400).json({ success: false, message: "day and endTime are required" });
    }

    // Find all scheduled trips for that day & direction
    const trips = await Trip.find({
      day,
      direction,
      status: { $in: ["scheduled", "delayed"] },
    })
      .populate("bus")
      .populate("route")
      .sort({ departureTime: 1 });

    // Recommend trips whose departure is after class ends
    const recommendations = trips
      .filter((t) => t.availableSeats > 0 && t.departureTime >= endTime)
      .map((t) => ({
        ...t.toObject(),
        isRecommended: t.departureTime ===
          trips
            .filter((x) => x.availableSeats > 0 && x.departureTime >= endTime)
            .sort((a, b) => a.departureTime.localeCompare(b.departureTime))[0]?.departureTime,
      }));

    res.json({
      success: true,
      data: recommendations,
      recommendation: recommendations[0] || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- BOOKINGS ----------
export const bookSeat = async (req, res) => {
  try {
    const { tripId, seatNumber, pickupStop, dropoffStop, isReturn = false, originalBooking } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.status !== "scheduled")
      return res.status(400).json({ success: false, message: "Trip not available" });
    if (trip.availableSeats <= 0)
      return res.status(400).json({ success: false, message: "No seats available" });

    // Check seat not already booked
    const seatTaken = await Booking.findOne({
      trip: tripId,
      seatNumber,
      status: "confirmed",
    });
    if (seatTaken)
      return res.status(400).json({ success: false, message: "Seat already booked" });

    const bookingId = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const booking = await Booking.create({
      bookingId,
      student: req.user.id,
      trip: tripId,
      bus: trip.bus,
      route: trip.route,
      pickupStop,
      dropoffStop,
      seatNumber,
      travelDate: trip.date,
      isReturn,
      originalBooking: originalBooking || null,
      fare: 50,
      status: "confirmed",
    });

    // Update trip seats + bookings
    trip.bookings.push(booking._id);
    trip.availableSeats -= 1;
    await trip.save();

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ student: req.user.id })
      .populate("trip")
      .populate("bus")
      .populate("route")
      .populate("pickupStop")
      .populate("dropoffStop")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getBookingDetails = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, student: req.user.id })
      .populate("trip")
      .populate("bus")
      .populate("route")
      .populate("pickupStop")
      .populate("dropoffStop");
    if (!booking) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, student: req.user.id });
    if (!booking) return res.status(404).json({ success: false, message: "Not found" });
    if (booking.status === "cancelled")
      return res.status(400).json({ success: false, message: "Already cancelled" });

    booking.status = "cancelled";
    booking.cancellationReason = req.body.cancellationReason || "User cancelled";
    booking.cancelledAt = new Date();
    await booking.save();

    const trip = await Trip.findById(booking.trip);
    if (trip) {
      trip.availableSeats += 1;
      trip.bookings = trip.bookings.filter((id) => id.toString() !== booking._id.toString());
      await trip.save();
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const bookReturnTrip = async (req, res) => {
  req.body.isReturn = true;
  return bookSeat(req, res);
};