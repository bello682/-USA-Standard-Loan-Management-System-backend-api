const { Router } = require("express");
const {
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
} = require("../controllers/userController");

const protect = require("../middleware/authMiddleware"); // Stick to one name

const router = Router();

// --- PUBLIC ROUTES (No Token Needed) ---
router.post("/register", UserRegistration);
router.post("/login", LoginUser);
router.post("/forgot-password", ForgetPassword);
router.post("/reset-password/:token", ResetPassword);
router.post("/resend-otp", ResendOTP);

// --- SEMI-PROTECTED (Needs the temporary token from Register) ---
router.post("/verify-otp", protect, VerifyUserByOtp);

// --- PRIVATE ROUTES (Must be logged in) ---
router.post("/logout", protect, LogoutUser);
router.get("/me", protect, GetCurrentUser);
router.delete("/user/:id", protect, DeleteUserById);

// KYC is highly sensitive - strictly protect this
router.patch("/users/:userId/update-kyc", protect, UpdateUserKycById);

module.exports = router;
