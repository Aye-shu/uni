// server/models/ClassSchedule.js
import mongoose from "mongoose";

const classScheduleSchema = new mongoose.Schema(
  {
    student: {
      type: String, // ← Better Auth IDs are strings
      ref: "User",
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    code: { type: String, required: true },
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      required: true,
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
     location: { type: String, default: '' },
    building: { type: String },
    room: { type: String },
  },
  { timestamps: true }
);

classScheduleSchema.index({ student: 1, day: 1 });

const ClassSchedule = mongoose.model("ClassSchedule", classScheduleSchema);
export default ClassSchedule;