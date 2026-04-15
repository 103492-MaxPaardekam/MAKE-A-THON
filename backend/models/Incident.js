import mongoose from "mongoose";

const IncidentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    region: {
      type: String,
      required: true,
    },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    time: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      enum: [
        "air-alert-ukraine",
        "state-emergency-service",
        "relief-web",
        "icrc",
        "crowd-sourced",
        "mock",
      ],
      default: "mock",
    },
    confidenceScore: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    validationStatus: {
      type: String,
      enum: ["verified", "unverified", "unknown"],
      default: "unknown",
    },
    status: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    advice: {
      type: String,
      default: "let op",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Incident", IncidentSchema);
