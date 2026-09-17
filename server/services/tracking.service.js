// server/services/tracking.service.js
import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";

/**
 * Update the live location of a trip and its bus.
 */
export const updateLocation = async ({ tripId, latitude, longitude }) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");

  trip.currentLocation = { latitude, longitude };
  await trip.save();

  const bus = await Bus.findById(trip.bus);
  if (bus) {
    bus.currentLocation = { latitude, longitude };
    await bus.save();
  }

  return { tripId, latitude, longitude, timestamp: new Date() };
};

/**
 * Get live location of a single trip.
 */
export const getTripLocation = async (tripId) => {
  const trip = await Trip.findById(tripId).select(
    "status currentLocation isLive driver bus route"
  );
  if (!trip) throw new Error("Trip not found");
  return trip;
};

/**
 * Get all buses currently marked as live.
 */
export const getAllLiveBuses = async () => {
  return Bus.find({ isLive: true }).select(
    "busNumber plateNumber currentLocation currentDriver"
  );
};

/**
 * Mark a trip as live/in-progress.
 */
export const startTrip = async ({ tripId, latitude, longitude }) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");
  if (trip.status !== "scheduled") throw new Error("Trip cannot be started");

  trip.status = "in-progress";
  trip.currentLocation = { latitude: latitude || 0, longitude: longitude || 0 };
  await trip.save();

  const bus = await Bus.findById(trip.bus);
  if (bus) {
    bus.isLive = true;
    bus.currentLocation = {
      latitude: latitude || 0,
      longitude: longitude || 0,
    };
    await bus.save();
  }

  return trip;
};

/**
 * Mark a trip as completed (GPS off).
 */
export const endTrip = async (tripId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");
  if (trip.status !== "in-progress") throw new Error("Trip is not in progress");

  trip.status = "completed";
  trip.arrivalTime = new Date().toTimeString().slice(0, 5);
  await trip.save();

  const bus = await Bus.findById(trip.bus);
  if (bus) {
    bus.isLive = false;
    await bus.save();
  }

  return trip;
};

/**
 * Calculate approximate distance between two coordinates (Haversine, km).
 */
export const getDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export default {
  updateLocation,
  getTripLocation,
  getAllLiveBuses,
  startTrip,
  endTrip,
  getDistanceKm,
};