// server/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import fs from "fs";

import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";

import { connectDB } from "./config/db.js";
import { initSocket } from "./config/socket.js";
import { initAuth, getAuth } from "./config/auth.js";
import { errorHandler } from "./middleware/error.middleware.js";

// ---------- Register models ----------
import "./models/User.js";
import "./models/Bus.js";
import "./models/Route.js";
import "./models/Stop.js";
import "./models/Trip.js";
import "./models/Booking.js";
import "./models/ClassSchedule.js";
import "./models/Notification.js";
import "./models/DelayReport.js";

// ---------- Routes ----------
import studentRoutes from "./routes/student.routes.js";
import driverRoutes  from "./routes/driver.routes.js";
import adminRoutes   from "./routes/admin.routes.js";

import bookingRoutes        from "./routes/booking.routes.js";
import busRoutes            from "./routes/bus.routes.js";
import classRoutes          from "./routes/class.routes.js";
import notificationRoutes   from "./routes/notification.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import reportRoutes         from "./routes/report.routes.js";
import routeRoutes          from "./routes/route.routes.js";
import trackingRoutes       from "./routes/tracking.routes.js";
import tripRoutes           from "./routes/trip.routes.js";

// ---------- __dirname for ESM ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIR = path.join(__dirname, "..", "client");

console.log("📁 CLIENT_DIR =", CLIENT_DIR);
console.log("📁 Files present:", fs.existsSync(CLIENT_DIR) ? fs.readdirSync(CLIENT_DIR) : "DIRECTORY MISSING");

const app = express();
const server = http.createServer(app);

initSocket(server);

// NEW
app.use(cors({
  origin: [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "https://uni-a-c261.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await initAuth();
    const auth = getAuth();

    // 1. Better Auth BEFORE json
    app.all("/api/auth/*splat", toNodeHandler(auth));

    // 2. JSON body parsers
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 3. API routes
    app.use("/api/student", studentRoutes);
    app.use("/api/driver",  driverRoutes);
    app.use("/api/admin",   adminRoutes);

    app.use("/api/bookings",        bookingRoutes);
    app.use("/api/buses",           busRoutes);
app.use("/api/classes", classRoutes);
    app.use("/api/notifications",   notificationRoutes);
    app.use("/api/recommendations", recommendationRoutes);
    app.use("/api/reports",         reportRoutes);
    app.use("/api/routes",          routeRoutes);
    app.use("/api/tracking",        trackingRoutes);
    app.use("/api/trips",           tripRoutes);

    app.get("/api/health", (req, res) =>
      res.json({ status: "OK", message: "UniBus API is running" })
    );

    // 4a. Disable caching for HTML during development
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

    // 4. Static assets (css/js/images)
    app.use("/css",     express.static(path.join(CLIENT_DIR, "css")));
    app.use("/js",      express.static(path.join(CLIENT_DIR, "js")));
    app.use("/assets",  express.static(path.join(CLIENT_DIR, "assets")));

    // 5. Explicit HTML routes — bulletproof
    const sendPage = (file) => (req, res) => {
      const filePath = path.join(CLIENT_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Missing file: ${filePath}`);
        return res.status(404).send(`Page not found: ${file}`);
      }
      res.sendFile(filePath);
    };

    app.get("/",             sendPage("index.html"));
    app.get("/index.html",   sendPage("index.html"));
    app.get("/login.html",   sendPage("login.html"));
    app.get("/signup.html",  sendPage("signup.html"));

    // Nested pages (student/driver/admin)
    app.get("/student/:page", (req, res) => {
      const filePath = path.join(CLIENT_DIR, "student", req.params.page);
      if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
      res.sendFile(filePath);
    });
    app.get("/driver/:page", (req, res) => {
      const filePath = path.join(CLIENT_DIR, "driver", req.params.page);
      if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
      res.sendFile(filePath);
    });
    app.get("/admin/:page", (req, res) => {
      const filePath = path.join(CLIENT_DIR, "admin", req.params.page);
      if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
      res.sendFile(filePath);
    });

    // 6. Generic static fallback for anything else in client/
    app.use(express.static(CLIENT_DIR));

    // 7. Error handler LAST
    app.use(errorHandler);

    // 8. Listen
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.io initialized`);
      console.log(`🔐 Auth: /api/auth/*`);
      console.log(`🌐 Frontend: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export { app, server };