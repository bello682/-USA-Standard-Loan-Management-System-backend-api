const { Schema, model } = require("mongoose");

const ChatMessageSchema = new Schema(
	{
		applicationId: {
			type: Schema.Types.ObjectId,
			ref: "LoanData",
			required: false, // Now optional for user-based chat
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: "LoanUserData",
			required: true, // Always required for user/guest chat
		},

		// Handling both Guests and Registered
		senderType: {
			type: String,
			enum: ["user", "admin", "ai-bot", "system"],
			required: true,
		},

		senderId: { type: Schema.Types.ObjectId }, // Can be Admin ID, User ID, or null (if Guest)
		senderName: { type: String }, // Fallback for Guests
		senderEmail: { type: String }, // Fallback for Guests

		messageType: {
			type: String,
			enum: ["text", "file", "action-required"],
			default: "text",
		},
		text: { type: String },

		// AI Specific Metadata
		aiMetadata: {
			confidence: { type: Number }, // How sure the AI was of this answer
			intent: { type: String }, // e.g., "asking_about_interest_rates"
			isFlagged: { type: Boolean, default: false }, // Flagged for Human Admin review
		},

		attachments: [{ url: String, filename: String }],
		readBy: [{ userId: Schema.Types.ObjectId, readAt: Date }],
	},
	{ timestamps: true },
);

module.exports = model("ChatMessage", ChatMessageSchema);
