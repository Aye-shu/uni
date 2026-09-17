// server/seed-trips.js
import "dotenv/config";
import mongoose from "mongoose";
import Bus from "./models/Bus.js";
import Route from "./models/Route.js";
import Trip from "./models/Trip.js";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const OUTBOUND = [
  ["07:30","08:15"],["08:30","09:15"],["09:15","10:00"],
  ["10:30","11:15"],["11:45","12:30"],["13:00","13:45"],["14:30","15:15"]
];

const RETURN = [
  ["13:00","13:45"],["15:30","16:15"],["16:45","17:30"],
  ["17:45","18:30"],["18:45","19:30"],["20:00","20:45"]
];

// Safe modulo (never returns negative)
const safeMod = (n, m) => ((n % m) + m) % m;

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const buses = await Bus.find({});
    if (buses.length === 0) { console.error("❌ No buses. Run seed-buses.js first."); process.exit(1); }

    const routeA = await Route.findOne({ code: "MR-UNI" });
    const routeB = await Route.findOne({ code: "UNI-MR" });
    if (!routeA || !routeB) { console.error("❌ Routes missing."); process.exit(1); }

    console.log(`✅ Found ${buses.length} buses, 2 routes`);

    await Trip.deleteMany({});
    console.log("🧹 Cleared existing trips");

    const today = new Date();
    const list = [];

    for (const day of DAYS) {
      // Outbound trips
      OUTBOUND.forEach((slot, i) => {
        const bus = buses[safeMod(i, buses.length)];
        list.push({
          bus: bus._id,
          route: routeA._id,
          driver: bus.currentDriver || "seed-driver-1",
          date: today,
          day,
          direction: "outbound",
          departureTime: slot[0],
          arrivalTime: slot[1],
          status: "scheduled",
          currentLocation: { latitude: 0, longitude: 0 },
          bookings: [],
          availableSeats: bus.capacity,
        });
      });

      // Return trips
      RETURN.forEach((slot, i) => {
        const bus = buses[safeMod(i, buses.length)];
        list.push({
          bus: bus._id,
          route: routeB._id,
          driver: bus.currentDriver || "seed-driver-1",
          date: today,
          day,
          direction: "return",
          departureTime: slot[0],
          arrivalTime: slot[1],
          status: "scheduled",
          currentLocation: { latitude: 0, longitude: 0 },
          bookings: [],
          availableSeats: bus.capacity,
        });
      });
    }

    const trips = await Trip.insertMany(list);
    const todayName = new Date().toLocaleDateString('en-US',{weekday:'long'});

    console.log(`✅ Created ${trips.length} trips`);
    console.log(`   • Today (${todayName}) outbound: ${trips.filter(t=>t.day===todayName&&t.direction==='outbound').length}`);
    console.log(`   • Today (${todayName}) return: ${trips.filter(t=>t.day===todayName&&t.direction==='return').length}`);

    await mongoose.connection.close();
    console.log("✅ Done!");
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
  }
}

seed();
