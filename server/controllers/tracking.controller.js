// server/controllers/tracking.controller.js
import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";

// GET /api/tracking/trip/:tripId — get live location of a trip
export const getTripLocation = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate("bus")
      .populate("route");
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    res.json({
      success: true,
      data: {
        tripId: trip._id,
        status: trip.status,
        location: trip.currentLocation,
        bus: trip.bus,
        route: trip.route,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/tracking/trip/:tripId — driver updates trip location
export const updateTripLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.driver !== req.user.id)
      return res.status(403).json({ success: false, message: "Not your trip" });

    trip.currentLocation = { latitude, longitude };
    await trip.save();

    // Also update the bus location
    const bus = await Bus.findById(trip.bus);
    if (bus) {
      bus.currentLocation = { latitude, longitude };
      await bus.save();
    }

    res.json({ success: true, data: { latitude, longitude } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tracking/buses — all live buses
export const getAllLiveBuses = async (req, res) => {
  try {
    const buses = await Bus.find({ isLive: true }).select(
      "busNumber plateNumber currentLocation currentDriver"
    );
    res.json({ success: true, data: buses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};