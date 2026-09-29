// server/controllers/trip.controller.js
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Bus from "../models/Bus.js";
import mongoose from "mongoose";

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
    const {
      route, bus, driver, date, day, direction,
      departureTime, arrivalTime, status, notes,
      availableSeats, bookings, currentLocation,
    } = req.body;

    console.log("📥 createTrip body:", {
      route, bus, driver, day, direction,
      departureTime, arrivalTime, availableSeats,
    });

    // Basic validation
    const missing = [];
    if (!route)          missing.push("route");
    if (!bus)            missing.push("bus");
    if (!driver)         missing.push("driver");
    if (!departureTime)  missing.push("departureTime");
    if (!arrivalTime)    missing.push("arrivalTime");

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: " + missing.join(", "),
      });
    }

    const trip = await Trip.create({
      route,
      bus,
      driver: String(driver),
      date: date ? new Date(date) : new Date(),
      day: day || new Date(date || Date.now()).toLocaleDateString("en-US", { weekday: "long" }),
      direction: direction || "outbound",
      departureTime,
      arrivalTime,
      status: status || "scheduled",
      notes: notes || "",
      availableSeats: Number(availableSeats) || 0,
      bookings: bookings || [],
      currentLocation: currentLocation || { latitude: 0, longitude: 0 },
    });

    const populated = await Trip.findById(trip._id)
      .populate("bus")
      .populate({ path: "route", populate: { path: "stops" } });

    console.log("✅ Trip created:", trip._id);

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error("❌ createTrip error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/trips/:id (admin)
export const updateTrip = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.driver !== undefined) updates.driver = String(updates.driver);
    if (updates.date   !== undefined) updates.date   = new Date(updates.date);
    if (updates.availableSeats !== undefined) {
      updates.availableSeats = Number(updates.availableSeats);
    }

    console.log("📥 updateTrip", req.params.id, updates);

    const trip = await Trip.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("bus")
      .populate({ path: "route", populate: { path: "stops" } });

    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    console.log("✅ Trip updated:", trip._id);
    res.json({ success: true, data: trip });
  } catch (err) {
    console.error("❌ updateTrip error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/trips/:id (admin)
export const deleteTrip = async (req, res) => {
  try {
    console.log("🗑️ deleteTrip:", req.params.id);

    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) {
      console.log("❌ Trip not found:", req.params.id);
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    // Clean up bookings tied to this trip
    try {
      await Booking.deleteMany({ trip: req.params.id });
    } catch (bErr) {
      console.warn("⚠️ Booking cleanup failed:", bErr.message);
    }

    console.log("✅ Trip deleted:", req.params.id);
    res.json({ success: true, message: "Trip deleted" });
  } catch (err) {
    console.error("❌ deleteTrip error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/trips/:id/passengers — list passengers with student details
// Uses the raw MongoDB driver because Booking.student is a String id
export const getTripPassengers = async (req, res) => {
  try {
    const bookings = await Booking.find({
      trip: req.params.id,
      status: "confirmed",
    })
      .populate("pickupStop")
      .populate("dropoffStop")
      .lean();

    if (!bookings.length) {
      return res.json({ success: true, data: [] });
    }

    // Collect unique student ids
    const studentIds = [
      ...new Set(bookings.map(b => String(b.student)).filter(Boolean)),
    ];

    console.log("[/passengers] looking up user ids:", studentIds);

    // Raw MongoDB driver — bypasses any Mongoose casting issues
    const db = mongoose.connection.db;
    const users = await db.collection("user")
      .find({ _id: { $in: studentIds } })
      .project({ name: 1, email: 1, phone: 1, studentId: 1, department: 1 })
      .toArray();

    console.log("[/passengers] found users:", users.length);

    const usersMap = {};
    users.forEach(u => { usersMap[String(u._id)] = u; });

    // Attach student info to each booking
    const passengers = bookings.map(b => {
      const u = usersMap[String(b.student)] || null;
      return {
        ...b,
        student: u
          ? {
              _id: u._id,
              name: u.name || "Student",
              email: u.email || "",
              phone: u.phone || "",
              studentId: u.studentId || "",
              department: u.department || "",
            }
          : {
              _id: b.student || null,
              name: "Passenger",
              email: "",
              phone: "",
              studentId: "",
              department: "",
            },
      };
    });

    res.json({ success: true, data: passengers });
  } catch (err) {
    console.error("getTripPassengers error:", err);
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

// DELETE /api/trips/all — admin wipes ALL trips (bulk cleanup)
export const deleteAllTrips = async (req, res) => {
  try {
    console.log("🗑️ deleteAllTrips requested by:", req.user?.email);

    const result = await Trip.deleteMany({});
    console.log("✅ Deleted trips:", result.deletedCount);

    // Also clean up orphaned bookings
    try {
      const bResult = await Booking.deleteMany({});
      console.log("✅ Deleted bookings:", bResult.deletedCount);
    } catch (bErr) {
      console.warn("⚠️ Booking cleanup failed:", bErr.message);
    }

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} trips`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("❌ deleteAllTrips error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
