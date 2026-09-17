// server/config/socket.js
import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
  origin: process.env.FRONTEND_URL || "http://localhost:5000",
  methods: ["GET", "POST"],
  credentials: true,
},
  });

  io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Join a specific trip room
    socket.on("join-trip", (tripId) => {
      socket.join(`trip-${tripId}`);
      console.log(`📍 ${socket.id} joined trip-${tripId}`);
    });

    // Leave a trip room
    socket.on("leave-trip", (tripId) => {
      socket.leave(`trip-${tripId}`);
      console.log(`📍 ${socket.id} left trip-${tripId}`);
    });

    // Join admin monitoring room
    socket.on("join-admin-room", () => {
      socket.join("admins");
      console.log(`👨‍💼 ${socket.id} joined admins room`);
    });

    // Driver broadcasts location
    socket.on("update-location", (data) => {
      const { tripId, latitude, longitude } = data;
      io.to(`trip-${tripId}`).emit("location-updated", {
        tripId,
        latitude,
        longitude,
        timestamp: new Date(),
      });
    });

    // Trip status update — forwards ALL fields
    socket.on("trip-status-update", (data) => {
      const { tripId, ...rest } = data;
      if (!tripId) return;

      io.to(`trip-${tripId}`).emit("trip-status-changed", {
        tripId,
        ...rest,
        timestamp: new Date(),
      });

      // Also notify admins
      io.to("admins").emit("admin-trip-update", {
        tripId,
        ...rest,
        timestamp: new Date(),
      });
    });

    // NEW: Driver report — rich data for students
    socket.on("driver-report", (data) => {
      const { tripId } = data;
      if (!tripId) return;

      console.log(`📢 Driver report broadcast for trip ${tripId}:`, data);

      io.to(`trip-${tripId}`).emit("driver-report-received", {
        ...data,
        timestamp: new Date(),
      });

      // Also notify admins
      io.to("admins").emit("admin-driver-report", {
        ...data,
        timestamp: new Date(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

export default { initSocket, getIO };