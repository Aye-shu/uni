// server/services/recommendation.service.js
import Trip from "../models/Trip.js";
import ClassSchedule from "../models/ClassSchedule.js";

/**
 * Convert "HH:MM" to minutes since midnight
 */
const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Find available trips for a given day and direction,
 * sorted by how close they are to the target time.
 */
export const findAvailableTrips = async ({ day, direction, afterTime }) => {
  const filter = {
    day,
    status: { $in: ["scheduled", "delayed"] },
  };
  if (direction) filter.direction = direction;

  let trips = await Trip.find(filter)
    .populate("bus")
    .populate("route")
    .sort({ departureTime: 1 });

  // Only trips with seats
  trips = trips.filter((t) => t.availableSeats > 0);

  // Filter by departure time if requested
  if (afterTime) {
    const target = timeToMinutes(afterTime);
    trips = trips.filter((t) => timeToMinutes(t.departureTime) >= target);
  }

  return trips;
};

/**
 * Recommend the best bus for a student based on their next class.
 *
 * Logic:
 *  - Get the student's class
 *  - Find trips departing 30-90 minutes BEFORE the class starts
 *  - Prefer the closest match with available seats
 */
export const recommendBusForClass = async ({ studentId, classId, direction = "outbound" }) => {
  const cls = await ClassSchedule.findById(classId);
  if (!cls) throw new Error("Class not found");
  if (cls.student !== studentId) throw new Error("Not your class");

  const classStart = timeToMinutes(cls.startTime);

  // Preferred window: 30–90 min before class
  const earliest = classStart - 90;
  const latest = classStart - 30;

  const trips = await Trip.find({
    day: cls.day,
    direction,
    status: { $in: ["scheduled", "delayed"] },
  })
    .populate("bus")
    .populate("route")
    .sort({ departureTime: 1 });

  const inWindow = trips.filter((t) => {
    const dep = timeToMinutes(t.departureTime);
    return dep >= earliest && dep <= latest && t.availableSeats > 0;
  });

  if (inWindow.length === 0) {
    // Fallback: any trip before class with seats
    const fallback = trips
      .filter((t) => timeToMinutes(t.departureTime) <= classStart && t.availableSeats > 0)
      .sort((a, b) => {
        const aDiff = classStart - timeToMinutes(a.departureTime);
        const bDiff = classStart - timeToMinutes(b.departureTime);
        return aDiff - bDiff;
      });

    return {
      class: cls,
      recommendation: fallback[0] || null,
      alternatives: fallback.slice(1),
      reason: fallback.length > 0 ? "Closest available before class" : "No trips found",
    };
  }

  return {
    class: cls,
    recommendation: inWindow[0],
    alternatives: inWindow.slice(1),
    reason: "Fits comfortably before class",
  };
};

/**
 * Recommend a return bus after the student's last class of the day.
 */
export const recommendReturnBus = async ({ studentId, day }) => {
  const classes = await ClassSchedule.find({ student: studentId, day });
  if (classes.length === 0) throw new Error("No classes on this day");

  // Last class end time
  const lastEnd = classes.reduce((latest, c) => {
    const t = timeToMinutes(c.endTime);
    return t > latest ? t : latest;
  }, 0);

  const targetTime = String(Math.floor(lastEnd / 60)).padStart(2, "0") +
                     ":" + String(lastEnd % 60).padStart(2, "0");

  const trips = await findAvailableTrips({
    day,
    direction: "return",
    afterTime: targetTime,
  });

  return {
    lastClassEndTime: targetTime,
    recommendation: trips[0] || null,
    alternatives: trips.slice(1),
  };
};

/**
 * Generic recommendation — used by /api/recommendations/find
 */
export const getRecommendations = async ({ day, endTime, direction = "outbound" }) => {
  const trips = await findAvailableTrips({ day, direction, afterTime: endTime });
  return {
    recommendation: trips[0] || null,
    alternatives: trips.slice(1),
    totalFound: trips.length,
  };
};

export default {
  findAvailableTrips,
  recommendBusForClass,
  recommendReturnBus,
  getRecommendations,
};