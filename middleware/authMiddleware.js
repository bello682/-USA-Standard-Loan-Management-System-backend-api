const jwt = require("jsonwebtoken");
const HttpError = require("../models/errorModel");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new HttpError("Unauthorized. No token provided.", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = jwt.verify(
      token,
      process.env.JSON_WEB_TOKEN_SECRET_KEY,
    );

    // Attach user info to request.
    // We use .userId and .id to ensure compatibility with all controllers
    req.user = {
      id: decodedToken.id || decodedToken.userId,
      email: decodedToken.email,
      role: decodedToken.role,
    };

    next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Session expired. Please log in again."
        : "Invalid token. Please log in again.";
    return next(new HttpError(message, 401));
  }
};

module.exports = authMiddleware;
