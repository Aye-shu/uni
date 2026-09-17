// server/controllers/trip.controller.js
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";

// GET /api/trips — list all trips (with filters)
export const getAllTrips = async (req, res) => {
  try {
    const filter = {};
    if (req.query.day) filter.day = req.query.day;
    if (req.query.direction) filter.direction = req.query.direction;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) filter.date = new Date(req.query.date);

    const trips = await Trip.find(filter)
      .populate("bus")
      .populate({
        path: "route",
        populate: { path: "stops" },   // ← nested populate
      })
      .sort({ departureTime: 1 });

    res.json({ success: true, data: trips });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// GET /api/trips/:id
export const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("bus")
      .populate({
        path: "route",
        populate: { path: "stops" },   // ← populate nested stops
      })
      .populate({
        path: "bookings",
        populate: { path: "student", select: "name email" },
      });

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    res.json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// POST /api/trips (admin)
export const createTrip = async (req, res) => {
  try {
    const trip = await Trip.create(req.body);
    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/trips/:id (admin)
export const updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    res.json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/trips/:id (admin)
export const deleteTrip = async (req, res) => {
  try {
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Trip deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/trips/:id/passengers
export const getTripPassengers = async (req, res) => {
  try {
    const passengers = await Booking.find({
      trip: req.params.id,
      status: "confirmed",
    })
      .populate("student", "name email phone")
      .populate("pickupStop")
      .populate("dropoffStop");
    res.json({ success: true, data: passengers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/trips/:id/seats — get seat availability map
export const getTripSeats = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate("bus");
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    const bus = trip.bus;
    const capacity = bus?.capacity || 40;

    // Get all confirmed bookings for this trip
    const bookings = await Booking.find({
      trip: trip._id,
      status: "confirmed",
    }).select("seatNumber");

    const taken = bookings.map((b) => String(b.seatNumber));
    const total = capacity;
    const available = Math.max(0, total - taken.length);

    res.json({
      success: true,
      data: {
        tripId: trip._id,
        busId: bus?._id,
        capacity,
        total,
        available,
        taken,
      },
    });
  } catch (err) {
    console.error("getTripSeats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};