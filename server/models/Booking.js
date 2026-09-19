// server/models/Booking.js
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true },

    student: {
      type: String, // ← Better Auth IDs are strings
      ref: "User",
      required: true,
    },

    trip:  { type: mongoose.Schema.Types.ObjectId, ref: "Trip",  required: true },
    bus:   { type: mongoose.Schema.Types.ObjectId, ref: "Bus",   required: true },
    route: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },

    // Optional — students don't pick stops in the current UI
    pickupStop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stop",
      default: null,
    },
    dropoffStop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stop",
      default: null,
    },

    seatNumber: { type: String, required: true },

    bookingDate: { type: Date, default: Date.now },
    travelDate:  { type: Date, required: true },

    status: {
      type: String,
      enum: ["confirmed", "cancelled", "completed", "no-show"],
      default: "confirmed",
    },

    isReturn: { type: Boolean, default: false },

    originalBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    fare: { type: Number, required: true },

    cancellationReason: { type: String, default: "" },
    cancelledAt:        { type: Date,   default: null },
  },
  { timestamps: true }
);

// Prevent double booking of the same seat on the same trip —
// but only for *active* bookings. Cancelled ones must not block re-booking.
bookingSchema.index(
  { trip: 1, seatNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "confirmed" },
  }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;