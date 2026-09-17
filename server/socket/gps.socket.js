import { getIO } from "../config/socket.js";

export const broadcastLocation = (tripId, latitude, longitude) => {
  const io = getIO();
  io.to(`trip-${tripId}`).emit("location-updated", {
    tripId,
    latitude,
    longitude,
    timestamp: new Date(),
  });
};

export default broadcastLocation;