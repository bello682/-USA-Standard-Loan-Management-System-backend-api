const Joi = require("joi");
const moment = require("moment");

// Joi validation schema for user data
const userValidationSchema_Registration = Joi.object({
  fullName: Joi.string().min(3).max(100).required().messages({
    "string.base": "Full name must be a string",
    "string.empty": "Full name is required",
    "string.min": "Full name must be at least 3 characters long",
    "string.max": "Full name cannot exceed 100 characters",
    "any.required": "Full name is required",
  }),
  email: Joi.string().email().lowercase().required().messages({
    "string.email": "Email must be a valid email",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long",
    "any.required": "Password is required",
  }),
  role: Joi.string().valid("user", "admin").default("user").messages({
    "string.base": "Role must be a string",
    "any.only": 'Role must be either "user" or "admin"',
  }),
  status: Joi.string()
    .valid("active", "inactive")
    .default("inactive")
    .messages({
      "string.base": "Status must be a string",
      "any.only": 'Status must be  "active", or "disabled"',
    }),
  date_created: Joi.string().default(() =>
    moment().format("YYYY-MM-DD HH:mm:ss"),
  ),
  date_updated: Joi.string().default(() =>
    moment().format("YYYY-MM-DD HH:mm:ss"),
  ),
  verification_status: Joi.string()
    .valid("pending", "verified")
    .default("pending")
    .messages({
      "string.base": "Verification status must be a string",
      "any.only": 'Verification status must be "pending" or "verified"',
    }),
  posts: Joi.number().integer().default(0).messages({
    "number.base": "Posts must be a number",
    "number.integer": "Posts must be an integer",
  }),

  // Add OTP and OTP expiration fields
  otp: Joi.string().length(6).optional().messages({
    "string.base": "OTP must be a string",
    "string.length": "OTP must be exactly 6 digits",
  }),
  otpExpiresAt: Joi.date().optional().messages({
    "date.base": "OTP expiration time must be a valid date",
  }),

  // Add isVerified field
  isVerified: Joi.boolean().default(false).messages({
    "boolean.base": "isVerified must be a boolean value",
  }),

  // Add resetPasswordToken and resetPasswordExpiresAt fields
  resetPasswordToken: Joi.string().optional().messages({
    "string.base": "Reset password token must be a string",
  }),
  resetPasswordExpiresAt: Joi.date().optional().messages({
    "date.base": "Reset password expiration time must be a valid date",
  }),
});

// Joi validation schema for login data
const userValidationSchema_Login = Joi.object({
  email: Joi.string().email().lowercase().required().messages({
    "string.email": "Email must be a valid email",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long",
    "any.required": "Password is required",
  }),
});

const userValidationSchema_KYC = Joi.object({
  documentType: Joi.string()
    .valid("passport", "driverLicense", "idCard")
    .default("idCard")
    .required(),
  occupation: Joi.string().required(),
  address: Joi.string().required(),
  dateOfBirth: Joi.date().required(),
  placeOfWork: Joi.string().required(),
  bvn: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  verified: Joi.boolean().default(false).optional(),
});

const chatValidationSchema_Init = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required to access chat",
  }),
  name: Joi.string().required(),
  role: Joi.string().valid("user", "admin").required(),
  loanData: Joi.object({
    amount: Joi.number().optional(),
    upfront: Joi.number().optional(),
    term: Joi.number().optional(),
    monthly: Joi.number().optional(),
    applicationId: Joi.string().optional(),
  })
    .unknown(true)
    .optional(),
});

/**
 * Message Validation
 * Updated to ensure applicationId is a valid hex string (MongoDB ID)
 */
// const chatValidationSchema_Message = Joi.object({
// 	applicationId: Joi.string()
// 		.regex(/^[0-9a-fA-A]{24}$/)
// 		.required()
// 		.messages({
// 			"string.pattern.base": "Invalid Application ID format",
// 		}),
// 	text: Joi.string().min(1).required().messages({
// 		"string.empty": "Message text cannot be empty",
// 	}),
// 	senderType: Joi.string().valid("user", "admin").required(),
// 	email: Joi.string().email().required(),
// });

// Accept either applicationId or userId (for guest/user chat)
const chatValidationSchema_Message = Joi.object({
  applicationId: Joi.string()
    .regex(/^[0-9a-fA-A]{24}$/)
    .optional(),
  userId: Joi.string()
    .regex(/^[0-9a-fA-A]{24}$/)
    .optional(),
  text: Joi.string().allow("").optional(),
  senderType: Joi.string().valid("user", "admin", "ai-bot").required(),
  email: Joi.string().email().required(),
  // --- ADD THESE TWO LINES ---
  senderName: Joi.string().optional().allow(null, ""),
  senderId: Joi.string()
    .regex(/^[0-9a-fA-A]{24}$/)
    .optional()
    .allow(null, ""),
  // }).or("applicationId", "userId");
})
  .or("applicationId", "userId")
  .unknown(true);

/* ===============================
   GUEST CHAT INITIALIZATION
   For unregistered users wanting to chat
================================ */
const guestChatInitSchema = Joi.object({
  fullName: Joi.string().min(3).max(100).required().messages({
    "string.empty": "Full name is required",
    "string.min": "Full name must be at least 3 characters",
    "string.max": "Full name cannot exceed 100 characters",
    "any.required": "Full name is required",
  }),
  email: Joi.string().email().lowercase().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  loanAmount: Joi.number().optional().messages({
    "number.base": "Loan amount must be a number",
  }),
});

/* ===============================
   GUEST CHAT MESSAGE
   Simplified for guests
================================ */
const guestChatMessageSchema = Joi.object({
  sessionToken: Joi.string().required().messages({
    "any.required": "Session token is required",
  }),
  text: Joi.string().min(1).required().messages({
    "string.empty": "Message cannot be empty",
    "any.required": "Message text is required",
  }),
  messageType: Joi.string().valid("text", "file").default("text").optional(),
});

// Export the validation schema
module.exports = {
  userValidationSchema_Registration,
  userValidationSchema_Login,
  userValidationSchema_KYC,
  chatValidationSchema_Init,
  chatValidationSchema_Message,
  guestChatInitSchema,
  guestChatMessageSchema,
};
