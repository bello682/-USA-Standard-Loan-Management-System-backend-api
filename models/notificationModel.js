const { Schema, model } = require("mongoose");

const notificationSchema = new Schema({
  // Targeting
  recipientId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  guestId: { type: Schema.Types.ObjectId, ref: "GuestUser", index: true },
  scope: {
    type: String,
    enum: ["individual", "global", "role_based"],
    default: "individual",
  },

  // Categorization (Matches your requirement for success, warning, etc.)
  category: {
    type: String,
    enum: ["info", "success", "warning", "error", "system_alert"],
    default: "info",
  },

  adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model("Notification", notificationSchema);
