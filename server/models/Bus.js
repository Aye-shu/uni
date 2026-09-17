// server/models/Bus.js
import mongoose from "mongoose";

const busSchema = new mongoose.Schema(
  {
    busNumber: { type: String, required: true, unique: true },
    plateNumber: { type: String, required: true, unique: true },
    capacity: { type: Number, required: true },
    availableSeats: { type: Number, required: true },
    busType: {
      type: String,
      enum: ["standard", "luxury", "electric"],
      default: "standard",
    },
    features: [{
      type: String,
      enum: ["AC", "WiFi", "USB Charging", "Wheelchair Access", "CCTV"],
    }],
    status: {
      type: String,
      enum: ["active", "maintenance", "inactive"],
      default: "active",
    },
    currentLocation: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
    },
    isLive: { type: Boolean, default: false }, // ← ADDED
    currentDriver: {
      type: String, // ← Changed from ObjectId (Better Auth IDs are strings)
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const Bus = mongoose.model("Bus", busSchema);
export default Bus;