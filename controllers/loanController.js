const LoanData = require("../models/loanModel");
const User = require("../models/userModel");
const HttpError = require("../models/errorModel");
const moment = require("moment");

// 1. POST: Apply for a new loan
/**
 * Handles loan application submissions, including validation and saving loan data.
 * Connects to user accounts and loan status tracking.
 */
const applyForLoan = async (req, res, next) => {
  try {
    const {
      loanType,
      amount,
      durationYears, // Sent from frontend
      interestRate, // Sent from frontend
      upfront, // Sent from frontend
      monthly, // Sent from frontend
      totalInterest, // Sent from frontend
      totalReturn, // Sent from frontend
    } = req.body;

    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!userId || !user) {
      return next(new HttpError("User not found. Please log in again.", 401));
    }

    // 1. Basic validation - Ensure frontend sent everything
    if (!amount || !durationYears || !loanType || !interestRate) {
      return next(
        new HttpError("Missing loan parameters from calculator.", 400),
      );
    }

    // 2. Data Formatting
    // Convert Years to Months for the DB consistency
    const durationMonths = durationYears * 12;

    // 3. Create the Loan with all calculator data
    const newLoan = await LoanData.create({
      userId,
      userName: user.fullName,
      userEmail: user.email,
      loanType: loanType.toLowerCase(), // Must match "Personal", "Business", "Student", or "Auto"
      amount: Number(amount),
      interestRate: Number(interestRate),
      durationMonths: durationMonths,
      upfrontFee: Number(upfront),
      monthlyPayment: Number(monthly),
      totalInterest: Number(totalInterest),
      totalRepayment: Number(totalReturn),
      status: "pending",
      nextPaymentDate: moment().add(1, "month").toDate(),
    });

    res.status(201).json({
      message: "Loan application submitted successfully.",
      loan: newLoan,
    });
  } catch (err) {
    console.error(err);
    next(new HttpError(`Loan application failed: ${err.message}`, 500));
  }
};

// 2. GET: Fetch all loans for the logged-in user
/**
 * Retrieves all loans for the authenticated user.
 * Used in user dashboard and loan history views.
 */
const getUserLoans = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Find loans and populate user details if needed
    const loans = await LoanData.find({ userId }).sort({ date_applied: -1 });
    if (loans.length === 0) {
      // console.info(
      //   `[getUserLoans] No loans found for userId: ${userId}. This is normal if user has not applied for a loan.`,
      // );
    } else {
      console.info(
        `[getUserLoans] Found ${loans.length} loan(s) for userId: ${userId}`,
      );
    }
    // Calculate Stats for the Frontend Dashboard Cards
    const totalActiveDebt = loans
      .filter((l) => l.status === "active")
      .reduce((acc, curr) => acc + curr.amount, 0);
    res.status(200).json({
      success: true,
      stats: {
        totalActiveDebt,
        totalLoans: loans.length,
      },
      loans,
    });
  } catch (err) {
    console.error(
      `[getUserLoans] ERROR for userId: ${req.user?.id || "unknown"}:`,
      err,
    );
    next(new HttpError("Could not fetch loans, please try again.", 500));
  }
};

// Add these to your existing loanController.js

// 3. GET: Fetch ALL loans (usually for Admin or general list)
const getAllLoans = async (req, res, next) => {
  try {
    const loans = await LoanData.find().sort({ createdAt: -1 });
    res.status(200).json(loans);
  } catch (err) {
    next(new HttpError("Fetching loans failed.", 500));
  }
};

// 4. GET: Fetch single loan by ID
const getLoanById = async (req, res, next) => {
  try {
    const loan = await LoanData.findById(req.params.loanId);
    if (!loan) {
      return next(new HttpError("Loan not found.", 404));
    }
    res.status(200).json(loan);
  } catch (err) {
    next(new HttpError("Something went wrong, could not find loan.", 500));
  }
};

// Update your exports at the bottom
module.exports = {
  applyForLoan,
  getUserLoans,
  getAllLoans,
  getLoanById,
};
