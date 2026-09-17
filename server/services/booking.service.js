// server/services/booking.service.js
import Booking from "../models/Booking.js";
import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";

/**
 * Check if a seat is available on a trip
 */
export const isSeatAvailable = async (tripId, seatNumber) => {
  const existing = await Booking.findOne({
    trip: tripId,
    seatNumber,
    status: "confirmed",
  });
  return !existing;
};

/**
 * Get all booked seat numbers for a trip
 */
export const getBookedSeats = async (tripId) => {
  const bookings = await Booking.find({
    trip: tripId,
    status: "confirmed",
  }).select("seatNumber");
  return bookings.map((b) => b.seatNumber);
};

/**
 * Get seat availability map for a trip
 */
export const getSeatMap = async (tripId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");

  const bus = await Bus.findById(trip.bus);
  const bookedSeats = await getBookedSeats(tripId);

  const seats = [];
  const capacity = bus?.capacity || 0;
  for (let i = 1; i <= capacity; i++) {
    const seatNumber = String(i);
    seats.push({
      number: seatNumber,
      isAvailable: !bookedSeats.includes(seatNumber),
      isBooked: bookedSeats.includes(seatNumber),
    });
  }

  return {
    tripId: trip._id,
    busId: trip.bus,
    capacity,
    availableSeats: trip.availableSeats,
    bookedSeats,
    seats,
  };
};

/**
 * Create a booking with proper seat reservation
 */
export const createBooking = async (data) => {
  const { studentId, tripId, seatNumber, pickupStop, dropoffStop, isReturn, originalBooking } = data;

  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");
  if (trip.status !== "scheduled")
    throw new Error("Trip is not available for booking");
  if (trip.availableSeats <= 0) throw new Error("No seats available");

  const seatFree = await isSeatAvailable(tripId, seatNumber);
  if (!seatFree) throw new Error("Seat already booked");

  const bookingId = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const booking = await Booking.create({
    bookingId,
    student: studentId,
    trip: tripId,
    bus: trip.bus,
    route: trip.route,
    pickupStop,
    dropoffStop,
    seatNumber,
    travelDate: trip.date,
    isReturn: isReturn || false,
    originalBooking: originalBooking || null,
    fare: 50,
    status: "confirmed",
  });

  // Reserve the seat
  trip.bookings.push(booking._id);
  trip.availableSeats -= 1;
  await trip.save();

  return booking;
};

/**
 * Cancel a booking and release the seat
 */
export const cancelBooking = async (bookingId, reason) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "cancelled") throw new Error("Already cancelled");

  booking.status = "cancelled";
  booking.cancellationReason = reason || "User cancelled";
  booking.cancelledAt = new Date();
  await booking.save();

  // Release the seat
  const trip = await Trip.findById(booking.trip);
  if (trip) {
    trip.availableSeats += 1;
    trip.bookings = trip.bookings.filter(
      (id) => id.toString() !== booking._id.toString()
    );
    await trip.save();
  }

  return booking;
};

/**
 * Get all bookings for a student
 */
export const getStudentBookings = async (studentId, status) => {
  const filter = { student: studentId };
  if (status) filter.status = status;

  return Booking.find(filter)
    .populate("trip")
    .populate("bus")
    .populate("route")
    .populate("pickupStop")
    .populate("dropoffStop")
    .sort({ createdAt: -1 });
};

/**
 * Check if a student already has a booking for a trip
 */
export const hasBookingForTrip = async (studentId, tripId) => {
  return Booking.findOne({
    student: studentId,
    trip: tripId,
    status: "confirmed",
  });
};

export default {
  isSeatAvailable,
  getBookedSeats,
  getSeatMap,
  createBooking,
  cancelBooking,
  getStudentBookings,
  hasBookingForTrip,
};