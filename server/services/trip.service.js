// server/services/trip.service.js
import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";
import Route from "../models/Route.js";
import Booking from "../models/Booking.js";

/**
 * Get trips with filters (day, direction, status, date).
 */
export const listTrips = async (filters = {}) => {
  const query = {};
  if (filters.day) query.day = filters.day;
  if (filters.direction) query.direction = filters.direction;
  if (filters.status) query.status = filters.status;
  if (filters.date) query.date = new Date(filters.date);

  return Trip.find(query)
    .populate("bus")
    .populate("route")
    .sort({ departureTime: 1 });
};

/**
 * Get a single trip with full details.
 */
export const getTripDetail = async (tripId) => {
  const trip = await Trip.findById(tripId)
    .populate("bus")
    .populate("route")
    .populate({
      path: "bookings",
      populate: { path: "student", select: "name email phone" },
    });
  if (!trip) throw new Error("Trip not found");
  return trip;
};

/**
 * Create a new trip. Validates bus, route, driver.
 */
export const createTrip = async (data) => {
  const { bus: busId, route: routeId, driver, date, day, direction, departureTime, arrivalTime } = data;

  const bus = await Bus.findById(busId);
  if (!bus) throw new Error("Bus not found");

  const route = await Route.findById(routeId);
  if (!route) throw new Error("Route not found");

  if (!driver) throw new Error("Driver is required");
  if (!date) throw new Error("Date is required");
  if (!day) throw new Error("Day is required");
  if (!departureTime) throw new Error("Departure time is required");

  return Trip.create({
    bus: busId,
    route: routeId,
    driver,
    date,
    day,
    direction: direction || "outbound",
    departureTime,
    arrivalTime,
    status: "scheduled",
    availableSeats: bus.capacity,
    bookings: [],
    currentLocation: { latitude: 0, longitude: 0 },
  });
};

/**
 * Update trip fields.
 */
export const updateTrip = async (tripId, updates) => {
  const trip = await Trip.findByIdAndUpdate(tripId, updates, {
    new: true,
    runValidators: true,
  });
  if (!trip) throw new Error("Trip not found");
  return trip;
};

/**
 * Delete a trip (and optionally release all bookings).
 */
export const deleteTrip = async (tripId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");

  // Cancel all confirmed bookings on this trip
  await Booking.updateMany(
    { trip: tripId, status: "confirmed" },
    { status: "cancelled", cancellationReason: "Trip cancelled", cancelledAt: new Date() }
  );

  await trip.deleteOne();
  return { success: true };
};

/**
 * Get passenger list for a trip.
 */
export const getPassengerList = async (tripId) => {
  return Booking.find({ trip: tripId, status: "confirmed" })
    .populate("student", "name email phone")
    .populate("pickupStop")
    .populate("dropoffStop");
};

/**
 * Get seat occupancy stats for a trip.
 */
export const getTripStats = async (tripId) => {
  const trip = await Trip.findById(tripId).populate("bus");
  if (!trip) throw new Error("Trip not found");

  const booked = await Booking.countDocuments({ trip: tripId, status: "confirmed" });
  const capacity = trip.bus?.capacity || 0;

  return {
    tripId: trip._id,
    capacity,
    booked,
    available: capacity - booked,
    occupancyPercent: capacity > 0 ? Math.round((booked / capacity) * 100) : 0,
  };
};

/**
 * Get today's trips for a specific driver.
 */
export const getDriverTodayTrips = async (driverId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return Trip.find({
    driver: driverId,
    date: { $gte: today, $lt: tomorrow },
  })
    .populate("bus")
    .populate("route")
    .sort({ departureTime: 1 });
};

/**
 * Mark a trip as delayed.
 */
export const markTripDelayed = async (tripId, { delayMinutes, reason }) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");

  trip.status = "delayed";
  trip.delayMinutes = delayMinutes;
  trip.delayReason = reason;
  await trip.save();
  return trip;
};

export default {
  listTrips,
  getTripDetail,
  createTrip,
  updateTrip,
  deleteTrip,
  getPassengerList,
  getTripStats,
  getDriverTodayTrips,
  markTripDelayed,
};