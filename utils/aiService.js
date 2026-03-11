const axios = require("axios");
/* ===============================
   AI SERVICE CONFIGURATION
   Handles free-tier OpenAI API calls
   for loan support chatbot
================================ */


/* ===============================
 To use Groq + Llama 3, set GROQ_API_KEY in your .env file (leave blank if not available)
 Example: GROQ_API_KEY=your_groq_key_here
 Groq uses OpenAI-compatible API, so you only need to change the base URL and model
================================ */
class AIService {
   constructor() {
       this.apiKey = process.env.GROQ_API_KEY || "";
       this.apiUrl = "https://api.groq.com/openai/v1/chat/completions";
       this.model = "openai/gpt-oss-120b"; // Groq's latest supported model
       this.maxTokens = 500;
       this.temperature = 0.7;
   }

   // Detect if the message is a simple greeting
   isGreeting(message) {
       const greetings = [
           "hello", "hi", "hey", "good morning", "good afternoon", "good evening", "greetings"
       ];
       const normalized = message.trim().toLowerCase();
       return greetings.some(greet => normalized === greet || normalized.startsWith(greet + " "));
   }





	/**
	 * Generate system prompt for loan support AI
	 * Uses EXACT company guidelines from company-ai-guide.pdf
	 */
	getSystemPrompt() {
		return `AI SYSTEM PROMPT – LOAN COMPANY ASSISTANT

ROLE & IDENTITY:
You are an AI Loan Support Assistant representing a licensed loan service provider. You act as the first point of contact for customers seeking loans in USD. You communicate professionally, clearly, and politely at all times.

SCOPE LIMITATION:
You must ONLY discuss:
- Company loan products
- Loan eligibility
- Application procedures
- Repayment structure
- Interest rates (as provided)
- Required documentation
You must NOT discuss unrelated topics, personal opinions, or external financial advice.

STANDARD LOAN TYPES:
- Personal Loans
- Short-Term Emergency Loans
- Business Support Loans
- Salary-Based Loans

LOAN AMOUNTS:
- Minimum: $500
- Maximum: No limit (subject to individual qualification and USA lending standards)
- Flexible amounts based on customer needs and creditworthiness

INTEREST & FEES:
- Interest rates vary based on loan type and duration
- Rates are communicated clearly before agreement
- No hidden charges
- Upfront processing fee applies before disbursement

STANDARD REPAYMENT TERMS:
- Weekly, bi-weekly, or monthly repayment options
- Fixed repayment schedule
- Early repayment allowed without penalty (unless stated)

APPLICATION FLOW:
1. User inquiry
2. Eligibility confirmation
3. Application form shared
4. Document submission
5. Application review
6. Upfront processing fee payment
7. Final approval
8. Loan disbursement

DOCUMENT VERIFICATION:
- All documents are verified for authenticity
- False documents lead to automatic rejection
- Verification timelines are communicated to users

UPFRONT FEE POLICY:
- Mandatory processing fee before loan disbursement
- Fee varies by loan amount
- Fee covers verification and processing
- Fee does not guarantee approval

USER COMMUNICATION RULES:
- Never pressure user to pay
- Always explain terms clearly
- Always confirm user understanding
- Avoid guarantees

FAQ HANDLING:
- Answer common questions politely
- Use structured explanations
- Redirect complex issues to admin

PAYMENT INTENT DETECTION:
Trigger admin handover if user:
- Requests payment details
- Requests invoice
- Confirms readiness to pay
- Asks for bank or crypto details

ESCALATION POLICY:
Escalate to admin if user:
- Disputes terms
- Requests exceptions
- Demands immediate approval

HANDOVER MESSAGE:
"I will connect you with a loan officer who can assist you further. Please stay connected."

SECURITY & COMPLIANCE:
- Do not store sensitive data in chat
- Redirect users to secure forms
- Follow data protection standards

FAIL-SAFE RESPONSE:
If unsure: "I will forward this request to a loan officer for clarification."`;
	}

	/**
	 * Send message to OpenAI and get AI response
	 * @param {string} userMessage - User's message
	 * @param {Array} conversationHistory - Previous messages for context
	 * @returns {Promise<Object>} AI response with metadata
	 */
	async generateResponse(userMessage, conversationHistory = []) {
		// Smart greeting: reply with a short welcome for simple greetings
		if (this.isGreeting(userMessage)) {
			return {
				success: true,
				message: "Hello! 👋 Welcome to LoanApp Support. How can I assist you today?",
				metadata: {
					intent: "greeting",
					confidence: 1.0,
					isFlagged: false,
				},
			};
		}
		try {
			// Validate API key
			   if (!this.apiKey) {
				   throw new Error(
					   "GROQ_API_KEY is not configured in environment variables",
				   );
			   }

			// Build conversation messages
			const messages = [
				{
					role: "system",
					content: this.getSystemPrompt(),
				},
				...conversationHistory.map((msg) => ({
					role: msg.senderType === "user" ? "user" : "assistant",
					content: msg.text,
				})),
				{
					role: "user",
					content: userMessage,
				},
			];

			   // Make API call with debug logging
			   const payload = {
				   model: this.model,
				   messages,
				   max_tokens: this.maxTokens,
				   temperature: this.temperature,
			   };
			   try {
				   const response = await axios.post(
					   this.apiUrl,
					   payload,
					   {
						   headers: {
							   Authorization: `Bearer ${this.apiKey}`,
							   "Content-Type": "application/json",
						   },
						   timeout: 30000, // 30 second timeout
					   },
				   );
				   // Extract response
				   const aiMessage = response.data.choices[0].message.content;
				   const usedTokens = response.data.usage.total_tokens;
				   const completionTokens = response.data.usage.completion_tokens;
				   return {
					   success: true,
					   message: aiMessage,
					   metadata: {
						   intent: this.extractIntent(userMessage),
						   confidence: 0.85, // Default confidence
						   isFlagged: this.shouldFlagForAdmin(userMessage, aiMessage),
						   tokensUsed: usedTokens,
						   completionTokens,
					   },
				   };
			   } catch (error) {
				   // Debug log for Groq API errors (full stack and response)
				   console.error("❌ AI Service Error: Groq API request failed");
				   console.error("Request payload:", JSON.stringify(payload, null, 2));
				   if (error.response) {
					   console.error("Groq API response status:", error.response.status);
					   console.error("Groq API response data:", error.response.data);
					   if (error.response.headers) {
						   console.error("Groq API response headers:", error.response.headers);
					   }
				   } else if (error.request) {
					   console.error("Groq API no response received. Request:", error.request);
				   } else {
					   console.error("Groq API error:", error.message);
				   }
				   console.error("Groq API error stack:", error.stack);
				   // Fallback response for API errors
				   return {
					   success: false,
					   message: this.getFallbackResponse(userMessage),
					   metadata: {
						   intent: "error_recovery",
						   confidence: 0.5,
						   isFlagged: true,
						   error: error.message,
					   },
				   };
			   }

			// Extract response
			const aiMessage = response.data.choices[0].message.content;
			const usedTokens = response.data.usage.total_tokens;
			const completionTokens = response.data.usage.completion_tokens;

			return {
				success: true,
				message: aiMessage,
				metadata: {
					intent: this.extractIntent(userMessage),
					confidence: 0.85, // Default confidence
					isFlagged: this.shouldFlagForAdmin(userMessage, aiMessage),
					tokensUsed: usedTokens,
					completionTokens,
				},
			};
		} catch (error) {
			console.error("❌ AI Service Error:", error.message);

			// Fallback response for API errors
			return {
				success: false,
				message: this.getFallbackResponse(userMessage),
				metadata: {
					intent: "error_recovery",
					confidence: 0.5,
					isFlagged: true,
					error: error.message,
				},
			};
		}
	}

	/**
	 * Extract user intent from message
	 * Used for analytics, routing, and escalation detection
	 */
	extractIntent(message) {
		const lowerMessage = message.toLowerCase();

		// PAYMENT INTENT - Trigger admin handover
		if (
			lowerMessage.includes("payment") ||
			lowerMessage.includes("pay now") ||
			lowerMessage.includes("ready to pay") ||
			lowerMessage.includes("bank details") ||
			lowerMessage.includes("account number") ||
			lowerMessage.includes("wire") ||
			lowerMessage.includes("transfer") ||
			lowerMessage.includes("crypto") ||
			lowerMessage.includes("bitcoin") ||
			lowerMessage.includes("invoice")
		) {
			return "payment_request";
		}

		// ESCALATION INTENTS
		if (
			lowerMessage.includes("dispute") ||
			lowerMessage.includes("unfair") ||
			lowerMessage.includes("exception") ||
			lowerMessage.includes("deny") ||
			lowerMessage.includes("rejected") ||
			lowerMessage.includes("angry") ||
			lowerMessage.includes("frustrated")
		) {
			return "escalation_required";
		}

		// Loan-related intents
		if (
			lowerMessage.includes("rate") ||
			lowerMessage.includes("interest") ||
			lowerMessage.includes("apr")
		) {
			return "inquiry_interest_rates";
		}
		if (
			lowerMessage.includes("eligible") ||
			lowerMessage.includes("qualify") ||
			lowerMessage.includes("requirements")
		) {
			return "inquiry_eligibility";
		}
		if (
			lowerMessage.includes("apply") ||
			lowerMessage.includes("application")
		) {
			return "inquiry_application_process";
		}
		if (
			lowerMessage.includes("repay") ||
			lowerMessage.includes("term") ||
			lowerMessage.includes("monthly") ||
			lowerMessage.includes("weekly") ||
			lowerMessage.includes("schedule")
		) {
			return "inquiry_repayment";
		}
		if (
			lowerMessage.includes("approve") ||
			lowerMessage.includes("status") ||
			lowerMessage.includes("decision")
		) {
			return "inquiry_application_status";
		}
		if (
			lowerMessage.includes("document") ||
			lowerMessage.includes("id") ||
			lowerMessage.includes("proof")
		) {
			return "inquiry_documents";
		}
		if (
			lowerMessage.includes("amount") ||
			lowerMessage.includes("borrow") ||
			lowerMessage.includes("loan size")
		) {
			return "inquiry_loan_amount";
		}

		return "general_inquiry";
	}

	/**
	 * Determine if message should be flagged for human review
	 * Cases: payment requests, complaints, sensitive info, complex scenarios, escalations
	 */
	shouldFlagForAdmin(userMessage, aiResponse) {
		const lowerMessage = userMessage.toLowerCase();

		// FLAG: PAYMENT INTENT - User requesting payment details
		const paymentPatterns = [
			/\bpay\b|\bpayment\b/,
			/\breadi\s+to\s+pay\b|\bready\s+pay\b/,
			/\bbank\s+details?\b|\baccount\s+number\b/,
			/\bwire\b|\btransfer\b/,
			/\bcrypto\b|\bbitcoin\b|\bpay\s+with\b/,
			/\binvoice\b/,
		];
		if (paymentPatterns.some((pattern) => pattern.test(lowerMessage))) {
			return true; // MUST escalate to admin for payment processing
		}

		// FLAG: ESCALATION - Disputes, exceptions, demands
		const escalationPatterns = [
			/\bdispute\b|\bunfair\b|\bscam\b|\bfraud\b/,
			/\bexception\b|\bexcept\b/,
			/\bimmediate\s+approval\b|\bdemand\b/,
			/\bdenied\b|\brejected\b/,
		];
		if (escalationPatterns.some((pattern) => pattern.test(lowerMessage))) {
			return true;
		}

		// FLAG: SENSITIVE INFO - SSN, account numbers, credentials
		const sensitivePatterns = [
			/\bssn\b/,
			/\bsocial\s+security/,
			/\baccount\s+number\b/,
			/\bpassword\b|\bcredit\s+card\b/,
		];
		if (sensitivePatterns.some((pattern) => pattern.test(lowerMessage))) {
			return true;
		}

		// FLAG: CUSTOMER FRUSTRATION - Emotional distress
		const frustrationPatterns = [
			/\bangry\b|\bupset\b|\bfrustrated\b|\bunhappy\b/,
			/\bplease\s+help\b|\bhelp\s+me\b/,
			/\bwaste.*time\b|\bstop.*wasting\b/,
		];
		if (frustrationPatterns.some((pattern) => pattern.test(lowerMessage))) {
			return true;
		}

		// FLAG: AI UNCERTAINTY - AI cannot confidently answer
		if (
			aiResponse.includes("I'm not sure") ||
			aiResponse.includes("I recommend speaking with") ||
			aiResponse.includes("I cannot") ||
			aiResponse.includes("not able to")
		) {
			return true;
		}

		return false;
	}

	/**
	 * Fallback response when API fails
	 * Ensures user always gets a response
	 */
	getFallbackResponse(userMessage) {
		const responses = [
			"I'm experiencing technical difficulties. A human agent will be with you shortly. How can I help you today?",
			"I'm temporarily unavailable. Let me connect you with one of our support specialists who can better assist you.",
			"Thank you for your message. Due to high demand, please bear with me. You can also reach our team at support@loanapp.com",
		];

		return responses[Math.floor(Math.random() * responses.length)];
	}

	/**
	 * Generate summary of conversation
	 * Used by admin before taking over chat
	 */
	async generateConversationSummary(messages) {
		try {
			const conversationText = messages
				.map(
					(msg) =>
						`${msg.senderType === "user" ? "User" : "Agent"}: ${msg.text}`,
				)
				.join("\n");

			const response = await axios.post(
				this.apiUrl,
				{
					model: this.model,
					messages: [
						{
							role: "system",
							content:
								"Summarize this loan support chat in 2-3 sentences for an agent to quickly understand the user's issue.",
						},
						{
							role: "user",
							content: conversationText,
						},
					],
					max_tokens: 150,
					temperature: 0.3,
				},
				{
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
					timeout: 15000,
				},
			);

			return response.data.choices[0].message.content;
		} catch (error) {
			console.error("❌ Summary Generation Error:", error.message);
			return "Unable to generate summary. Please review chat history.";
		}
	}
}

// Export as singleton
module.exports = new AIService();
