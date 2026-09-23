// server/controllers/report.controller.js
import DelayReport from "../models/DelayReport.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIO } from "../config/socket.js";

// POST /api/reports/delay — driver reports a delay (with or without a trip)
export const reportDelay = async (req, res) => {
  try {
    const { tripId, delayMinutes, reason, description } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: "reason is required" });
    }

    // If tripId is provided, verify it exists and belongs to this driver
    let trip = null;
    if (tripId) {
      trip = await Trip.findById(tripId);
      if (!trip) {
        return res.status(404).json({ success: false, message: "Trip not found" });
      }
      if (String(trip.driver) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: "Not your trip" });
      }
    }

    const report = await DelayReport.create({
      trip: tripId || null,
      driver: String(req.user.id),
      reportedBy: String(req.user.id),
      delayMinutes: Number(delayMinutes) || 0,
      reason,
      description: description || "",
    });

    // If attached to a real trip, mark that trip as delayed
    if (trip) {
      trip.status = "delayed";
      trip.delayMinutes = Number(delayMinutes) || 0;
      trip.delayReason = reason;
      await trip.save();
    }

    // Notify admins + broadcast
    try {
      const admins = await User.find({ role: "admin" }).select("_id");
      const title = `Driver report: ${reason}`;
      const message = description || `Delay reported${delayMinutes ? ` — ${delayMinutes} min` : ""}`;

      const docs = admins.map((a) => ({
        recipient: String(a._id),
        title,
        message,
        type: "delay",
        relatedId: report._id,
      }));
      if (docs.length) await Notification.insertMany(docs);

      const io = getIO();
      io.to("admins").emit("admin-driver-report", {
        tripId: trip ? String(trip._id) : null,
        issueType: reason,
        description,
        delayMinutes: Number(delayMinutes) || 0,
        reportedBy: req.user.id,
        timestamp: new Date(),
      });
    } catch (notifErr) {
      console.warn("Notification failed:", notifErr.message);
    }

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    console.error("reportDelay error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/reports — student reports an issue
export const createReport = async (req, res) => {
  try {
    const { tripId, issueType, description, delayMinutes } = req.body;

    if (!tripId || !issueType) {
      return res.status(400).json({
        success: false,
        message: "tripId and issueType are required",
      });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    const report = await DelayReport.create({
      trip: tripId,
      driver: trip.driver ? String(trip.driver) : String(req.user.id),
      reportedBy: String(req.user.id),
      reason: issueType,
      description: description || "",
      delayMinutes: Number(delayMinutes) || 0,
      status: "pending",
    });

    const studentName = req.user.name || "A student";
    const busNumber = trip.bus?.busNumber || "a bus";
    const notifTitle = `Student report: ${issueType}`;
    const notifMessage = description
      ? `${studentName}: ${description}`
      : `${studentName} reported "${issueType}" on ${busNumber}.`;

    try {
      if (trip.driver) {
        await Notification.create({
          recipient: String(trip.driver),
          title: notifTitle,
          message: notifMessage,
          type: "alert",
          relatedId: report._id,
        });
      }

      const admins = await User.find({ role: "admin" }).select("_id");
      if (admins.length) {
        const adminDocs = admins.map((a) => ({
          recipient: String(a._id),
          title: notifTitle,
          message: notifMessage,
          type: "alert",
          relatedId: report._id,
        }));
        await Notification.insertMany(adminDocs);
      }

      const io = getIO();

      if (trip.driver) {
        io.to(`user-${String(trip.driver)}`).emit("new-notification", {
          title: notifTitle,
          message: notifMessage,
          type: "alert",
          timestamp: new Date(),
        });
      }

      io.to("admins").emit("new-notification", {
        title: notifTitle,
        message: notifMessage,
        type: "alert",
        timestamp: new Date(),
      });

      io.to("admins").emit("admin-driver-report", {
        tripId: String(trip._id),
        issueType,
        description,
        reportedBy: req.user.id,
        timestamp: new Date(),
      });
    } catch (notifErr) {
      console.warn("Notification/socket failed:", notifErr.message);
    }

    return res.status(201).json({
      success: true,
      data: report,
      message: "Report submitted successfully",
    });
  } catch (err) {
    console.error("createReport error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to submit report",
    });
  }
};

// GET /api/reports — admin: list all reports
export const getAllReports = async (req, res) => {
  try {
    const reports = await DelayReport.find({})
      .populate("trip")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reports/pending — admin
export const getPendingReports = async (req, res) => {
  try {
    const reports = await DelayReport.find({ status: "pending" })
      .populate("trip")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/reports/:id — admin
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

// GET /api/reports/daily — admin
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
