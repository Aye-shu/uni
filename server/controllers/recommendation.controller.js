// server/controllers/recommendation.controller.js
import Trip from "../models/Trip.js";
import ClassSchedule from "../models/ClassSchedule.js";

// POST /api/recommendations/find — smart bus recommendation
// Body: { day, endTime, direction }
export const getRecommendations = async (req, res) => {
  try {
    const { day, endTime, direction = "outbound" } = req.body;

    if (!day || !endTime) {
      return res.status(400).json({
        success: false,
        message: "day and endTime are required",
      });
    }

    // Find scheduled trips on that day & direction
    const trips = await Trip.find({
      day,
      direction,
      status: { $in: ["scheduled", "delayed"] },
    })
      .populate("bus")
      .populate("route")
      .sort({ departureTime: 1 });

    // Filter by available seats and departure >= classEndTime
    const candidates = trips.filter(
      (t) => t.availableSeats > 0 && t.departureTime >= endTime
    );

    // The first candidate is the best recommendation
    const recommendation = candidates[0] || null;

    res.json({
      success: true,
      recommendation,
      alternatives: candidates.slice(1),
      totalFound: candidates.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/recommendations/from-class — auto-recommend based on the student's next class
// Body: { classId, direction }
export const recommendFromClass = async (req, res) => {
  try {
    const { classId, direction = "return" } = req.body;

    const cls = await ClassSchedule.findById(classId);
    if (!cls) return res.status(404).json({ success: false, message: "Class not found" });
    if (cls.student !== req.user.id)
      return res.status(403).json({ success: false, message: "Forbidden" });

    // Use class end time and day
    const trips = await Trip.find({
      day: cls.day,
      direction,
      status: { $in: ["scheduled", "delayed"] },
    })
      .populate("bus")
      .populate("route")
      .sort({ departureTime: 1 });

    const candidates = trips.filter(
      (t) => t.availableSeats > 0 && t.departureTime >= cls.endTime
    );

    res.json({
      success: true,
      class: cls,
      recommendation: candidates[0] || null,
      alternatives: candidates.slice(1),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};