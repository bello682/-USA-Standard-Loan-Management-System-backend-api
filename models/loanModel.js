const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");

mongoose.set("bufferCommands", true); // Enable command buffering for all models

const LoanSchema = new Schema(
  {
    // RELATIONSHIPS
    userId: {
      type: Schema.Types.ObjectId,
      ref: "LoanUserData", // Links to our perfect user model
      required: true,
    },
    assignedAdmin: {
      type: Schema.Types.ObjectId,
      ref: "Admin", // Links to the registered Admin model
      default: null,
    },

    // LOAN SPECIFICS
    loanAccountNumber: {
      type: String,
      unique: true,
    },
    loanType: {
      type: String,
      enum: ["personal", "business", "student", "auto", "home"],
      required: true,
    },
    amount: { type: Number, required: true },
    upfrontFee: { type: Number, default: 0 }, // This is your "upfront"
    interestRate: { type: Number, required: true }, // This is your "InterestRate(%)"
    durationMonths: { type: Number, required: true }, // durationYears * 12
    monthlyPayment: { type: Number, required: true }, // This is your "MonthlyRepayment"
    totalInterest: { type: Number, required: true }, // New field
    totalRepayment: { type: Number, required: true }, // This is your "TotalReturn"

    // USER SNAPSHOT (For quick access without population)
    userName: { type: String, required: true },
    userEmail: { type: String, required: true, index: true },

    // CHAT & AI MANAGEMENT
    unread: {
      user: { type: Number, default: 0 },
      admin: { type: Number, default: 0 },
    },
    aiAssistant: {
      isActive: { type: Boolean, default: true },
      lastSummary: { type: String }, // AI summarizes the chat for the human agent
      riskLevel: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "low",
      },
      sentiment: { type: String }, // e.g., "angry", "satisfied", "inquiring"
    },

    // STATUS & PROGRESS
    status: {
      type: String,
      enum: [
        "pending", // Initial state
        "under_review", // Admin is checking documents
        "approved", // Approved but waiting for fee
        "deposit_paid", // Upfront fee received
        "funded", // Money sent to user
        "rejected",
        "defaulted", // User missed payments
        "completed", // Fully paid back
      ],
      default: "pending",
    },
    repaymentProgress: { type: Number, default: 0 }, // Percentage 0-100
    nextPaymentDate: { type: Date },

    // COMPLIANCE AUDIT TRAIL (Required for US Banking Audits)
    auditTrail: [
      {
        action: String, // e.g., "STATUS_CHANGE_TO_APPROVED"
        performedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
        note: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: {
      createdAt: "date_applied",
      updatedAt: "last_updated",
    },
  },
);

/**
 * Account Number Generator
 */
LoanSchema.pre("save", function () {
  if (!this.loanAccountNumber) {
    const prefix = "LN";
    const random = Math.floor(100000 + Math.random() * 900000);
    this.loanAccountNumber = `${prefix}-${random}`;
  }
  // In modern Mongoose, if you don't include 'next' in the arguments,
  // simply finishing the function or returning is enough.
});

// High-speed lookups for status and AI tracking
LoanSchema.index({ status: 1 });
LoanSchema.index({ "aiAssistant.isActive": 1 });
LoanSchema.index({ amount: 1 });
// In your Loan Model file
LoanSchema.index({ userId: 1 });
LoanSchema.index({ date_applied: -1 });
// Add this to your schema file
LoanSchema.index({ date_applied: -1, status: 1 });

module.exports = mongoose.models.LoanData || model("LoanData", LoanSchema);
