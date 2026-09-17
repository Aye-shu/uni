// server/models/DelayReport.js
import mongoose from "mongoose";

const delayReportSchema = new mongoose.Schema(
  {
    trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    driver: { type: String, ref: "User", required: true },
    reportedBy: { type: String, ref: "User", required: true },
    delayMinutes: { type: Number, required: true },
    reason: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const DelayReport = mongoose.model("DelayReport", delayReportSchema);
export default DelayReport;