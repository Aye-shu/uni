// server/controllers/route.controller.js
import Route from "../models/Route.js";

// Helper — generate a unique route code from a name
function makeRouteCode(name) {
  const slug = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `RT-${slug || "ROUTE"}-${suffix}`;
}

// Helper — normalize a stop (accept string or object)
function normalizeStop(s) {
  if (typeof s === "string") {
    return {
      name: s.trim(),
      address: "",
      isCampusStop: false,
      location: { latitude: 0, longitude: 0 },
    };
  }
  return {
    name: (s?.name || "").trim(),
    address: s?.address || "",
    isCampusStop: !!s?.isCampusStop,
    location: {
      latitude:  Number(s?.location?.latitude)  || 0,
      longitude: Number(s?.location?.longitude) || 0,
    },
  };
}

// GET /api/routes
export const getAllRoutes = async (req, res) => {
  try {
    const routes = await Route.find({}).sort({ name: 1 });
    res.json({ success: true, data: routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/routes/:id
export const getRouteById = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/routes (admin)
export const createRoute = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      direction,
      distance,
      estimatedDuration,
      status,
      stops,
    } = req.body;

    if (!name || !Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Route name and at least one stop are required",
      });
    }

    const cleanStops = stops
      .map(normalizeStop)
      .filter(s => s.name);

    if (cleanStops.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid stops provided",
      });
    }

    const route = await Route.create({
      name:              name.trim(),
      code:              code?.trim() || makeRouteCode(name),
      description:       description || "",
      direction:         direction === "return" ? "return" : "outbound",
      distance:          Number(distance) || 0,
      estimatedDuration: Number(estimatedDuration) || 0,
      status:            status === "inactive" ? "inactive" : "active",
      startPoint:        cleanStops[0].name,
      endPoint:          cleanStops[cleanStops.length - 1].name,
      stops:             cleanStops,
    });

    res.status(201).json({ success: true, data: route });
  } catch (err) {
    console.error("createRoute error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/routes/:id (admin)
export const updateRoute = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (Array.isArray(updates.stops)) {
      const cleanStops = updates.stops
        .map(normalizeStop)
        .filter(s => s.name);
      updates.stops = cleanStops;
      if (cleanStops.length > 0) {
        updates.startPoint = cleanStops[0].name;
        updates.endPoint = cleanStops[cleanStops.length - 1].name;
      }
    }

    const route = await Route.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    console.error("updateRoute error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/routes/:id (admin)
export const deleteRoute = async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, message: "Route deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/routes/:id/stops — append a stop to an existing route (admin)
export const addStopToRoute = async (req, res) => {
  try {
    const newStop = normalizeStop(req.body);
    if (!newStop.name) {
      return res.status(400).json({ success: false, message: "Stop name is required" });
    }

    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });

    route.stops.push(newStop);
    route.endPoint = newStop.name;
    await route.save();

    res.status(201).json({ success: true, data: route });
  } catch (err) {
    console.error("addStopToRoute error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
