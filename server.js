require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connect } = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const upload = require("express-fileupload");
const os = require("os");

// Import routes
const userRoute = require("./routes/authRoutes");
const loanRoute = require("./routes/loanRoutes");
const chatRoute = require("./routes/chatRoute");
const guestChatRoute = require("./routes/guestChatRoute");
const adminRoute = require("./routes/adminRoute");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

/* ===============================
   BODY PARSERS
================================ */
app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));

/* ===============================
   CORS CONFIG
================================ */
const allowedOrigins = [
  // "https://my-loan-website-nest-js.vercel.app",
  "http://localhost:3003",
  "http://localhost:3000",
];

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV === "development"
      ) {
        callback(null, true);
      } else {
        console.error(`❌ CORS Blocked: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);

/* ===============================
   FILE UPLOAD
================================ */
app.use(
  upload({
    useTempFiles: true,
    tempFileDir: os.tmpdir(),
  }),
);

// ===============================
// TEST EMAIL ENDPOINT
// ===============================
// const emailService = require("./utils/emailService");
// app.get("/api/test-email", async (req, res) => {
// 	try {
// 		const to = process.env.EMAIL_USER;
// 		const subject = "Test Email from LoanApp Backend";
// 		const html = `<h2>Test Email</h2><p>This is a test email sent from the LoanApp backend at ${new Date().toLocaleString()}.</p>`;
// 		await emailService.send(to, subject, html);
// 		res.json({ success: true, message: `Test email sent to ${to}` });
// 	} catch (error) {
// 		res.status(500).json({ success: false, error: error.message });
// 	}
// });

/* ===============================
   ROUTES
================================ */
app.use("/api/auth", userRoute);
app.use("/api/loans", loanRoute);
app.use("/api/chat", chatRoute);
app.use("/api/chat", guestChatRoute);
app.use("/api/admin", adminRoute);

/* ===============================
   ERRORS
================================ */
app.use(notFound);
app.use(errorHandler);

/* ===============================
   DB + SERVER
================================ */
const startServer = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URL;
    const port = process.env.PORT || 5000;

    if (!mongoUrl) {
      throw new Error("MONGODB_URL is missing in .env");
    }

    await connect(mongoUrl);
    console.log("✅ Database connected");

    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
    });

    // ✅ SOCKET INIT (CORRECT PLACE)
    // require("./sockets/chatSocket")(io);
    const chatSocket = require("./sockets/chatSocket");
    chatSocket(io);

    // ===============================
    // TEST EMAIL ENDPOINT
    // ===============================
    const emailService = require("./utils/emailService");
    app.get("/api/test-email", async (req, res) => {
      try {
        const to = process.env.EMAIL_USER;
        const subject = "Test Email from LoanApp Backend";
        const html = `<h2>Test Email</h2><p>This is a test email sent from the LoanApp backend at ${new Date().toLocaleString()}.</p>`;
        await emailService.send(to, subject, html);
        res.json({ success: true, message: `Test email sent to ${to}` });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    server.listen(port, () => {
      console.log(`🚀 Server + Socket.IO running on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Critical Server Error:", err.message);
    process.exit(1);
  }
};

startServer();
