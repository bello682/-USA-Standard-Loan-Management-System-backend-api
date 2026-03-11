const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;
const HttpError = require("../models/errorModel");
const Admin = require("../models/adminModel");
const Loan = require("../models/loanModel");
const User = require("../models/userModel");
const crypto = require("crypto");
const { generateToken } = require("../utils/generateNumbers");
const moment = require("moment");
const sendUserOTPEmail = require("../utils/sendOtpEmail");
const sendWelcomeEmailToUser = require("../utils/welcomingNewUserEmail");
const emailService = require("../utils/emailService");
const { captureLoginMetadata } = require("../utils/security-logger");
const GuestUser = require("../models/guestUserModel");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Register Admin
// const registerAdmin = async (req, res, next) => {
//   try {
//     const { name, email, phoneNumber, password } = req.body;

//     // 1. Basic Validation
//     if (!name || !email || !phoneNumber || !password) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     // 2. Check existence BEFORE creating anything
//     const existing = await Admin.findOne({ email });
//     if (existing) {
//       return res
//         .status(400)
//         .json({ message: "Admin with this email already exists" });
//     }

//     // 3. Prepare Data (Do the heavy lifting before saving)
//     const hashed = await bcrypt.hash(password, 10);
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

//     // 4. Create the instance but DON'T use Admin.create yet (which saves immediately)
//     // Using 'new Admin' gives us an object we can attempt to save after the email attempt
//     const newAdmin = new Admin({
//       name,
//       email,
//       phoneNumber,
//       password: hashed,
//       otp,
//       otpExpiresAt,
//       isVerified: false, // Explicitly set
//     });

//     // 5. Attempt to send the email FIRST
//     try {
//       await sendUserOTPEmail(newAdmin.email, otp, newAdmin.name);
//     } catch (emailError) {
//       console.error("Email Service Error:", emailError);
//       return res.status(500).json({
//         message:
//           "Could not send verification email. Your account was not created. Please try again.",
//       });
//     }

//     // 6. Only save to DB if email sending didn't throw an error
//     await newAdmin.save();

//     // 7. Generate Tokens
//     const { accessToken, refreshToken } = generateToken(
//       newAdmin._id,
//       newAdmin.email,
//       newAdmin.role,
//     );

//     return res.status(201).json({
//       success: true,
//       message: `Registration successful. Verify with the OTP sent to ${newAdmin.email}.`,
//       accessToken,
//       refreshToken,
//       user: {
//         id: newAdmin._id,
//         name: newAdmin.name,
//         email: newAdmin.email,
//         role: newAdmin.role,
//         isVerified: newAdmin.isVerified,
//       },
//     });
//   } catch (error) {
//     console.error("Global Registration Error:", error);
//     return res
//       .status(500)
//       .json({ message: "An unexpected error occurred during registration." });
//   }
// };
const registerAdmin = async (req, res, next) => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    // 1. Basic Validation
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. Check existence BEFORE creating anything
    let admin = await Admin.findOne({ email });

    if (admin && admin.isVerified) {
      return res
        .status(400)
        .json({ message: "Admin with this email already exists" });
    }

    // 3. Prepare Data
    const hashed = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 4. Attempt to send the email FIRST
    // (Notice: used 'email' and 'name' from req.body directly)
    try {
      await sendUserOTPEmail(email, otp, name);
    } catch (emailError) {
      console.error("Email Service Error:", emailError);
      return res.status(500).json({
        message: "Could not send verification email. Please try again.",
      });
    }

    // 5. Update Existing or Create New
    if (admin) {
      // Update unverified record
      admin.name = name;
      admin.phoneNumber = phoneNumber;
      admin.password = hashed;
      admin.otp = otp;
      admin.otpExpiresAt = otpExpiresAt;
      await admin.save();
    } else {
      // Create new record instance
      admin = new Admin({
        name,
        email,
        phoneNumber,
        password: hashed,
        otp,
        otpExpiresAt,
        isVerified: false,
      });
      await admin.save();
    }

    // 6. Generate Tokens (Notice: used 'admin' variable)
    const { accessToken, refreshToken } = generateToken(
      admin._id,
      admin.email,
      admin.role,
    );

    return res.status(201).json({
      success: true,
      message: `Registration successful. Verify with the OTP sent to ${admin.email}.`,
      accessToken,
      refreshToken,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isVerified: admin.isVerified,
      },
    });
  } catch (error) {
    console.error("Global Registration Error:", error);
    return res
      .status(500)
      .json({ message: "An unexpected error occurred during registration." });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    // 1. Get email and otp from the body (don't rely only on the token here)
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const admin = await Admin.findOne({ email });

    // 2. Check existence and status
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // 3. String comparison for OTP and check expiry
    if (String(admin.otp) !== String(otp) || admin.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // 4. Success - Update status to active
    admin.status = "active"; // MUST set this to active so middleware works later
    admin.isVerified = true;
    admin.otp = null;
    admin.otpExpiresAt = null;
    await admin.save();

    await sendWelcomeEmailToUser(admin.email, admin.name);

    const { accessToken, refreshToken } = generateToken(
      admin._id,
      admin.email,
      admin.role,
    );

    return res.status(200).json({
      success: true,
      message: "Admin verified successfully",
      accessToken,
      refreshToken,
      admin: admin, // This will match your Redux 'user' mapping
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

// Resend OTP
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body; // Ensure this is coming through

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    admin.otp = newOtp;
    admin.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await admin.save();

    // Try/Catch specifically for email to prevent 30s timeout from killing the whole request
    try {
      await sendUserOTPEmail(admin.email, newOtp, admin.name);
    } catch (mailErr) {
      console.error("Mail Delivery Failed:", mailErr);
      // We still continue because the OTP is saved in DB
    }

    const { accessToken, refreshToken } = generateToken(
      admin._id,
      admin.email,
      admin.role,
    );

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
      user: admin, // ADD THIS: Return the user object so the frontend can "re-fill" the email
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: "OTP resend failed" });
  }
};

// ================= ADMIN AUTH & MGMT =================
const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Check if email/password exists in request
    if (!email || !password) {
      return next(new HttpError("Please provide email and password", 400));
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    // 2. Validate Admin existence and password
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return next(new HttpError("Invalid credentials", 401));
    }

    // 3. SAFE METADATA CAPTURE (Don't let this crash the login)
    let metadata = {
      clientIp: "Unknown",
      device: "Unknown",
      location: "Unknown",
    };
    try {
      metadata = await captureLoginMetadata(req);
    } catch (metaErr) {
      console.error("Metadata capture failed, continuing login...");
    }

    // 4. NON-BLOCKING EMAIL SERVICE
    emailService
      .sendSecurityEmail(admin.email, {
        ip: metadata.clientIp,
        device: metadata.device,
        location: metadata.location,
        time: new Date().toLocaleString(),
      })
      .catch((err) => console.error("Security Email failed to send:", err));

    // 5. UPDATE ADMIN (Wrapped in try/catch to be safe)
    try {
      admin.lastLogin = new Date();
      admin.status = "active";
      await admin.save({ validateBeforeSave: false }); // Avoid validation errors on old records
    } catch (saveErr) {
      console.error("Failed to update admin lastLogin:", saveErr);
    }

    // 6. GENERATE TOKEN
    const token = generateToken(admin._id, admin.email, admin.role);

    res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("CRITICAL LOGIN ERROR:", err); // This shows you the REAL error in your terminal
    next(new HttpError(err.message || "Login failed", 500));
  }
};

const logoutAdmin = async (req, res, next) => {
  try {
    const userId = req.admin.id;
    const admin = await Admin.findById(userId);

    if (!admin) {
      // console.log("No user", admin, userId);
      return next(new HttpError("User not found.", 404));
    }

    admin.status = "inactive";
    admin.timeOfInactive = moment().format("YYYY-MM-DD HH:mm:ss");
    await admin.save();

    res
      .status(200)
      .json({ success: true, message: `${admin.email} Logout successful` });
  } catch (err) {
    console.error("Error during admin logout:", err);
    next(new HttpError("Logout failed, please try again.", 500));
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await admin.save();

    // Send password reset email using emailService
    const resetLink = `${process.env.WEBSITE_URL || "http://localhost:3000"}/admin/auth/reset-admin-password/${resetToken}`;
    await emailService.sendPasswordResetEmail(
      admin.email,
      admin.name,
      resetLink,
    );

    res.status(200).json({
      success: true,
      message: `Reset password instructions have been sent to ${admin.email}`,
      resetToken,
    });
  } catch (error) {
    console.error("Forget password error:", error);
    res.status(500).json({
      message: "Failed to send password reset link, please try again.",
    });
  }
};

// Reset Password
const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const { token } = req.params;

    // 1. Basic validation
    if (!newPassword || newPassword.length < 12) {
      return res.status(400).json({
        message: "Password must be at least 12 characters long.",
      });
    }

    // 2. Hash the incoming token to match what might be in the DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // 3. Find admin with valid token (checking both raw and hashed for safety)
    const admin = await Admin.findOne({
      $or: [{ resetPasswordToken: token }, { resetPasswordToken: hashedToken }],
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // 4. PREVENT REUSE: Check if new password is same as the old one
    const isSamePassword = await bcrypt.compare(newPassword, admin.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password cannot be the same as your current password.",
      });
    }

    // 5. Hash new password and clear reset fields
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);

    // Using undefined removes the fields from the MongoDB document
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpires = undefined;

    await admin.save();

    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now login with your new credentials.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Admin User
const fetchAdmin = async (req, res, next) => {
  // console.log("fetchAdmin called");
  try {
    // console.log("req.admin:", req.admin);
    const userId = req.admin.id; // middleware is actually using req.admin, for user it is req.user

    // console.log("Fetching admin with ID:", userId);
    if (!userId) {
      return next(new HttpError("User ID not found", 400));
    }

    const admin = await Admin.findById(userId);

    if (!admin) {
      return next(new HttpError("admin not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "admin retrieved successfully",
      data: { admin },
    });
  } catch (err) {
    console.error("Error in getAdmin:", err);
    next(new HttpError("Failed to retrieve admin", 500));
  }
};

// ================= DASHBOARD POWER FEATURES =================

/** * GET DASHBOARD STATS (For Frontend Charts)
 * Returns: Total users, active loans, total funded, pending approvals
 */
// ================= LOAN CONTROL POWERS =================
const getDashboardStats = async (req, res) => {
  try {
    const [userCount, pendingCount, fundedCount, aiCount, revenueResult] =
      await Promise.all([
        User.countDocuments(),
        Loan.countDocuments({ status: "pending" }), // Change LoanData to Loan
        Loan.countDocuments({ status: "funded" }), // Change LoanData to Loan
        Loan.countDocuments({ "aiAssistant.isActive": true }), // Change LoanData to Loan
        Loan.aggregate([
          { $match: { status: "funded" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);

    res.status(200).json({
      success: true,
      stats: {
        totalUsers: userCount,
        pendingLoans: pendingCount,
        activeLoans: fundedCount,
        revenue: revenueResult[0]?.total || 0,
        aiManaged: aiCount,
      },
    });
  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/** * MANAGE LOAN STATUS (Approve, Reject, Fund, Terminate)
 * This also updates the Audit Trail automatically.
 */
const updateLoanStatus = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { status, note } = req.body; // status: "approved", "funded", "rejected", etc.

    const loan = await Loan.findById(loanId);
    if (!loan) return next(new HttpError("Loan application not found", 404));

    loan.status = status;

    // Add to Audit Trail (USA Compliance Requirement)
    loan.auditTrail.push({
      action: `STATUS_CHANGE_TO_${status.toUpperCase()}`,
      performedBy: req.admin._id,
      note: note || "Status updated by Admin",
      timestamp: new Date(),
    });

    await loan.save();
    res
      .status(200)
      .json({ success: true, message: `Loan ${status} successfully`, loan });
  } catch (err) {
    next(new HttpError("Update failed", 500));
  }
};

// ================= USER CONTROL POWERS =================

/**
 * DELETE ENTIRE USER SYSTEM
 * Power: Wipes a user and all their loan history (Super Admin Only)
 */
const deleteUserCompletely = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // 1. Delete all loans associated with user
    await Loan.deleteMany({ userId });

    // 2. Delete User
    const user = await User.findByIdAndDelete(userId);

    if (!user) return next(new HttpError("User not found", 404));

    res
      .status(200)
      .json({ success: true, message: "User and all loan history wiped." });
  } catch (err) {
    next(new HttpError("Deletion failed", 500));
  }
};

/**
 * TOGGLE AI ASSISTANT
 * Power: Turn AI on/off for a specific loan chat
 */
const toggleLoanAI = async (req, res, next) => {
  try {
    const { loanId: targetId } = req.params;
    const { isActive } = req.body;

    console.log(`--- AI TOGGLE START ---`);
    console.log(`Searching for ID: ${targetId}`);

    // 1. Try Guest Table
    let record = await GuestUser.findByIdAndUpdate(
      targetId,
      { $set: { "aiAssistant.isActive": isActive } },
      { new: true },
    );

    // 2. Try User Table
    if (!record) {
      record = await User.findByIdAndUpdate(
        targetId,
        { $set: { "aiAssistant.isActive": isActive } },
        { new: true },
      );
    }

    // 3. NEW: Try the LOAN Table (This is what you need right now!)
    if (!record) {
      // Replace 'Loan' with whatever your Loan/Application model is named
      record = await Loan.findByIdAndUpdate(
        targetId,
        { $set: { "aiAssistant.isActive": isActive } },
        { new: true },
      );
    }

    if (record) {
      console.log(`[SUCCESS] Found and Updated`);
      return res.status(200).json({
        success: true,
        isActive: record.aiAssistant?.isActive,
      });
    }

    console.log(`[404] ID ${targetId} not found anywhere`);
    return res.status(404).json({
      success: false,
      message: "Identity not found in database",
    });
  } catch (err) {
    console.error("Toggle Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getAllLoans = async (req, res, next) => {
  try {
    const AdminData = await Admin.find();
    const LoanData = await Loan.find();
    const UserData = await User.find();
    const GuestUserData = await GuestUser.find();

    // 1. Fetch Registered Loans (and populate user data)
    const loans = await Loan.find()
      .populate("userId")
      .sort({ updatedAt: -1 })
      .lean();

    // 2. Fetch Guest Chat Sessions
    const guests = await GuestUser.find({ isActive: true })
      .sort({ lastActivityAt: -1 })
      .lean();

    // 3. Format Registered Loans for the UI
    const formattedLoans = loans
      .filter((loan) => loan.userId !== null)
      .map((loan) => ({
        _id: loan._id,
        chatId: loan._id, // Room ID for socket
        userId: loan.userId?._id,
        userName: loan.userId?.fullName || "Unknown User",
        userEmail: loan.userId?.email || "No Email",
        amount: loan.amount || 0,
        status: loan.status,
        isGuest: false,
        aiEnabled: loan.aiAssistant?.isActive ?? false,
        updatedAt: loan.updatedAt,
      }));

    // 4. Format Guests to look like "Loans" so the frontend table doesn't break
    const formattedGuests = guests.map((guest) => ({
      _id: guest._id,
      chatId: guest._id, // Room ID for socket
      userId: guest._id,
      userName: guest.fullName + " (Guest)",
      userEmail: guest.email,
      amount: guest.loanAmount || 0, // Guest's requested amount
      status: guest.escalatedToAdmin ? "escalated" : "guest_inquiry",
      isGuest: true,
      aiEnabled: true, // Guests are always AI-enabled by default
      updatedAt: guest.lastActivityAt,
    }));

    // 5. Combine and Sort (Newest activity at the top)
    const combinedInboxes = [...formattedLoans, ...formattedGuests].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    );

    res.status(200).json({
      success: true,
      count: combinedInboxes.length,
      loans: combinedInboxes, // We keep the key name "loans" so your frontend doesn't need to change
      AdminData: AdminData,
      LoanData: LoanData,
      UserData: UserData,
      GuestUserData: GuestUserData,
    });
  } catch (err) {
    console.error("Unified Inbox Error:", err);
    res.status(500).json({ message: "Failed to fetch inbox items." });
  }
};

module.exports = {
  registerAdmin,
  verifyOtp,
  resendOtp,
  loginAdmin,
  forgotPassword,
  resetPassword,
  logoutAdmin,
  // ================ DASHBOARD FEATURES ================
  fetchAdmin,
  getDashboardStats,
  updateLoanStatus,
  deleteUserCompletely,
  toggleLoanAI,
  getAllLoans,
};
