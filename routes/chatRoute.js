const { Router } = require("express");
const {
	InitChat,
	PostMessage,
	FetchMessages,
	FetchAllApplications,
	UpdateApplicationStatus,
} = require("../controllers/chatController");

const router = Router();

// --- PUBLIC/SEMI-PUBLIC (Chat initialization) ---
router.post("/init", InitChat);

// --- MESSAGING ---
router.post("/message", PostMessage);
router.get("/messages/:applicationId", FetchMessages);
// New: Fetch messages by userId for users without a loan
router.get("/messages/user/:userId", FetchMessages);

// Dashboard Route
router.get("/applications", FetchAllApplications);
router.patch("/status/:applicationId", UpdateApplicationStatus);

module.exports = router;
