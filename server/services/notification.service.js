// server/services/notification.service.js
import Notification from "../models/Notification.js";
import User from "../models/User.js";

/**
 * Create a single notification
 */
export const createNotification = async ({
  recipient,
  title,
  message,
  type = "general",
  relatedId = null,
}) => {
  return Notification.create({
    recipient,
    title,
    message,
    type,
    relatedId,
  });
};

/**
 * Send a notification to many users at once
 */
export const sendBulkNotification = async (userIds, { title, message, type, relatedId }) => {
  const notifications = userIds.map((recipient) => ({
    recipient,
    title,
    message,
    type: type || "general",
    relatedId: relatedId || null,
  }));
  return Notification.insertMany(notifications);
};

/**
 * Notify all students with a confirmed booking on a trip
 * Used for delay alerts, cancellations, etc.
 */
export const notifyTripPassengers = async (tripId, { title, message, type = "trip", relatedId = null }) => {
  const Booking = (await import("../models/Booking.js")).default;

  const bookings = await Booking.find({ trip: tripId, status: "confirmed" }).select(
    "student"
  );
  const studentIds = bookings.map((b) => b.student);

  if (studentIds.length === 0) return [];

  return sendBulkNotification(studentIds, { title, message, type, relatedId });
};

/**
 * Notify admins about system events
 */
export const notifyAdmins = async ({ title, message, type = "alert", relatedId = null }) => {
  const admins = await User.find({ role: "admin" }).select("_id");
  const adminIds = admins.map((a) => a._id);
  if (adminIds.length === 0) return [];
  return sendBulkNotification(adminIds, { title, message, type, relatedId });
};

/**
 * Get unread count for a user
 */
export const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ recipient: userId, isRead: false });
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
  return Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true }
  );
};

/**
 * Delete old notifications (older than N days)
 */
export const cleanupOldNotifications = async (days = 30) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return Notification.deleteMany({
    isRead: true,
    createdAt: { $lt: cutoff },
  });
};

export default {
  createNotification,
  sendBulkNotification,
  notifyTripPassengers,
  notifyAdmins,
  getUnreadCount,
  markAllAsRead,
  cleanupOldNotifications,
};