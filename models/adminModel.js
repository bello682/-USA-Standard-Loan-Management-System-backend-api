const { Schema, model } = require("mongoose");
const moment = require("moment");

const adminSchema = new Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true },

    // USA Standard: Multi-level authorization
    role: {
      type: String,
      default: "admin",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "inactive",
    },
    isVerified: { type: Boolean, default: false },

    // Security & Session Tracking
    lastLogin: { type: Date },
    loginIp: { type: String }, // For security audits
    otp: { type: String },
    otpExpiresAt: { type: Date },

    // Active session metrics for performance tracking
    activeDuration: { type: Number, default: 0 }, // in minutes

    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    date_created: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = model("Admin", adminSchema);
