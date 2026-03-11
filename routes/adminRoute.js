const { Router } = require("express");
const {
  registerAdmin,
  verifyOtp,
  resendOtp,
  loginAdmin,
  forgotPassword,
  resetPassword,
  fetchAdmin,
  logoutAdmin,
  getDashboardStats,
  updateLoanStatus,
  deleteUserCompletely,
  toggleLoanAI,
  getAllLoans,
} = require("../controllers/adminController");

const adminMiddleware = require("../middleware/adminMiddleware");

const router = Router();

/* ===============================
   AUTHENTICATION ROUTES
   Public & Protected admin auth
================================ */

// ✅ Public routes (no token needed)
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// ✅ Protected routes (require token)
router.post("/logout", adminMiddleware, logoutAdmin);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.get("/getAdmin", adminMiddleware, fetchAdmin);

/* ===============================
   DASHBOARD & LOAN MANAGEMENT
   Admin only operations
================================ */
router.get("/dashboard/stats", adminMiddleware(["admin"]), getDashboardStats);
router.patch("/loans/:loanId/status", adminMiddleware, updateLoanStatus);
router.delete("/users/:userId", adminMiddleware, deleteUserCompletely);
router.patch(
  "/loans/:loanId/toggle-ai",
  adminMiddleware(["admin"]),
  toggleLoanAI,
);
// router.get("/loans", adminMiddleware, getAllLoans);
router.get("/loans", adminMiddleware(["admin"]), getAllLoans);
// This matches: GET /api/loans
router.get("/admin-get-loans", getAllLoans);

module.exports = router;
