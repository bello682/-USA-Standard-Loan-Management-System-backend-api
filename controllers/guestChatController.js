const HttpError = require("../models/errorModel");
const ChatMessage = require("../models/ChatMessage");
const GuestUser = require("../models/guestUserModel");
const User = require("../models/userModel");
const aiService = require("../utils/aiService");
const emailService = require("../utils/emailService");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("cloudinary").v2;
const {
  guestChatInitSchema,
  guestChatMessageSchema,
} = require("../JoiSchemaValidation/schemaValidation");
const { emitMessage } = require("../sockets/chatSocket");

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ===============================
   GUEST CHAT INITIALIZATION
   For unregistered users
================================ */
/**
 * Initializes a guest chat session for unregistered users.
 * Connects to guest session creation and AI welcome message logic.
 */
const InitGuestChat = async (req, res, next) => {
  try {
    // Validate guest data
    const result = await guestChatInitSchema.validateAsync(req.body);
    const { fullName, email, loanAmount } = result;

    // Check if guest already has an active session
    let guestUser = await GuestUser.findOne({
      email,
      isActive: true,
      sessionExpiresAt: { $gt: new Date() },
    });

    // Create new guest session if none exists
    if (!guestUser) {
      const sessionToken = uuidv4();
      // Create guest user in memory, not in DB yet
      const guestUserDoc = new GuestUser({
        fullName,
        email,
        sessionToken,
        loanAmount: loanAmount || 0,
        sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
      try {
        // Save guest user to get _id for welcome message
        await guestUserDoc.validate();
        await guestUserDoc.save();
        // Send welcome message from AI (set userId for schema compliance)
        const welcomeMessage = await ChatMessage.create({
          applicationId: guestUserDoc._id,
          userId: guestUserDoc._id, // Required for ChatMessage schema
          senderType: "ai-bot",
          senderName: "LoanBot",
          text: `Hello ${fullName}! 👋 Welcome to LoanApp Support. I'm your AI assistant. I can help you with information about:\n\n✓ Loan eligibility requirements\n✓ Interest rates and terms\n✓ Application process\n✓ Repayment options\n\nHow can I assist you today?`,
          messageType: "text",
          aiMetadata: {
            confidence: 1.0,
            intent: "greeting",
            isFlagged: false,
          },
        });
        guestUserDoc.conversationHistory.push(welcomeMessage._id);
        await guestUserDoc.save();
        guestUser = guestUserDoc;
      } catch (creationErr) {
        // If welcome message creation fails, remove guest user from DB
        if (guestUserDoc._id) {
          await GuestUser.deleteOne({ _id: guestUserDoc._id });
        }
        return next(
          new HttpError(
            `Guest chat initialization failed: ${creationErr.message}`,
            500,
          ),
        );
      }
    } else {
      // Update activity timestamp
      guestUser.lastActivityAt = new Date();
      await guestUser.save();
    }

    // Fetch conversation history
    const messages = await ChatMessage.find({
      applicationId: guestUser._id,
    }).sort({ createdAt: 1 });

    res.status(200).json({
      sessionToken: guestUser.sessionToken,
      guestId: guestUser._id,
      guest: {
        fullName: guestUser.fullName,
        email: guestUser.email,
        loanAmount: guestUser.loanAmount,
      },
      messages,
    });
  } catch (err) {
    /**
     * Retrieves paginated chat messages for a guest session.
     * Used in guest chat views and chat history.
     */
    if (err.isJoi) {
      return next(new HttpError(err.details[0].message, 400));
    }
    next(
      new HttpError(`Guest chat initialization failed: ${err.message}`, 500),
    );
  }
};

/* ===============================
		/**
		 * Manually escalates a guest chat to a human admin.
		 * Connects to admin assignment and system notification logic.
		 
   GUEST SEND MESSAGE (WITH AI)
   Messages go to AI first
================================ */
const PostGuestMessage = async (req, res, next) => {
  try {
    const result = await guestChatMessageSchema.validateAsync(req.body);
    const { sessionToken, text } = result;

    const guestUser = await GuestUser.findOne({
      sessionToken,
      isActive: true,
      sessionExpiresAt: { $gt: new Date() },
    });

    if (!guestUser) {
      return next(new HttpError("Invalid or expired session", 401));
    }

    // 1️⃣ SAVE USER MESSAGE
    const userMessage = await ChatMessage.create({
      userId: guestUser._id,
      senderType: "user",
      senderName: guestUser.fullName,
      senderEmail: guestUser.email,
      text,
      messageType: "text",
    });

    guestUser.conversationHistory.push(userMessage._id);
    guestUser.aiInteractionCount += 1;
    guestUser.lastActivityAt = new Date();

    // 🔌 SOCKET EMIT: Let the Admin see the guest's message immediately
    emitMessage(guestUser._id.toString(), userMessage);

    // 2️⃣ CHECK IF AI IS ENABLED FOR THIS GUEST
    const isAiActive = guestUser.aiAssistant?.isActive ?? true;
    let botMessage = null;

    if (isAiActive) {
      // GET CONVERSATION HISTORY FOR AI CONTEXT
      const previousMessages = await ChatMessage.find({
        userId: guestUser._id,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      // GET AI RESPONSE
      const aiResponse = await aiService.generateResponse(
        text,
        previousMessages.reverse(),
      );

      // 3️⃣ SAVE AI RESPONSE
      botMessage = await ChatMessage.create({
        userId: guestUser._id,
        senderType: "ai-bot",
        senderName: "LoanBot",
        text: aiResponse.message,
        messageType: "text",
        aiMetadata: aiResponse.metadata,
      });

      guestUser.conversationHistory.push(botMessage._id);

      // 🔌 SOCKET EMIT: Let the Guest see the AI's reply immediately
      emitMessage(guestUser._id.toString(), botMessage);

      // 4️⃣ ESCALATION LOGIC (Only triggers if AI is the one responding)
      if (aiResponse.metadata.isFlagged) {
        const admin = await User.findOne({ role: "admin", status: "active" });

        if (admin) {
          guestUser.assignedAdmin = admin._id;
          guestUser.escalatedToAdmin = true;
          guestUser.escalatedAt = new Date();

          const escalationMsg = await ChatMessage.create({
            userId: guestUser._id,
            senderType: "system",
            text: "Connecting you to a human support specialist...",
            messageType: "text",
          });

          emitMessage(guestUser._id.toString(), escalationMsg);

          try {
            await emailService.sendAdminEscalationEmail(
              admin,
              guestUser,
              aiResponse.metadata.intent,
              "Guest Inquiry Escalation",
            );
          } catch (e) {
            console.error("Escalation Email failed", e);
          }
        }
      }
    } else {
      console.log(
        `[Chat] AI is disabled for Guest: ${guestUser.fullName}. Human Admin must respond.`,
      );
    }

    await guestUser.save();

    res.status(201).json({
      success: true,
      userMessage,
      botMessage, // This will be null if AI is toggled OFF
    });
  } catch (err) {
    if (err.isJoi) return next(new HttpError(err.details[0].message, 400));
    next(new HttpError(`Guest message failed: ${err.message}`, 500));
  }
};

/* ===============================
   FETCH GUEST CHAT HISTORY
/**
 * Retrieves all escalated guest chats for admin review.
 * Used in admin dashboard and support workflows.
 
================================ */
const FetchGuestMessages = async (req, res, next) => {
  try {
    const { sessionToken } = req.params;
    const { page = 1, limit = 30 } = req.query;

    // Verify session
    const guestUser = await GuestUser.findOne({
      sessionToken,
      isActive: true,
    });

    if (!guestUser) {
      return next(new HttpError("Invalid session", 401));
    }

    const messages = await ChatMessage.find({
      applicationId: guestUser._id,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json(messages.reverse());
  } catch (err) {
    next(new HttpError(`Failed to fetch chat history: ${err.message}`, 500));
  }
};

/* ===============================
   ESCALATE GUEST TO ADMIN
   Manual escalation endpoint
================================ */
const EscalateGuestToAdmin = async (req, res, next) => {
  try {
    const { sessionToken } = req.body;

    const guestUser = await GuestUser.findOne({
      sessionToken,
      isActive: true,
    });

    if (!guestUser) {
      return next(new HttpError("Invalid session", 401));
    }

    // Find available admin
    const admin = await User.findOne({
      role: "admin",
      status: "active",
    }).select("_id email fullName");

    if (!admin) {
      return next(
        new HttpError("No admins available. Please try again later.", 503),
      );
    }

    guestUser.assignedAdmin = admin._id;
    guestUser.escalatedToAdmin = true;
    guestUser.escalationReason = "manual_request";
    guestUser.escalatedAt = new Date();
    await guestUser.save();

    // Create system message
    const escalationMsg = await ChatMessage.create({
      applicationId: guestUser._id,
      senderType: "system",
      text: `You are now chatting with ${admin.fullName} from our support team.`,
      messageType: "text",
    });

    res.status(200).json({
      success: true,
      message: "Connected to support specialist",
      admin: {
        name: admin.fullName,
        email: admin.email,
      },
      systemMessage: escalationMsg,
    });
  } catch (err) {
    next(new HttpError(`Escalation failed: ${err.message}`, 500));
  }
};

/* ===============================
   GET GUEST SESSION STATUS
================================ */
const GetGuestSessionStatus = async (req, res, next) => {
  try {
    const { sessionToken } = req.params;

    const guestUser = await GuestUser.findOne({
      sessionToken,
    });

    if (!guestUser) {
      return next(new HttpError("Session not found", 404));
    }

    const isActive =
      guestUser.isActive && guestUser.sessionExpiresAt > new Date();

    res.status(200).json({
      isActive,
      sessionToken: guestUser.sessionToken,
      guest: {
        fullName: guestUser.fullName,
        email: guestUser.email,
      },
      escalated: guestUser.escalatedToAdmin,
      assignedAdmin: guestUser.assignedAdmin,
      expiresAt: guestUser.sessionExpiresAt,
      messageCount: guestUser.conversationHistory.length,
    });
  } catch (err) {
    next(new HttpError(`Failed to fetch session: ${err.message}`, 500));
  }
};

/* ===============================
   ADMIN: GET ALL ESCALATED CHATS
================================ */
const GetEscalatedChats = async (req, res, next) => {
  try {
    const escalatedChats = await GuestUser.find({
      escalatedToAdmin: true,
      isActive: true,
    })
      .sort({ escalatedAt: -1 })
      .populate("assignedAdmin", "fullName email");

    res.status(200).json(escalatedChats);
  } catch (err) {
    next(new HttpError(`Failed to fetch escalated chats: ${err.message}`, 500));
  }
};

module.exports = {
  InitGuestChat,
  PostGuestMessage,
  FetchGuestMessages,
  EscalateGuestToAdmin,
  GetGuestSessionStatus,
  GetEscalatedChats,
};
