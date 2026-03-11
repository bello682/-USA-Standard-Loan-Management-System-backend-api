const moment = require("moment");
const cloudinary = require("cloudinary").v2;
const bcrypt = require("bcryptjs"); // To compare password hashes
const jwt = require("jsonwebtoken"); // For token generation
const crypto = require("crypto"); // For generating secure random token
const path = require("path");
const nodemailer = require("nodemailer");
const ejs = require("ejs");
const fs = require("fs").promises;
const { v4: uuid } = require("uuid");
const HttpError = require("../models/errorModel");
const Users = require("../models/userModel");
const {
  userValidationSchema_Registration,
  userValidationSchema_Login,
  userValidationSchema_KYC,
} = require("../JoiSchemaValidation/schemaValidation");
const GuestUser = require("../models/guestUserModel");
const Loan = require("../models/loanModel");
const ChatMessage = require("../models/ChatMessage");
const sendOTPEmail = require("../utils/sendOtpEmail");

// Cloudinary validation schema and configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Utility function to generate a six-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// POST: Register and send OTP
/**
 * Handles user registration, including validation and saving user data.
 * Connects to authentication and user profile creation flows.
 */
const UserRegistration = async (req, res, next) => {
  try {
    // 1. Validate Input
    const userRegistrationResult =
      await userValidationSchema_Registration.validateAsync(req.body);
    const { email, password, fullName } = userRegistrationResult;

    // 2. Check Database
    let user = await Users.findOne({ email });

    if (user && user.isVerified) {
      return next(
        new HttpError(`${email} is already verified. Please log in.`, 400),
      );
    }

    // 3. Prepare Data
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiresAt = Date.now() + 5 * 60 * 1000;

    if (user) {
      user.password = hashedPassword;
      user.fullName = fullName;
      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
    } else {
      user = new Users({
        fullName,
        email,
        password: hashedPassword,
        otp,
        otpExpiresAt,
        isVerified: false,
      });
    }

    // 4. Send Email
    try {
      await sendOTPEmail(email, otp);
    } catch (emailError) {
      console.error("Email Sending Failed:", emailError);
      return next(
        new HttpError("Failed to send OTP email. Please try again.", 500),
      );
    }

    // 5. Save the user record
    // If it reaches here, we have a user and an email sent.
    await user.save();

    // 6. PROTECTED Guest-to-User Merge
    // We wrap this entire block so it CANNOT crash the registration response
    try {
      const guestUser = await GuestUser.findOne({
        email: user.email,
        isActive: true,
        sessionExpiresAt: { $gt: new Date() },
      });

      if (guestUser) {
        // Use findOneAndUpdate to be safer
        let loan = await Loan.findOne({ userEmail: user.email });
        if (!loan) {
          loan = await Loan.create({
            userId: user._id,
            userName: user.fullName,
            userEmail: user.email,
            loanType: "Personal",
            amount: 0,
            interestRate: 12.5,
            durationMonths: 12,
            monthlyPayment: 0,
            totalInterest: 0, // <--- WAS MISSING (REQUIRED)
            totalRepayment: 0,
            status: "pending", // Default is pending, but good to be explicit
          });
        } else {
          loan.userId = user._id;
          await loan.save();
        }

        await ChatMessage.updateMany(
          { applicationId: guestUser._id },
          { $set: { applicationId: loan._id, userId: user._id } },
        );

        guestUser.isActive = false;
        await guestUser.save();
      }
    } catch (mergeErr) {
      console.error("DEBUG: Merge Logic Failed:", mergeErr.message);
      // We don't return 'next' here because we want the user to still register
    }

    // 7. Generate Token (with fallback check)
    const secret = process.env.JSON_WEB_TOKEN_SECRET_KEY;
    if (!secret) {
      console.error("DEBUG: JWT Secret is missing from environment variables!");
      return next(new HttpError("Server configuration error.", 500));
    }

    const token = jwt.sign({ email: user.email, id: user._id }, secret, {
      expiresIn: "20m", // HOW About we do 20 minute
    });

    // 8. FINAL RESPONSE
    // console.log(`Registration successful for ${user.email}`);
    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Please verify the OTP sent to your email.",
      token,
      userId: user._id,
    });
  } catch (err) {
    console.error("GLOBAL REGISTRATION ERROR:", err);
    if (err.isJoi) {
      return next(new HttpError(`Validation: ${err.details[0].message}`, 400));
    }
    next(new HttpError(`System error: ${err.message}`, 500));
  }
};

// POST: Verify OTP
/**
 * Verifies the OTP sent to the user's email during registration.
 * Connects to user activation and status updates.
 */
const VerifyUserByOtp = async (req, res, next) => {
  const { otp } = req.body;

  try {
    // req.user is now available because of authMiddleware
    // Since Registration token only has 'email', we find by email
    const user = await Users.findOne({ email: req.user.email });

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    // Validate OTP
    if (user.otp !== otp || user.otpExpiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Update User
    user.isVerified = true;
    user.status = "active";
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    res.status(200).json({ message: "User verified successfully" });
  } catch (err) {
    next(new HttpError("OTP verification failed.", 500));
  }
};

// POST: Resend OTP
/**
 * Resends the OTP to the user's email for verification.
 * Connects to user registration flow and email service.
 */
const ResendOTP = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await Users.findOne({ email });

    if (!user) {
      return next(
        new HttpError(
          "We couldn't find a user with that email. Please check your email and try again.",
          404,
        ),
      );
    }

    if (user.isVerified) {
      return next(new HttpError("User already verified.", 400));
    }

    // Generate a new OTP and expiry time
    const newOtp = generateOTP();
    // const otpExpiresAt = Date.now() + 1 * 60 * 1000; // 1 minute from now
    const otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

    // Update user with new OTP
    user.otp = newOtp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    // Resend OTP email
    await sendOTPEmail(email, newOtp);

    // Generate a new JWT based on the user's email
    const newToken = jwt.sign(
      { email: user.email }, // Include email in the token
      process.env.JSON_WEB_TOKEN_SECRET_KEY,
      { expiresIn: "20m" }, // Set expiration for the token
    );

    // Respond with the new OTP message and new JWT
    res.json({
      message: "A new OTP has been sent to your email.",
      token: newToken, // Return the new token
    });
  } catch (err) {
    console.error("Error resending OTP:", err);
    next(new HttpError("Failed to resend OTP, please try again.", 500));
  }
};

// POST REQUEST
/**
 * Handles user login, validates credentials, and issues authentication tokens.
 * Connects to session management and protected route access.
 */
const LoginUser = async (req, res, next) => {
  try {
    // Validate the request body with Joi
    const loginResult = await userValidationSchema_Login.validateAsync(
      req.body,
    );

    // Find user by email
    const user = await Users.findOne({ email: loginResult.email });

    if (!user) {
      return next(new HttpError("Invalid email or password.", 401));
    }

    // Check if the user is verified
    if (!user.isVerified) {
      return next(
        new HttpError("Please verify your email before logging in.", 403),
      );
    }

    // Check if the password is correct
    const isPasswordValid = await bcrypt.compare(
      loginResult.password,
      user.password,
    );
    if (!isPasswordValid) {
      return next(new HttpError("Invalid email or password.", 401));
    }

    // Update user status to "active"
    user.status = "active";
    user.date_updated = moment().format("YYYY-MM-DD HH:mm:ss"); // Update date updated
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JSON_WEB_TOKEN_SECRET_KEY,
      { expiresIn: "1h" },
    );

    // Respond with user details and token
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status, // Include the status in response
      },
      token,
    });
  } catch (err) {
    console.error("Error during user login:", err);

    // Handle Joi validation errors
    if (err.isJoi === true) {
      return next(
        new HttpError(
          `Validation failed: ${err.details
            .map((item) => item.message)
            .join(", ")}`,
          400,
        ),
      );
    }

    // General error handler
    next(
      new HttpError(
        `Login failed, please try again. Error: ${err.message}`,
        500,
      ),
    );
  }
};

// POST request
/**
 * Logs out the authenticated user and updates their status.
 * Connects to session management and user status updates.
 */
const LogoutUser = async (req, res, next) => {
  try {
    // Extract userId from the authenticated user's token
    const userId = req.user.userId;

    // Find the user by ID
    const user = await Users.findById(userId);

    if (!user) {
      return next(new HttpError("User not found.", 404));
    }

    // Update user status to "disabled" or "inactive"
    user.status = "inactive"; // You can also use "inactive" or other status
    user.date_updated = moment().format("YYYY-MM-DD HH:mm:ss"); // Update date updated
    await user.save();

    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    console.error("Error during user logout:", err);
    next(
      new HttpError(
        `Logout failed, please try again. Error: ${err.message}`,
        500,
      ),
    );
  }
};

const sendPasswordResetEmail = async (email, resetToken) => {
  // Create a reset link (e.g., https://your-app.com/reset-password/:token)
  const resetLink = `${process.env.WEBSITE_URL}/auth/reset-password/${resetToken}`;

  // Send email with reset link
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset Request",
    html: `
		<p>You requested a password reset. Please click the button below to reset your password:</p>
		<a href="${resetLink}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #4CAF50; text-decoration: none; border-radius: 5px;">RESET NOW</a>
		<p>If you did not request this, please ignore this email.</p>
	  `,
  };

  await transporter.sendMail(mailOptions);
};

// POST request
/**
 * Handles password reset requests for users.
 * Connects to email service and token generation for password reset flows.
 */
const ForgetPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await Users.findOne({ email });

    if (!user) {
      return next(new HttpError("User not found.", 404));
    }

    // Generate a random reset token using crypto
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Set token expiration time (1 hour)
    const resetPasswordExpiresAt = Date.now() + 3600000; // 1 hour from now

    // Save the reset token and expiration to the user's record
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiresAt = resetPasswordExpiresAt;
    await user.save();

    // Send reset link via email
    await sendPasswordResetEmail(user.email, resetToken);

    res
      .status(200)
      .json({ message: `A password reset link has been sent to ${email}.` });
  } catch (err) {
    console.error("Error during password reset request:", err);
    next(new HttpError("Failed to process password reset request.", 500));
  }
};

// POST: Reset Password (Verify Token and Update Password)
/**
 * Resets the user's password using a valid reset token.
 * Connects to user authentication and password management.
 */
const ResetPassword = async (req, res, next) => {
  const { token } = req.params; // Token from the URL
  const { newPassword } = req.body;

  try {
    // Find the user by the reset token and check if the token has not expired
    const user = await Users.findOne({
      resetPasswordToken: token,
      resetPasswordExpiresAt: { $gt: Date.now() }, // Token should not be expired
    });

    if (!user) {
      return next(new HttpError("Invalid or expired token.", 400));
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password and clear the reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = null; // Clear the token after successful reset
    user.resetPasswordExpiresAt = null; // Clear the expiration

    await user.save();

    res.json({
      message: `${user.email} Password has been reset successfully.`,
    });
  } catch (err) {
    console.error("Error during password reset:", err);
    next(new HttpError(`Password reset failed. Error: ${err.message}`, 500));
  }
};

// DELETE REQUEST
/**
 * Deletes a user by their ID.
 * Connects to user management and data cleanup processes.
 */
const DeleteUserById = async (req, res) => {
  try {
    const userId = req.params.id; // ID of the user to be deleted
    const requestingUser = req.user; // The authenticated user from authMiddleware

    // Check if the user is trying to delete their own account or if they are an admin
    if (requestingUser.role !== "user" && requestingUser.id !== userId) {
      return res
        .status(403)
        .json({ message: "You don't have permission to delete this user." });
    }

    const deletedUser = await Users.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: `${deletedUser.fullName} with ID ${userId} has been successfully deleted.`,
      date_deleted: moment().format("YYYY-MM-DD HH:mm:ss"),
    });
  } catch (error) {
    console.error("Error during delete operation:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH: Update User KYC Information by User ID
/**
 * Updates the KYC information for a user.
 * Connects to document upload and user verification processes.
 */
const UpdateUserKycById = async (req, res, next) => {
  const { userId } = req.params;

  // Validate other form fields against Joi schema
  const { error } = userValidationSchema_KYC.validate(req.body);
  if (error) {
    return next(new HttpError(error.details[0].message, 400));
  }

  const {
    documentType,
    occupation,
    address,
    dateOfBirth,
    placeOfWork,
    bvn,
    phoneNumber,
  } = req.body;

  try {
    const user = await Users.findById(userId);
    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    // Check if documentImage file exists in the request
    if (!req.files || !req.files.documentImage) {
      return next(new HttpError("Document image is required", 400));
    }

    // Upload file to Cloudinary
    const uploadedImage = await cloudinary.uploader.upload(
      req.files.documentImage.tempFilePath,
      {
        folder: "kyc_documents",
        public_id: `${userId}_documentImage`,
        resource_type: "image",
      },
    );

    // Update KYC with Cloudinary URL and other fields
    user.kyc = {
      documentType,
      documentImage: uploadedImage.secure_url, // Store Cloudinary URL
      occupation,
      address,
      dateOfBirth,
      placeOfWork,
      bvn,
      phoneNumber,
      verified: false, // Default to false until verified
    };

    user.date_updated = moment().format("YYYY-MM-DD HH:mm:ss");
    user.kyc.verified = true;
    await user.save();

    res.status(200).json({
      message: "User KYC information updated successfully.",
      kyc: user.kyc,
    });
  } catch (err) {
    console.error("Error updating user KYC:", err);
    next(new HttpError("Failed to update user KYC", 500));
  }
};

// GET: Current Authenticated User (the "Me" route)
/**
 * Retrieves the current authenticated user's profile information.
 * Used in dashboard and profile views; connects to authentication middleware.
 */
const GetCurrentUser = async (req, res) => {
  try {
    // req.user.id comes from your protect/authMiddleware
    const user = await Users.findById(req.user.id).select("-password -otp");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User session not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  UserRegistration,
  LoginUser,
  LogoutUser,
  UpdateUserKycById,
  DeleteUserById,
  GetCurrentUser,
  ForgetPassword,
  ResetPassword,
  VerifyUserByOtp,
  ResendOTP,
};
