// server/controllers/report.controller.js
import DelayReport from "../models/DelayReport.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";

// POST /api/reports/delay — driver reports a delay
export const reportDelay = async (req, res) => {
  try {
    const { tripId, delayMinutes, reason, description } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.driver !== req.user.id)
      return res.status(403).json({ success: false, message: "Not your trip" });

    const report = await DelayReport.create({
      trip: tripId,
      driver: req.user.id,
      reportedBy: req.user.id,
      delayMinutes,
      reason,
      description,
    });

    trip.status = "delayed";
    trip.delayMinutes = delayMinutes;
    trip.delayReason = reason;
    await trip.save();

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reports — admin: list all delay reports
export const getAllReports = async (req, res) => {
  try {
    const reports = await DelayReport.find({})
      .populate("trip")
      .populate("driver", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reports/pending — admin: only pending reports
export const getPendingReports = async (req, res) => {
  try {
    const reports = await DelayReport.find({ status: "pending" })
      .populate("trip")
      .populate("driver", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/reports/:id — admin: update report status
export const updateReportStatus = async (req, res) => {
  try {
    const report = await DelayReport.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reports/daily — admin: daily booking statistics
export const getDailyStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalBookings, cancelledBookings, activeTrips] = await Promise.all([
      Booking.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
        status: "confirmed",
      }),
      Booking.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
        status: "cancelled",
      }),
      Trip.countDocuments({ status: "in-progress" }),
    ]);

    res.json({
      success: true,
      data: { date: today, totalBookings, cancelledBookings, activeTrips },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};