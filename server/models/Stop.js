import mongoose from "mongoose";

const stopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    },
    address: {
      type: String,
    },
    isCampusStop: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Stop = mongoose.model("Stop", stopSchema);
export default Stop;