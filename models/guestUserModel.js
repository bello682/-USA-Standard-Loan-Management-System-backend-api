const { Schema, model } = require("mongoose");

/* ===============================
   GUEST USER SCHEMA
   For unregistered users who want to chat
   Only requires name and email
================================ */

const GuestUserSchema = new Schema(
  {
    // CORE INFO (MINIMAL)
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // CHAT SESSION
    sessionToken: {
      type: String,
      unique: true,
    }, // Unique identifier for this guest session
    conversationHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "ChatMessage",
      },
    ],
    assignedAdmin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    }, // When escalated to human

    // ADD THIS STRUCTURE TO MATCH YOUR LOAN MODEL
    aiAssistant: {
      isActive: {
        type: Boolean,
        default: true, // Guests get AI help by default
      },
      lastInteractionAt: {
        type: Date,
        default: Date.now,
      },
    },

    // TRACKING
    isActive: {
      // This isActive refers to the session being alive, keep it separate from AI
      type: Boolean,
      default: true,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    sessionExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },

    // AI INTERACTION METADATA
    aiInteractionCount: {
      type: Number,
      default: 0,
    }, // How many messages with AI
    escalatedToAdmin: {
      type: Boolean,
      default: false,
    },
    escalationReason: {
      type: String,
    }, // Why was this escalated?
    escalatedAt: {
      type: Date,
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
);

// Auto-expire sessions after 24 hours (MongoDB TTL)
GuestUserSchema.index({ sessionExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model("GuestUser", GuestUserSchema);
