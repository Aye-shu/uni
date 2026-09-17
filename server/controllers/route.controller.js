// server/controllers/route.controller.js
import Route from "../models/Route.js";
import Stop from "../models/Stop.js";

// GET /api/routes
export const getAllRoutes = async (req, res) => {
  try {
    const routes = await Route.find({}).populate("stops").sort({ name: 1 });
    res.json({ success: true, data: routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/routes/:id
export const getRouteById = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id).populate("stops");
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/routes (admin)
// POST /api/routes (admin)
export const createRoute = async (req, res) => {
  try {
    const route = await Route.create(req.body);
    res.status(201).json({ success: true, data: route });
  } catch (err) {
    console.error("createRoute error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/routes/:id (admin)
export const updateRoute = async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/routes/:id (admin)
export const deleteRoute = async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Route deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/routes/:id/stops — add a stop to route (admin)
export const addStopToRoute = async (req, res) => {
  try {
    const stop = await Stop.create(req.body);
    const route = await Route.findByIdAndUpdate(
      req.params.id,
      { $push: { stops: stop._id } },
      { new: true }
    ).populate("stops");
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.status(201).json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};