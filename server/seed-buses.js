// server/seed-trips.js
import "dotenv/config";
import mongoose from "mongoose";

import Bus from "./models/Bus.js";
import Route from "./models/Route.js";
import Trip from "./models/Trip.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SCHEDULE_OUTBOUND = [
    ["07:30", "08:15"],
    ["08:30", "09:15"],
    ["09:15", "10:00"],
    ["10:30", "11:15"],
    ["11:45", "12:30"],
    ["13:00", "13:45"],
    ["14:30", "15:15"],
];

const SCHEDULE_RETURN = [
    ["13:00", "13:45"],
    ["15:30", "16:15"],
    ["16:45", "17:30"],
    ["17:45", "18:30"],
    ["18:45", "19:30"],
    ["20:00", "20:45"],
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB");

        // ---------- Get existing buses and routes ----------
        const buses = await Bus.find({});
        if (buses.length === 0) {
            console.error("❌ No buses found. Run seed-buses.js first.");
            process.exit(1);
        }

        const routeA = await Route.findOne({ code: "MR-UNI" });
        const routeB = await Route.findOne({ code: "UNI-MR" });
        if (!routeA || !routeB) {
            console.error("❌ Routes not found. Run seed-buses.js first.");
            process.exit(1);
        }

        console.log(`✅ Found ${buses.length} buses, 2 routes`);

        // ---------- Clear old trips ----------
        await Trip.deleteMany({});
        console.log("🧹 Cleared existing trips");

        // ---------- Create trips ----------
        const today = new Date();
        const tripsToCreate = [];

        for (const day of DAYS) {
            const outboundBuses = [buses[0], buses[1], buses[2], buses[3], buses[4]];
            const returnBuses   = [buses[4], buses[3], buses[2], buses[1], buses[0]];

            // Outbound
            SCHEDULE_OUTBOUND.forEach((slot, i) => {
                const bus = outboundBuses[i % outboundBuses.length];
                tripsToCreate.push({
                    bus: bus._id,
                    route: routeA._id,
                    driver: bus.currentDriver || "seed-driver-1", // fallback if missing
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

            // Return
            SCHEDULE_RETURN.forEach((slot, i) => {
                const bus = returnBuses[i % returnBuses.length];
                tripsToCreate.push({
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

        const trips = await Trip.insertMany(tripsToCreate);
        console.log(`✅ Created ${trips.length} trips across all 7 days`);

        // ---------- Summary ----------
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayOutbound = trips.filter(t => t.day === todayName && t.direction === 'outbound');
        const todayReturn = trips.filter(t => t.day === todayName && t.direction === 'return');

        console.log("\n📊 Summary:");
        console.log(`  • Total trips: ${trips.length}`);
        console.log(`  • Today (${todayName}) outbound: ${todayOutbound.length}`);
        console.log(`  • Today (${todayName}) return: ${todayReturn.length}`);

        await mongoose.connection.close();
        console.log("\n✅ Done!");
    } catch (err) {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    }
}

seed();