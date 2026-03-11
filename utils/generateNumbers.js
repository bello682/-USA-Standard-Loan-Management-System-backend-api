const jwt = require("jsonwebtoken");

/**
 * PERFECT TOKEN GENERATOR
 * @param {string} userId - The MongoDB _id
 * @param {string} email - Admin/User email
 * @param {string} role - support-admin, super-admin, etc.
 */

const generateReferenceNumber = () => {
	const randomDigits = (length) =>
		Array.from({ length }, () => Math.floor(Math.random() * 10)).join(""); // Generate random digits of specified length
	const randomLetters = (length) =>
		Array.from({ length }, () =>
			String.fromCharCode(65 + Math.floor(Math.random() * 26)),
		).join(""); // Generate random letters of specified length

	// Construct the reference number
	return `RE${randomDigits(6)}${randomLetters(2)}${randomDigits(
		6,
	)}${randomLetters(1)}`;
};

// Generate a 6-digit OTP
const generateOTP = () => {
	return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateToken = (userId, email, role) => {
	// 1. Access Token: Short-lived for active requests
	// Use a short time like '1h' so if stolen, it expires quickly.
	const accessToken = jwt.sign(
		{ userId, email, role },
		process.env.JSON_WEB_TOKEN_SECRET_KEY,
		{ expiresIn: "1h" },
	);

	// 2. Refresh Token: Long-lived to get a new access token
	// This allows the admin to stay logged in for a full shift (e.g., 24h or 7 days)
	const refreshToken = jwt.sign(
		{ userId }, // Only need ID for refresh
		process.env.REFRESH_TOKEN_SECRET || "A_DIFFERENT_SECRET_KEY",
		{ expiresIn: "7d" },
	);

	return { accessToken, refreshToken };
};

module.exports = { generateReferenceNumber, generateOTP, generateToken };
