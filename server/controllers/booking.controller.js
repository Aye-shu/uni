// server/controllers/booking.controller.js
import Booking from "../models/Booking.js";
import Trip from "../models/Trip.js";

/* =====================================================
   HELPER — get user id safely (supports id or _id)
===================================================== */
function getUserId(req) {
  return req.user?.id || req.user?._id || null;
}

/* =====================================================
   GET /api/bookings — list all bookings (admin) or user's own (student)
===================================================== */
export const getAllBookings = async (req, res) => {
  try {
    const userId = getUserId(req);

    // Debug — remove after you confirm it works
    console.log('[/api/bookings] req.user =', req.user);
    console.log('[/api/bookings] resolved userId =', userId);

    let filter = {};
    if (req.user.role !== "admin") {
      if (!userId) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }
      filter = { student: userId };
    }

    console.log('[/api/bookings] filter =', filter);

    const bookings = await Booking.find(filter)
      .populate("trip")
      .populate("bus")
      .populate("route")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('[/api/bookings] error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   GET /api/bookings/:id
===================================================== */
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("trip")
      .populate("bus")
      .populate("route")
      .populate("pickupStop")
      .populate("dropoffStop");

    if (!booking)
      return res.status(404).json({ success: false, message: "Booking not found" });

    const userId = getUserId(req);
    if (req.user.role !== "admin" && String(booking.student) !== String(userId))
      return res.status(403).json({ success: false, message: "Forbidden" });

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   POST /api/bookings
===================================================== */
export const createBooking = async (req, res) => {
  try {
    const {
      tripId,
      seatNumber,
      pickupStop,
      dropoffStop,
      travelDate,                    // user-picked date
      isReturn = false,
      originalBooking,
    } = req.body;

    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    const trip = await Trip.findById(tripId);
    if (!trip)
      return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.status !== "scheduled")
      return res.status(400).json({ success: false, message: "Trip not available" });
    if (trip.availableSeats <= 0)
      return res.status(400).json({ success: false, message: "No seats available" });

    const seatTaken = await Booking.findOne({
      trip: tripId,
      seatNumber,
      status: "confirmed",
    });
    if (seatTaken)
      return res.status(400).json({ success: false, message: "Seat already booked" });

    // Use user-picked date; fall back to trip.date if missing/invalid
    let finalTravelDate = trip.date;
    if (travelDate) {
      const parsed = new Date(travelDate);
      if (!Number.isNaN(parsed.getTime())) {
        finalTravelDate = parsed;
      }
    }

    const bookingId = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const booking = await Booking.create({
      bookingId,
      student: userId,
      trip: tripId,
      bus: trip.bus,
      route: trip.route,
      pickupStop,
      dropoffStop,
      seatNumber,
      travelDate: finalTravelDate,
      isReturn,
      originalBooking: originalBooking || null,
      fare: 50,
      status: "confirmed",
    });

    trip.bookings.push(booking._id);
    trip.availableSeats -= 1;
    await trip.save();

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    console.error('[POST /api/bookings] error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   PUT /api/bookings/:id — update booking
===================================================== */
export const updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!booking)
      return res.status(404).json({ success: false, message: "Booking not found" });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   PUT /api/bookings/:id/cancel
===================================================== */
export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: "Booking not found" });

    const userId = getUserId(req);
    if (req.user.role !== "admin" && String(booking.student) !== String(userId))
      return res.status(403).json({ success: false, message: "Forbidden" });

    if (booking.status === "cancelled")
      return res.status(400).json({ success: false, message: "Already cancelled" });

    booking.status = "cancelled";
    booking.cancellationReason = req.body.cancellationReason || "User cancelled";
    booking.cancelledAt = new Date();
    await booking.save();

    const trip = await Trip.findById(booking.trip);
    if (trip) {
      trip.availableSeats += 1;
      trip.bookings = trip.bookings.filter(
        (id) => id.toString() !== booking._id.toString()
      );
      await trip.save();
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =====================================================
   DELETE /api/bookings/:id (admin only)
===================================================== */
export const deleteBooking = async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Booking deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};