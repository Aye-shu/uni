// server/models/Route.js
import mongoose from "mongoose";

const stopSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, default: "" },
    isCampusStop: { type: Boolean, default: false },
    location: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
    },
}, { _id: false });

const routeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    direction: { type: String, enum: ["outbound", "return"], default: "outbound" },
    startPoint: { type: String, default: "" },
    endPoint: { type: String, default: "" },
    stops: { type: [stopSchema], default: [] },   // ← inline stops
    distance: { type: Number, default: 0 },
    estimatedDuration: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
}, { timestamps: true });

const Route = mongoose.model("Route", routeSchema);
export default Route;