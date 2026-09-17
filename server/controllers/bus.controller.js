// server/controllers/bus.controller.js
import Bus from "../models/Bus.js";

// GET /api/buses — list all buses
export const getAllBuses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const buses = await Bus.find(filter)
      .populate("currentDriver", "name email")
      .sort({ busNumber: 1 });
    res.json({ success: true, data: buses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/buses/:id
export const getBusById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id).populate("currentDriver", "name email");
    if (!bus) return res.status(404).json({ success: false, message: "Bus not found" });
    res.json({ success: true, data: bus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/buses (admin)
export const createBus = async (req, res) => {
  try {
    const bus = await Bus.create(req.body);
    res.status(201).json({ success: true, data: bus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/buses/:id (admin)
export const updateBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!bus) return res.status(404).json({ success: false, message: "Bus not found" });
    res.json({ success: true, data: bus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/buses/:id (admin)
export const deleteBus = async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Bus deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/buses/live — list of live buses (for admin monitoring)
export const getLiveBuses = async (req, res) => {
  try {
    const buses = await Bus.find({ isLive: true }).populate("currentDriver", "name email");
    res.json({ success: true, data: buses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};