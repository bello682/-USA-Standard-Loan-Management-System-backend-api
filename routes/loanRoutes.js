const express = require("express");
const router = express.Router();
const {
  applyForLoan,
  getUserLoans,
  getAllLoans,
  getLoanById,
} = require("../controllers/loanController");
const protect = require("../middleware/authMiddleware"); // Your JWT shield

// All loan routes require authentication
// router.post("/apply", protect, applyForLoan);
// router.get("/my-loans", protect, getUserLoans);

// This matches: GET /api/loans
router.get("/", protect, getAllLoans);

// This matches: GET /api/loans/my-loans
router.get("/my-loans", protect, getUserLoans);

// This matches: POST /api/loans
// (Note: Your frontend 'createLoan' hits /api/loans, not /api/loans/apply)
router.post("/", protect, applyForLoan);

// This matches: GET /api/loans/:loanId
router.get("/:loanId", protect, getLoanById);

module.exports = router;
