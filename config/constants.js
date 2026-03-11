/* ===============================
   APPLICATION CONSTANTS
   USA Standard Loan Configuration
================================ */

const LOAN_CONSTANTS = {
	/* ===============================
	   LOAN TYPES & LIMITS (USA STANDARD)
	================================ */
	LOAN_TYPES: {
		PERSONAL: {
			name: "Personal Loan",
			minAmount: 1000,
			maxAmount: 50000,
			minTerm: 6,
			maxTerm: 60,
			description: "Unsecured personal loans for various needs",
		},
		AUTO: {
			name: "Auto Loan",
			minAmount: 5000,
			maxAmount: 100000,
			minTerm: 24,
			maxTerm: 72,
			description: "Loans for vehicle purchase",
		},
		STUDENT: {
			name: "Student Loan",
			minAmount: 2500,
			maxAmount: 50000,
			minTerm: 60,
			maxTerm: 180,
			description: "Education financing",
		},
		BUSINESS: {
			name: "Business Loan",
			minAmount: 10000,
			maxAmount: 250000,
			minTerm: 12,
			maxTerm: 120,
			description: "Small business funding",
		},
	},

	/* ===============================
	   INTEREST RATES (APR RANGES)
	   Based on credit score (USA standard)
	================================ */
	INTEREST_RATES: {
		EXCELLENT: { min: 4.0, max: 8.0, creditMin: 750 }, // 750+
		GOOD: { min: 8.0, max: 12.0, creditMin: 670 }, // 670-749
		FAIR: { min: 12.0, max: 18.0, creditMin: 580 }, // 580-669
		POOR: { min: 18.0, max: 36.0, creditMin: 300 }, // 300-579
	},

	/* ===============================
	   ELIGIBILITY REQUIREMENTS
	================================ */
	ELIGIBILITY: {
		MIN_AGE: 18,
		MAX_AGE: 75,
		MIN_CREDIT_SCORE: 300,
		MIN_ANNUAL_INCOME: 25000,
		MIN_EMPLOYMENT_MONTHS: 6,
		REQUIRED_DOCUMENTS: [
			"ID Verification",
			"Proof of Income (Pay stub, W2, or Tax return)",
			"Bank Statement (Last 3 months)",
			"Address Proof (Utility bill or lease)",
			"Employment Verification",
		],
	},

	/* ===============================
	   APPLICATION STATUS
	================================ */
	APPLICATION_STATUS: {
		PENDING: "pending",
		UNDER_REVIEW: "under_review",
		APPROVED: "approved",
		REJECTED: "rejected",
		DEPOSIT_PAID: "deposit_paid",
		FUNDED: "funded",
		ACTIVE: "active",
		COMPLETED: "completed",
		DEFAULTED: "defaulted",
		TERMINATED: "terminated",
	},

	/* ===============================
	   PROCESSING FEES (USA STANDARD)
	================================ */
	FEES: {
		ORIGINATION_FEE: 0.01, // 1% of loan amount
		PROCESSING_FEE: 0.005, // 0.5% of loan amount
		LATE_FEE: 15,
		INSUFFICIENT_FUNDS_FEE: 25,
		EARLY_REPAYMENT_PENALTY: 0.0, // No penalty (standard in USA)
	},

	/* ===============================
	   COMPLIANCE & REGULATIONS
	================================ */
	COMPLIANCE: {
		STATES: [
			"AL",
			"AK",
			"AZ",
			"AR",
			"CA",
			"CO",
			"CT",
			"DE",
			"FL",
			"GA",
			"HI",
			"ID",
			"IL",
			"IN",
			"IA",
			"KS",
			"KY",
			"LA",
			"ME",
			"MD",
			"MA",
			"MI",
			"MN",
			"MS",
			"MO",
			"MT",
			"NE",
			"NV",
			"NH",
			"NJ",
			"NM",
			"NY",
			"NC",
			"ND",
			"OH",
			"OK",
			"OR",
			"PA",
			"RI",
			"SC",
			"SD",
			"TN",
			"TX",
			"UT",
			"VT",
			"VA",
			"WA",
			"WV",
			"WI",
			"WY",
			"DC", // District of Columbia
		],
		REGULATIONS: [
			"FCRA", // Fair Credit Reporting Act
			"EFTA", // Electronic Funds Transfer Act
			"TILA", // Truth in Lending Act
			"FDCPA", // Fair Debt Collection Practices Act
			"ECOA", // Equal Credit Opportunity Act
		],
		PRIVACY_NOTICE:
			"Your information is protected under GLBA (Gramm-Leach-Bliley Act)",
	},

	/* ===============================
	   PAYMENT METHODS
	================================ */
	PAYMENT_METHODS: {
		ACH: "ACH Bank Transfer", // Most common
		CHECK: "Check",
		DEBIT_CARD: "Debit Card",
		CREDIT_CARD: "Credit Card",
		WIRE_TRANSFER: "Wire Transfer",
	},

	/* ===============================
	   DOCUMENT TYPES (ID VERIFICATION)
	================================ */
	DOCUMENT_TYPES: {
		DRIVERS_LICENSE: "driverLicense",
		PASSPORT: "passport",
		STATE_ID: "stateId",
		MILITARY_ID: "militaryId",
	},

	/* ===============================
	   REPAYMENT SCHEDULE TYPES
	================================ */
	REPAYMENT_TYPES: {
		MONTHLY: "monthly",
		BI_WEEKLY: "bi-weekly",
		WEEKLY: "weekly",
		ANNUAL: "annual",
	},

	/* ===============================
	   CHAT & AI CONFIGURATION
	================================ */
	CHAT: {
		SESSION_TIMEOUT_HOURS: 24,
		MESSAGE_HISTORY_LIMIT: 50,
		AI_RESPONSE_TIMEOUT_SECONDS: 30,
		ESCALATION_KEYWORDS: [
			"angry",
			"frustrated",
			"fraud",
			"scam",
			"lawsuit",
			"complaint",
		],
		AUTO_ESCALATION_AFTER_MESSAGES: 5, // Auto escalate after 5 AI responses without satisfaction
	},

	/* ===============================
	   RATE LIMITING
	================================ */
	RATE_LIMITS: {
		LOGIN_ATTEMPTS: 5,
		LOGIN_TIMEOUT_MINUTES: 15,
		API_REQUESTS_PER_MINUTE: 30,
		MESSAGE_RATE_LIMIT: 10, // Messages per minute
	},

	/* ===============================
	   SECURITY
	================================ */
	SECURITY: {
		PASSWORD_MIN_LENGTH: 8,
		OTP_LENGTH: 6,
		OTP_EXPIRY_MINUTES: 5,
		TOKEN_EXPIRY_HOURS: 24,
		REFRESH_TOKEN_EXPIRY_DAYS: 7,
		SESSION_TIMEOUT_MINUTES: 30,
		MAX_LOGIN_ATTEMPTS: 5,
	},
};

/* ===============================
   SYSTEM MESSAGES
================================ */
const SYSTEM_MESSAGES = {
	WELCOME: "Welcome to LoanApp! How can we help you today?",
	SESSION_EXPIRED: "Your session has expired. Please log in again.",
	LOAN_APPROVED: "🎉 Congratulations! Your loan has been approved!",
	LOAN_REJECTED:
		"Unfortunately, your application could not be approved at this time.",
	ADMIN_ASSIGNED: "An admin has been assigned to your application.",
	ESCALATED_TO_ADMIN: "Your chat has been escalated to a specialist.",
	APPLICATION_RECEIVED:
		"Your application has been received and is being reviewed.",
	PAYMENT_RECEIVED: "Your payment has been received. Thank you!",
	PAYMENT_DUE: "Your payment is due on:",
};

/* ===============================
   EMAIL TEMPLATES CONFIGURATION
================================ */
const EMAIL_CONFIG = {
	FROM_EMAIL: process.env.EMAIL_FROM || "noreply@loanapp.com",
	FROM_NAME: "LoanApp Support",
	COMPANY_NAME: "LoanApp",
	SUPPORT_EMAIL: "support@loanapp.com",
	SUPPORT_PHONE: "1-800-LOANAPP",
	BUSINESS_HOURS: "Monday - Friday, 9 AM - 5 PM EST",
};

/* ===============================
   API RESPONSE TEMPLATES
================================ */
const API_RESPONSES = {
	SUCCESS: (data, message = "Success") => ({
		success: true,
		message,
		data,
	}),
	ERROR: (message, statusCode = 500) => ({
		success: false,
		message,
		statusCode,
	}),
	VALIDATION_ERROR: (errors) => ({
		success: false,
		message: "Validation error",
		errors,
		statusCode: 400,
	}),
};

module.exports = {
	LOAN_CONSTANTS,
	SYSTEM_MESSAGES,
	EMAIL_CONFIG,
	API_RESPONSES,
};
