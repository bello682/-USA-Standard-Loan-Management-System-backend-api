const { Router } = require("express");
const {
	InitGuestChat,
	PostGuestMessage,
	FetchGuestMessages,
	EscalateGuestToAdmin,
	GetGuestSessionStatus,
	GetEscalatedChats,
} = require("../controllers/guestChatController");
const authMiddleware = require("../middleware/authMiddleware");

const router = Router();

/* ===============================
   GUEST CHAT ROUTES
   PUBLIC (No authentication required)
================================ */

// Initialize guest chat session
router.post("/guest/init", InitGuestChat);

// Send message (with AI support)
router.post("/guest/message", PostGuestMessage);

// Get chat history
router.get("/guest/messages/:sessionToken", FetchGuestMessages);

// Get session status
router.get("/guest/session/:sessionToken", GetGuestSessionStatus);

// Request escalation to human
router.post("/guest/escalate", EscalateGuestToAdmin);

/* ===============================
   ADMIN ROUTES
   Protected (Requires authentication)
================================ */

// Get all escalated chats
router.get("/guest/escalated", authMiddleware, GetEscalatedChats);

module.exports = router;
