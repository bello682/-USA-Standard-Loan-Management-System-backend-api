const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");

mongoose.set("bufferCommands", false);
// Sub-schema for USA Bank Info (Required for Direct Deposit/ACH)
const BankInfoSchema = new Schema(
  {
    bankName: { type: String },
    routingNumber: { type: String }, // Essential for USA 9-digit bank routing
    accountNumber: { type: String },
    accountType: {
      type: String,
      enum: ["Checking", "Savings"],
      default: "Checking",
    },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    // CORE IDENTITY
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    phoneNumber: { type: String },

    // ACCESS CONTROL
    role: { type: String, default: "user" },
    isGuest: { type: Boolean, default: false }, // TRUE if they only provided email to chat with AI
    status: {
      type: String,
      enum: ["active", "inactive", "blacklisted", "suspended"],
      default: "inactive",
    },

    aiAssistant: {
      isActive: {
        type: Boolean,
        default: true,
      },
    },

    loanDetails: [
      {
        type: Schema.Types.ObjectId,
        ref: "LoanData",
      },
    ],
    // PROFILE & PERSONAL DETAILS
    profilePicture: { type: String, default: "" }, // URL to Cloudinary/S3

    // USA COMPLIANCE & KYC [Cites: 1.1, 1.4]
    kyc: {
      ssnLastFour: { type: String }, // For soft credit pulls (standard USA)
      dateOfBirth: { type: Date },
      occupation: { type: String },
      placeOfWork: { type: String },
      documentType: {
        type: String,
        enum: ["passport", "driverLicense", "idCard"],
      },
      documentImage: { type: String }, // URL to Cloudinary/S3
      address: {
        street: String,
        city: String,
        state: String, // Critical: USA lending laws vary by state
        zipCode: String,
      },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
    },

    // FINANCIAL PROFILE
    bankInfo: BankInfoSchema,
    creditScore: { type: Number, default: 0 },
    facialVerification: { type: Boolean, default: false },

    // SECURITY & AUTHENTICATION (The "Likes" you asked for) [Cites: 3.2, 3.4]
    otp: { type: String },
    otpExpiresAt: { type: Date },
    isVerified: { type: Boolean, default: false },

    // Password Reset Fields (Essential for Production)
    resetPasswordToken: { type: String },
    resetPasswordExpiresAt: { type: Date },

    // Session & Audit Trail
    lastLogin: { type: Date },
    loginIp: { type: String },
    totalLoansTaken: { type: Number, default: 0 },
  },
  {
    timestamps: {
      createdAt: "date_created",
      updatedAt: "date_updated",
    },
  },
);

UserSchema.index({ status: 1 });

module.exports = model("LoanUserData", UserSchema);
