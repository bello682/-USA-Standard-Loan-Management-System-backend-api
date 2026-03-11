**LoanApp - USA Standard Loan Application Backend**

A production-ready loan application backend following USA lending standards with AI-powered support chat system for both registered and guest users.

Features

✅ USA Compliant Loan Management

Personal, Auto, Student, and Business loans

State-specific regulations (FCRA, TILA, ECOA)

Interest rate calculation based on credit scores

ACH payment processing

✅ Advanced Chat System

Real-time messaging with Socket.IO

AI-powered support bot (OpenAI integration)

Guest chat without registration

Automatic escalation to human agents

Conversation history and read receipts

✅ User Management

Email verification with OTP

KYC/AML compliance

Bank account verification

Facial recognition ready

Security audit trails

✅ Security & Compliance

JWT authentication with refresh tokens

Rate limiting and request validation

Encryption for sensitive data

CORS protection

Cloudinary file uploads

✅ Admin Dashboard

Application management

User support chat

Status updates and notifications

Escalation management

✅ Tech Stack

Backend: Node.js, Express.js

Database: MongoDB with Mongoose ODM

Real-time: Socket.IO

AI: OpenAI API (GPT-3.5-turbo)

Authentication: JWT (JSON Web Tokens)

File Upload: Cloudinary

Email: SendGrid / Nodemailer

Validation: Joi

Utilities: Bcrypt, Moment.js, UUID

✅ Prerequisites

Node.js 18.0 or higher

MongoDB 7.0 or higher (local or Atlas)

npm or yarn

API Keys for:

OpenAI (for AI chat)

Cloudinary (for file uploads)

SendGrid or email provider (for notifications)

Installation

1. Clone Repository
   git clone https://github.com/bello682/-USA-Standard-Loan-Management-System-backend-api.git
   cd my-loan-backend-node-js

2. Install Dependencies
   npm install

3. Setup Environment Variables
   cp ENV_TEMPLATE.md .env
   nano .env

✅ Required Environment Variables:
NODE_ENV=development
PORT=5000
MONGODB_URL=mongodb://localhost:27017/loanapp
JSON_WEB_TOKEN_SECRET_KEY=your_secret_key_here
OPENAI_API_KEY=gsk-your_openai_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
SENDGRID_API_KEY=SG.your_sendgrid_key
EMAIL_FROM=noreply@loanapp.com
FRONTEND_URL=http://localhost:3000

4. Database Setup

# MongoDB should be running

mongod

# For MongoDB Atlas, update MONGODB_URL in .env

5. Start Development Server
   npm run dev
   Server will start on http://localhost:5000

✅ Project Structure

my-loan-backend-node-js/
├── config/
│ └── constants.js # USA loan constants & configuration
├── controllers/
│ ├── userController.js # User registration, login, KYC
│ ├── loanController.js # Loan application management
│ ├── chatController.js # Registered user chat
│ ├── guestChatController.js # Guest chat with AI
│ └── adminController.js # Admin operations
├── middleware/
│ ├── authMiddleware.js # JWT verification
│ ├── errorMiddleware.js # Error handling
│ └── adminMiddleware.js # Admin validation
├── models/
│ ├── userModel.js # User schema
│ ├── loanModel.js # Loan schema
│ ├── ChatMessage.js # Chat message schema
│ ├── guestUserModel.js # Guest user schema
│ └── errorModel.js # Error model
├── routes/
│ ├── authRoutes.js # Authentication endpoints
│ ├── loanRoutes.js # Loan endpoints
│ ├── chatRoute.js # Registered chat endpoints
│ └── guestChatRoute.js # Guest chat endpoints
├── sockets/
│ └── chatSocket.js # Real-time chat events
├── utils/
│ ├── aiService.js # OpenAI integration
│ ├── emailService.js # Email templates & sending
│ ├── otpService.js # OTP generation
│ └── sendOtpEmail.js # OTP email dispatch
├── JoiSchemaValidation/
│ └── schemaValidation.js # Input validation schemas
├── server.js # Main server entry point
├── package.json # Dependencies
└── API_DOCUMENTATION.md # Complete API reference

API Endpoints

✅ Authentication

POST /api/auth/register - Register new user

POST /api/auth/verify-otp - Verify email with OTP

POST /api/auth/login - Login user

GET /api/auth/profile - Get user profile

✅ Loans

POST /api/loans/apply - Create loan application

GET /api/loans/my-loans - Get user's loans

GET /api/loans/:loanId - Get loan details

✅ Registered User Chat

POST /api/chat/init - Initialize chat

POST /api/chat/message - Send message

GET /api/chat/messages/:applicationId - Fetch chat history

✅ Guest Chat (AI Support)

POST /api/chat/guest/init - Start guest session

POST /api/chat/guest/message - Send message (AI responds)

GET /api/chat/guest/messages/:sessionToken - Get history

POST /api/chat/guest/escalate - Escalate to human

✅ Admin

GET /api/chat/applications - Get all applications

PATCH /api/chat/status/:applicationId - Update status

GET /api/chat/guest/escalated - Get escalated chats

Socket.IO Events
✅ Client → Server

socket.emit("join-room", { applicationId });
socket.emit("typing", { applicationId, senderType });
socket.emit("stop-typing", { applicationId });
socket.emit("mark-read", { applicationId, userType });

✅ Server → Client

socket.on("newMessage", (message) => {});
socket.on("typing", ({ senderType }) => {});
socket.on("stop-typing", () => {});
socket.on("read-update", ({ userType }) => {});

✅ AI Chat System

Uses OpenAI GPT-3.5-turbo

Maintains conversation memory

Auto escalation to human agents

Smart fallback responses

✅ Email System
Email Types

OTP Verification

Application Received

Loan Approval / Rejection

Payment Reminders

Support Ticket Responses

✅ Providers

Production: SendGrid (recommended)

Development: Nodemailer (Gmail/SMTP)

⚠️ Nodemailer + Gmail Issue:

If using Gmail with Nodemailer in development:

Enable 2FA for your Gmail account

Generate an App Password

Use App Password in .env instead of your Gmail password:

EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

REFERENCE TO POSTMAN TESTING FILE: LoanApp_API_Collection.postman_collection.json
