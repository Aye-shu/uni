// server/controllers/driver.controller.js
import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";
import Booking from "../models/Booking.js";
import DelayReport from "../models/DelayReport.js";

// GET /api/driver/trips
export const getTodayTrips = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trips = await Trip.find({
      driver: req.user.id,
      date: { $gte: today, $lt: tomorrow },
    })
      .populate("bus")
      .populate("route")
      .sort({ departureTime: 1 });

    res.json({ success: true, data: trips });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/driver/trips/:id/passengers
export const getPassengerList = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("bus")
      .populate("route");

    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.driver !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized" });

    const passengers = await Booking.find({ trip: trip._id, status: "confirmed" })
      .populate("student", "name email phone")
      .populate("pickupStop")
      .populate("dropoffStop");

    res.json({
      success: true,
      data: { trip, passengers, total: passengers.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/driver/trips/:id/start
export const startTrip = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.driver !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized" });
    if (trip.status !== "scheduled")
      return res.status(400).json({ success: false, message: "Trip cannot be started" });

    trip.status = "in-progress";
    trip.currentLocation = { latitude, longitude };
    await trip.save();

    const bus = await Bus.findById(trip.bus);
    if (bus) {
      bus.isLive = true;
      bus.currentLocation = { latitude, longitude };
      await bus.save();
    }

    res.json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/driver/trips/:id/end
export const endTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.driver !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized" });
    if (trip.status !== "in-progress")
      return res.status(400).json({ success: false, message: "Trip is not in progress" });

    trip.status = "completed";
    trip.arrivalTime = new Date().toTimeString().slice(0, 5);
    await trip.save();

    const bus = await Bus.findById(trip.bus);
    if (bus) {
      bus.isLive = false;
      await bus.save();
    }

    res.json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/driver/report-delay
export const reportDelay = async (req, res) => {
  try {
    const { tripId, delayMinutes, reason, description } = req.body;
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.driver !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized" });

    const report = await DelayReport.create({
      trip: tripId,
      driver: req.user.id,
      reportedBy: req.user.id,
      delayMinutes,
      reason,
      description,
    });

    trip.status = "delayed";
    trip.delayMinutes = delayMinutes;
    trip.delayReason = reason;
    await trip.save();

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/driver/trips/:id/live
export const getLiveLocation = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.driver !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized" });

    res.json({
      success: true,
      data: {
        tripId: trip._id,
        status: trip.status,
        location: trip.currentLocation,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};