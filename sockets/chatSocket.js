const ChatMessage = require("../models/ChatMessage");
const GuestUser = require("../models/guestUserModel");
const aiService = require("../utils/aiService");

let ioInstance; // To store the io instance for external calls

module.exports = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    // console.log("🟢 Socket connected:", socket.id);

    /* ===============================
		   REGISTERED USER CHAT
		================================ */

    // Join chat room
    socket.on("join-room", ({ applicationId }) => {
      socket.join(applicationId);
      // console.log(`User joined room: ${applicationId}`);

      // Notify others that someone joined
      io.to(applicationId).emit("user-joined", {
        message: "User connected to chat",
        timestamp: new Date(),
      });
    });

    // Typing indicators
    socket.on("typing", ({ applicationId, senderType }) => {
      socket.to(applicationId).emit("typing", { senderType });
    });

    socket.on("stop-typing", ({ applicationId }) => {
      socket.to(applicationId).emit("stop-typing");
    });

    // Read receipts - Matches your LoanApplication Schema ("unread.user")
    socket.on("mark-read", async ({ applicationId, userType }) => {
      try {
        // Update messages to show readBy
        await ChatMessage.updateMany(
          { applicationId },
          {
            $push: {
              readBy: {
                userType,
                readAt: new Date(),
              },
            },
          },
        );

        // Reset unread count in LoanApplication (using your schema's path)
        const updatePath = `unread.${userType}`;
        const LoanApplication = require("../models/test/loanApplication");
        await LoanApplication.findByIdAndUpdate(applicationId, {
          [updatePath]: 0,
        });

        io.to(applicationId).emit("read-update", { userType });
      } catch (err) {
        console.error("Socket Mark-Read Error:", err.message);
      }
    });

    /* ===============================
		   GUEST CHAT WITH AI
		================================ */

    // Guest joins room
    socket.on("guest-join-room", ({ guestId }) => {
      socket.join(`guest-${guestId}`);
      // console.log(`Guest joined room: ${guestId}`);

      io.to(`guest-${guestId}`).emit("guest-joined", {
        message: "Guest session established",
        timestamp: new Date(),
      });
    });

    // Guest sends message (will be handled in controller)
    socket.on("guest-message", async ({ guestId, text }) => {
      try {
        const guestUser = await GuestUser.findById(guestId);
        if (!guestUser) {
          socket.emit("error", {
            message: "Invalid guest session",
          });
          return;
        }

        // AI is handling response in controller
        // This is just for real-time emission
        io.to(`guest-${guestId}`).emit("guest-message-received", {
          message: text,
          timestamp: new Date(),
        });
      } catch (err) {
        console.error("Guest Message Error:", err.message);
        socket.emit("error", {
          message: "Failed to process message",
        });
      }
    });

    // Guest typing
    socket.on("guest-typing", ({ guestId }) => {
      socket.to(`guest-${guestId}`).emit("guest-typing", {
        timestamp: new Date(),
      });
    });

    socket.on("guest-stop-typing", ({ guestId }) => {
      socket.to(`guest-${guestId}`).emit("guest-stop-typing");
    });

    /* ===============================
		   ESCALATION EVENTS
		================================ */

    // Guest escalated to admin
    socket.on("guest-escalated", async ({ guestId, adminId }) => {
      try {
        const guestUser = await GuestUser.findByIdAndUpdate(
          guestId,
          {
            escalatedToAdmin: true,
            escalatedAt: new Date(),
            assignedAdmin: adminId,
          },
          { new: true },
        );

        // Notify guest
        io.to(`guest-${guestId}`).emit("escalation-confirmation", {
          message: "You have been connected to a human specialist",
          admin: {
            id: adminId,
            name: "Support Specialist",
          },
        });

        // Notify admin
        io.to(`admin-${adminId}`).emit("new-escalation", {
          guestId,
          guestUser: {
            fullName: guestUser.fullName,
            email: guestUser.email,
          },
          messageCount: guestUser.conversationHistory.length,
        });
      } catch (err) {
        console.error("Escalation Error:", err.message);
      }
    });

    /* ===============================
		   DISCONNECT
		================================ */

    socket.on("disconnect", () => {
      // console.log("🔴 Socket disconnected:", socket.id);
    });
  });
};

/* ===============================
    EXTERNAL EMIT FUNCTION
   Allows controllers to trigger events
================================ */
module.exports.emitMessage = (applicationId, message) => {
  if (ioInstance) {
    ioInstance.to(applicationId.toString()).emit("newMessage", message);
  }
};

/* ===============================
    EMIT GUEST MESSAGE
   For AI responses to guest chats
================================ */
module.exports.emitGuestMessage = (guestId, message) => {
  if (ioInstance) {
    ioInstance.to(`guest-${guestId.toString()}`).emit("newMessage", message);
  }
};

/* ===============================
    EMIT TO ADMIN
   For admin notifications
================================ */
module.exports.emitToAdmin = (adminId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`admin-${adminId.toString()}`).emit(event, data);
  }
};
