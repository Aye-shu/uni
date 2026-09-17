// server/models/Trip.js
import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    driver: {
      type: String, // ← Better Auth IDs are strings
      ref: "User",
      required: true,
    },
    date: { type: Date, required: true },
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      required: true, // ← ADDED for recommendation logic
    },
    direction: {
      type: String,
      enum: ["outbound", "return"],
      default: "outbound", // ← ADDED
    },
    departureTime: { type: String, required: true },
    arrivalTime: { type: String },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "cancelled", "delayed"], // ← added "delayed"
      default: "scheduled",
    },
    delayMinutes: { type: Number, default: 0 }, // ← ADDED
    delayReason: { type: String, default: "" }, // ← ADDED
    currentLocation: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
    },
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
    availableSeats: { type: Number, required: true },
  },
  { timestamps: true }
);

const Trip = mongoose.model("Trip", tripSchema);
export default Trip;