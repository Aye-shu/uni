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

// Helper — build a unique stop code from a name
function makeStopCode(name, index) {
  const slug = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `STP-${slug || "STOP"}-${index + 1}-${suffix}`;
}

// POST /api/routes (admin)
export const createRoute = async (req, res) => {
  try {
    const { name, direction, distance, description, status, stops } = req.body;

    if (!name || !Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Route name and at least one stop are required",
      });
    }

    // 1. Create Stop documents (auto-fill required fields)
    const stopIds = [];
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];

      const stopName = typeof s === "string"
        ? s.trim()
        : (s.name || "").trim();

      if (!stopName) continue;

      const lat = s?.location?.latitude ?? s?.latitude ?? null;
      const lng = s?.location?.longitude ?? s?.longitude ?? null;

      const stopDoc = await Stop.create({
        name: stopName,
        code: s?.code || makeStopCode(stopName, i),
        location: {
          latitude:  Number.isFinite(lat) ? lat : 0,
          longitude: Number.isFinite(lng) ? lng : 0,
        },
        address: s?.address || "",
        isCampusStop: !!s?.isCampusStop,
      });

      stopIds.push(stopDoc._id);
    }

    if (stopIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid stops provided",
      });
    }

    // 2. Create the Route referencing those stops
    const route = await Route.create({
      name:        name.trim(),
      direction:   direction || "outbound",
      distance:    Number(distance) || 0,
      description: description || "",
      status:      status || "active",
      stops:       stopIds,
    });

    // 3. Return with populated stops
    const populated = await Route.findById(route._id).populate("stops");

    res.status(201).json({ success: true, data: populated });
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
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });

    // Clean up orphaned stop documents
    if (Array.isArray(route.stops) && route.stops.length) {
      await Stop.deleteMany({ _id: { $in: route.stops } });
    }

    await Route.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Route deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/routes/:id/stops — add a stop to route (admin)
export const addStopToRoute = async (req, res) => {
  try {
    const { name } = req.body;
    const stop = await Stop.create({
      name,
      code: req.body.code || makeStopCode(name, 0),
      location: {
        latitude:  req.body?.location?.latitude  ?? 0,
        longitude: req.body?.location?.longitude ?? 0,
      },
      address: req.body.address || "",
      isCampusStop: !!req.body.isCampusStop,
    });

    const route = await Route.findByIdAndUpdate(
      req.params.id,
      { $push: { stops: stop._id } },
      { new: true }
    ).populate("stops");

    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.status(201).json({ success: true, data: route });
  } catch (err) {
    console.error("addStopToRoute error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
