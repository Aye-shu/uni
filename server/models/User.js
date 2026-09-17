// server/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: String, // Better Auth uses String IDs
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: "" },
    role: {
      type: String,
      enum: ["student", "driver", "admin"],
      default: "student",
    },
    phone: { type: String, trim: true },
    profileImage: { type: String, default: "" },
    // Student specific
    studentId: { type: String, sparse: true },
    department: { type: String },
    // Driver specific
    licenseNumber: { type: String, sparse: true },
    assignedBus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "user", // ← Better Auth's collection name
    strict: false, // allow Better Auth fields
  }
);

const User = mongoose.model("User", userSchema);
export default User;