const Notification = require("../models/notificationModel");
const HttpError = require("../models/errorModel");

// 1. Send Notification (Admin to User/Guest)
const sendNotification = async (req, res, next) => {
  try {
    const { recipientId, guestId, title, message, category, scope } = req.body;
    // DEBUG: Check if IO exists
    if (!req.io) {
      console.error("CRITICAL: req.io is undefined!");
      return next(new HttpError("Socket.io not initialized", 500));
    }

    const adminId = req.admin._id;

    const notification = await Notification.create({
      recipientId: scope === "individual" ? recipientId : null,
      guestId: scope === "individual" ? guestId : null,
      adminId,
      title,
      message,
      category,
      scope,
    });

    if (scope === "global") {
      req.io.emit("global_notification", notification);
    } else if (recipientId) {
      req.io.to(recipientId).emit("user_notification", notification);
    }

    res.status(201).json({ success: true, notification });
  } catch (err) {
    // LOG THE ACTUAL ERROR HERE
    console.error("NOTIFICATION_CONTROLLER_ERROR:", err);
    next(new HttpError("Failed to broadcast notification", 500));
  }
};

// 2. Get Notifications (For the User/Guest side)
const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const notifications = await Notification.find({
      $or: [
        { scope: "global" },
        { recipientId: userId },
        { guestId: req.guest?._id },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, notifications });
  } catch (err) {
    next(new HttpError("Failed to retrieve feed", 500));
  }
};

// 3. Mark as read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { isRead: true });
    res.status(200).json({ success: true, message: "Marked as read" });
  } catch (err) {
    next(new HttpError("Update failed", 500));
  }
};

// 4. GET ALL NOTIFICATIONS (Admin View)
const getAllNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find()
      .populate("adminId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    next(new HttpError("Failed to fetch notification history", 500));
  }
};

module.exports = {
  sendNotification,
  getMyNotifications,
  markAsRead,
  getAllNotifications,
};
