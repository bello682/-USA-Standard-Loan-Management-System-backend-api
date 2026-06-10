const { Router } = require("express");
const {
  sendNotification,
  getMyNotifications,
  markAsRead,
  getAllNotifications, // For Admin to see history
} = require("../controllers/notificationController");

const adminMiddleware = require("../middleware/adminMiddleware");
const userMiddleware = require("../middleware/authMiddleware"); // Assuming you have this

const router = Router();

// ================= ADMIN ROUTES =================
// Admin sends a notification
router.post("/notify", adminMiddleware(["admin"]), sendNotification);
// Admin sees history of all notifications sent
router.get("/admin/history", adminMiddleware(["admin"]), getAllNotifications);

// ================= USER/GUEST ROUTES =================
// User/Guest fetches their specific feed + global broadcasts
router.get("/my-notifications", userMiddleware, getMyNotifications);
// User/Guest marks a specific notification as read
router.patch("/:id/read", userMiddleware, markAsRead);

module.exports = router;
