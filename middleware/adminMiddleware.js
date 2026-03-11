const jwt = require("jsonwebtoken");
const Admin = require("../models/adminModel");
const HttpError = require("../models/errorModel");

const adminAuthMiddleware = (roles = []) => {
  return async (req, res, next) => {
    try {
      // console.log("--- [DEBUG] Admin Auth Middleware Started ---");

      // 1. Check for Authorization Header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        // console.log("--- [DEBUG] Error: No Bearer token found in headers ---");
        return next(new HttpError("Unauthorized: No token provided", 401));
      }

      const token = authHeader.split(" ")[1];
      // console.log("--- [DEBUG] Token extracted successfully ---");

      // 2. Verify JWT
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JSON_WEB_TOKEN_SECRET_KEY);
        // console.log("--- [DEBUG] Token Decoded Content:", decoded);
      } catch (jwtErr) {
        // console.log("--- [DEBUG] JWT Verification Failed:", jwtErr.message);
        return next(new HttpError("Session expired, please login again", 401));
      }

      // 3. Find Admin in Database
      const adminId = decoded.id || decoded.userId || decoded._id;
      // console.log("--- [DEBUG] Searching for Admin ID:", adminId);

      if (!adminId) {
        // console.log("--- [DEBUG] Error: No ID found in token payload ---");
        return next(new HttpError("Invalid token structure", 401));
      }

      const admin = await Admin.findById(adminId);

      if (!admin) {
        // console.log("--- [DEBUG] Error: Admin not found in Database ---");
        return next(new HttpError("Admin account not found", 403));
      }

      // console.log(
      //   `--- [DEBUG] Admin found: ${admin.email}, Status: ${admin.status}, Role: ${admin.role} ---`,
      // );

      // 4. Check Status
      if (admin.status !== "active") {
        // console.log("--- [DEBUG] Error: Admin account is inactive ---");
        return next(new HttpError("Access denied: Account is inactive", 403));
      }

      // 5. Check Roles
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      if (requiredRoles.length > 0) {
        if (!requiredRoles.includes(admin.role)) {
          // console.log(
          //   `--- [DEBUG] Role Mismatch: DB has "${admin.role}", Route needs: ${requiredRoles} ---`,
          // );
          return next(
            new HttpError("Unauthorized: Missing required role", 403),
          );
        }
      }

      // 6. Success
      req.admin = admin;
      // console.log("--- [DEBUG] SUCCESS: Admin verified. Calling next() ---");
      next();
    } catch (error) {
      console.error("--- [DEBUG] CRITICAL MIDDLEWARE ERROR:", error);
      return next(new HttpError("Internal server error in auth", 500));
    }
  };
};

module.exports = adminAuthMiddleware;
