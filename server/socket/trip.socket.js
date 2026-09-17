import { getIO } from "../config/socket.js";

export const broadcastTripStatus = (tripId, status) => {
  const io = getIO();
  io.to(`trip-${tripId}`).emit("trip-status-changed", {
    tripId,
    status,
    timestamp: new Date(),
  });
};

export const broadcastTripUpdate = (tripId, data) => {
  const io = getIO();
  io.to(`trip-${tripId}`).emit("trip-updated", {
    tripId,
    ...data,
    timestamp: new Date(),
  });
};

export default { broadcastTripStatus, broadcastTripUpdate };