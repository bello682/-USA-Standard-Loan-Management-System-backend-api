const HttpError = require("../models/errorModel");
const Loan = require("../models/loanModel");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/userModel");
const Admin = require("../models/adminModel");
const {
  chatValidationSchema_Message,
  chatValidationSchema_Init,
} = require("../JoiSchemaValidation/schemaValidation");
const aiService = require("../utils/aiService");
const emailService = require("../utils/emailService");
const cloudinary = require("cloudinary").v2;
const { emitMessage } = require("../sockets/chatSocket");

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ===============================
   INIT CHAT - Initialize chat for loan application
================================ */
/**
 * Initializes a chat thread for a loan application or user.
 * Connects to chat history retrieval and thread creation logic.
 */
const InitChat = async (req, res, next) => {
  try {
    const result = await chatValidationSchema_Init.validateAsync(req.body);
    const { email, name, loanData, role, userId } = result;

    let loan = null;
    let isNewLoan = false;
    let chatQuery = {};

    // ADMIN OPENING EXISTING CHAT
    if (role === "admin" && loanData?.loanId) {
      loan = await Loan.findById(loanData.loanId);
      chatQuery = { applicationId: loan?._id };
    } else if (role === "user") {
      // Always allow chat by userId if no loan exists
      loan = await Loan.findOne({ userEmail: email });
      if (loan) {
        chatQuery = { applicationId: loan._id };
      } else if (userId || loanData?.userId) {
        chatQuery = { userId: userId || loanData?.userId };
      } else {
        // Fallback: use email if userId not present
        chatQuery = { senderEmail: email };
      }
    } else {
      // Guest or fallback: use email
      chatQuery = { senderEmail: email };
    }

    // Fetch all chat messages for this thread (loan or user)
    const messages = await ChatMessage.find(chatQuery).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      loan,
      messages,
    });
  } catch (err) {
    if (err.isJoi) {
      return next(new HttpError(err.details[0].message, 400));
    }
    next(new HttpError(`Chat initialization failed: ${err.message}`, 500));
  }
};

/* ===============================
   SEND MESSAGE - Handles user & admin messages with file uploads
/**
 * Handles sending a chat message from a user or admin, including file uploads.
 * Connects to chat storage, user identification, and real-time socket updates.
================================ */

const PostMessage = async (req, res, next) => {
  try {
    const result = await chatValidationSchema_Message.validateAsync(req.body);

    let uploadedAttachments = [];

    // ✅ HANDLE EXPRESS-FILEUPLOAD + CLOUDINARY
    if (req.files && req.files.files) {
      const fileList = Array.isArray(req.files.files)
        ? req.files.files
        : [req.files.files];
      for (const file of fileList) {
        const uploadResponse = await cloudinary.uploader.upload(
          file.tempFilePath,
          {
            folder: `chat_attachments/${result.applicationId || result.userId}`,
            resource_type: "auto",
          },
        );

        uploadedAttachments.push({
          url: uploadResponse.secure_url,
          contentType: file.mimetype,
          filename: file.name,
        });
      }
    }

    // ✅ PREPARE MESSAGE DATA (applicationId is now optional)
    const messageData = {
      text: result.text || "",
      senderType: result.senderType,
      senderEmail: result.email,
      senderName: result.senderName,
      senderId: result.senderId,
      attachments: uploadedAttachments,
      messageType: uploadedAttachments.length > 0 ? "file" : "text",
      userId: result.userId, // Always ensure userId is included
    };

    if (result.applicationId) {
      messageData.applicationId = result.applicationId;
    }

    // --- FIXED AI LOGIC: CHECK IF AI IS ACTIVE ---
    let isAiActive = true; // Default fallback

    if (result.applicationId) {
      // 1. Check Loan record if application exists
      const loan = await Loan.findById(result.applicationId);
      if (loan && loan.aiAssistant) {
        isAiActive = loan.aiAssistant.isActive;
      }
    } else if (result.userId) {
      // 2. Check User or Guest record if no loan exists
      // Check User table
      let actor = await User.findById(result.userId);

      // If not in User table, check Guest table
      if (!actor) {
        const GuestUser = require("../models/guestUserModel"); // Ensure import
        actor = await GuestUser.findById(result.userId);
      }

      if (actor && actor.aiAssistant) {
        isAiActive = actor.aiAssistant.isActive;
      }
    }

    let aiEscalationTriggered = false;
    let aiResponseMetadata = null;
    let aiResult = null;

    // AI logic only runs for user messages when AI is active
    if (result.senderType === "user" && result.text && isAiActive) {
      let previousQuery = {};
      if (result.applicationId) {
        previousQuery.applicationId = result.applicationId;
      } else if (result.userId) {
        previousQuery.userId = result.userId;
      }

      const previousMessages = await ChatMessage.find(previousQuery)
        .sort({ createdAt: -1 })
        .limit(10);

      aiResult = await aiService.generateResponse(
        result.text,
        previousMessages,
      );
      aiResponseMetadata = aiResult.metadata;

      // Check for escalation flags
      if (aiResult.metadata && aiResult.metadata.isFlagged) {
        aiEscalationTriggered = true;
      }

      // Check for escalation phrases
      if (
        aiResult.message &&
        /connect (you|user)? ?(with|to)? ?(an?|the)? ?(agent|loan officer|support specialist|human)/i.test(
          aiResult.message,
        )
      ) {
        aiEscalationTriggered = true;
      }
    }

    // ✅ SAVE ORIGINAL MESSAGE
    const message = await ChatMessage.create(messageData);

    // ✅ SAVE AND EMIT AI REPLY (If applicable)
    let aiMessageDoc = null;
    if (
      result.senderType === "user" &&
      aiResult &&
      aiResult.message &&
      isAiActive
    ) {
      const aiMessageData = {
        text: aiResult.message,
        senderType: "ai-bot",
        senderEmail: "ai-bot@loanapp.com",
        messageType: "text",
        userId: result.userId,
        aiMetadata: aiResponseMetadata,
        attachments: [],
      };

      if (result.applicationId) {
        aiMessageData.applicationId = result.applicationId;
      }

      aiMessageDoc = await ChatMessage.create(aiMessageData);

      // Emit AI message to the socket room (applicationId or userId)
      emitMessage(result.applicationId || result.userId, aiMessageDoc);
    }

    // ✅ UPDATE LOAN TRACKING (Only if applicationId exists)
    if (result.applicationId) {
      await Loan.findByIdAndUpdate(result.applicationId, {
        updatedAt: new Date(),
        $inc: {
          "unread.admin": result.senderType === "user" ? 1 : 0,
          "unread.user": result.senderType === "admin" ? 1 : 0,
        },
      });
    }

    // --- ESCALATION EMAIL LOGIC ---
    if (aiEscalationTriggered) {
      const admin = await Admin.findOne({ status: "active" }).select(
        "_id email name",
      );
      const user = await User.findOne({ _id: result.userId });

      if (admin && user) {
        let chatSummary = "";
        try {
          const summaryQuery = result.applicationId
            ? { applicationId: result.applicationId }
            : { userId: result.userId };

          const summaryMessages = await ChatMessage.find(summaryQuery)
            .sort({ createdAt: -1 })
            .limit(10);

          chatSummary = await aiService.generateConversationSummary(
            summaryMessages.reverse(),
          );

          await emailService.sendAdminEscalationEmail(
            { email: admin.email, fullName: admin.name },
            { fullName: user.fullName, email: user.email, _id: user._id },
            aiResponseMetadata
              ? aiResponseMetadata.intent
              : "escalation_required",
            chatSummary,
          );
        } catch (err) {
          console.error("[AI Escalation] Error:", err.message);
        }
      }
    }

    // ✅ FINAL SOCKET EMIT FOR THE ORIGINAL MESSAGE
    emitMessage(result.applicationId || result.userId, message);

    res.status(201).json({
      success: true,
      message,
      aiMessage: aiMessageDoc,
    });
  } catch (err) {
    if (err.isJoi) {
      return next(new HttpError(err.details[0].message, 400));
    }
    next(new HttpError(`Message delivery failed: ${err.message}`, 500));
  }
};

/* ===============================
   FETCH MESSAGES - Get paginated chat history
================================ */
// Fetch messages by applicationId or userId
const FetchMessages = async (req, res, next) => {
  try {
    const { applicationId, userId } = req.params;
    const { page = 1, limit = 30 } = req.query;

    let query = {};
    if (applicationId) {
      query = { applicationId };
    } else if (userId) {
      query = { userId };
    } else {
      return next(new HttpError("No applicationId or userId provided", 400));
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      page: parseInt(page),
      limit: parseInt(limit),
      messages: messages.reverse(),
    });
  } catch (err) {
    next(new HttpError(`Failed to fetch messages: ${err.message}`, 500));
  }
};

/* ===============================
   FETCH ALL APPLICATIONS - Admin dashboard list (REVISED)
================================ */
const FetchAllApplications = async (req, res, next) => {
  try {
    // 1. Find unique users who have sent messages using Aggregation
    const activeChats = await ChatMessage.aggregate([
      {
        $sort: { createdAt: -1 }, // Get latest messages first
      },
      {
        $group: {
          _id: "$userId", // Group by the user
          lastMessageText: { $first: "$text" },
          lastMessageDate: { $first: "$createdAt" },
          applicationId: { $first: "$applicationId" },
        },
      },
    ]);

    // 2. Populate user and loan details for these active chats
    const chatList = await Promise.all(
      activeChats.map(async (chat) => {
        const user = await User.findById(chat._id)
          .select("fullName email")
          .lean();
        let loan = null;

        if (chat.applicationId) {
          loan = await Loan.findById(chat.applicationId).lean();
        } else {
          // Fallback: Check if they have ANY loan even if the message wasn't linked to one
          loan = await Loan.findOne({ userId: chat._id })
            .sort({ createdAt: -1 })
            .lean();
        }

        // Merge data to match the frontend expectations
        return {
          _id: loan?._id || chat._id, // Use loan ID if exists, otherwise User ID
          userId: user,
          userName: user?.fullName || "Guest User",
          userEmail: user?.email,
          lastMessageText: chat.lastMessageText,
          updatedAt: chat.lastMessageDate,
          amount: loan?.amount || 0,
          loanType: loan?.loanType || "Inquiry (No Loan)",
          status: loan?.status || "chatting",
          aiAssistant: loan?.aiAssistant ||
            user?.aiAssistant || { isActive: true }, // check the User/Guest table.
          loanAccountNumber: loan?.loanAccountNumber || "No Active Loan",
        };
      }),
    );

    // Sort by most recent message
    chatList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.status(200).json({
      success: true,
      count: chatList.length,
      loans: chatList, // Sending as 'loans' so frontend doesn't break
    });
  } catch (err) {
    console.error("Failed to fetch chat list:", err);
    next(new HttpError(`Failed to fetch applications: ${err.message}`, 500));
  }
};

/* ===============================
   UPDATE APPLICATION STATUS - Change loan status
================================ */
const UpdateApplicationStatus = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    // ✅ Allowed statuses from schema
    const allowedStatuses = [
      "pending",
      "under_review",
      "approved",
      "deposit_paid",
      "funded",
      "rejected",
      "defaulted",
      "completed",
    ];

    if (!allowedStatuses.includes(status)) {
      return next(
        new HttpError(
          `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
          400,
        ),
      );
    }

    const loan = await Loan.findByIdAndUpdate(
      applicationId,
      {
        status,
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!loan) {
      return next(new HttpError("Loan application not found.", 404));
    }

    /* ===============================
		   SYSTEM NOTIFICATION
		================================ */
    const systemMsg = await ChatMessage.create({
      applicationId: loan._id,
      senderType: "system",
      messageType: "text",
      text: `⚠️ System: Loan status updated to ${status.toUpperCase()}.`,
    });

    // 🔌 SOCKET EMIT (Notify both parties)
    emitMessage(applicationId, systemMsg);

    res.status(200).json({
      success: true,
      loan,
      systemMsg,
    });
  } catch (err) {
    next(new HttpError(`Status update failed: ${err.message}`, 500));
  }
};

module.exports = {
  InitChat,
  PostMessage,
  FetchMessages,
  FetchAllApplications,
  UpdateApplicationStatus,
};
