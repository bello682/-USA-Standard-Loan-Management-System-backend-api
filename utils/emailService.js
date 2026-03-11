const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const { promises: fs } = require("fs");

/* ===============================
   EMAIL SERVICE
   Handles all email communications
   Follows USA compliance standards
================================ */

class EmailService {
  /**
   * Send escalation email to admin when AI escalates chat
   * @param {Object} admin - Admin user object (must have email, fullName)
   * @param {Object} guestUser - Guest user object (must have fullName, email, _id)
   * @param {string} reason - Reason for escalation
   * @param {string} [chatSummary] - Optional summary of the chat
   */
  async sendAdminEscalationEmail(admin, guestUser, reason, chatSummary = "") {
    try {
      const subject = `🚨 Chat Escalation: Guest Needs Human Support`;
      const htmlContent = `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
						<h2 style="color: #c0392b;">AI Escalation Alert</h2>
						<p><strong>Guest Name:</strong> ${guestUser.fullName}</p>
						<p><strong>Guest Email:</strong> ${guestUser.email}</p>
						<p><strong>Guest Session ID:</strong> ${guestUser._id}</p>
						<p><strong>Escalation Reason:</strong> ${reason}</p>
						${chatSummary ? `<div style='background:#f9f9f9;padding:10px;border-radius:6px;margin:10px 0;'><strong>Chat Summary:</strong><br>${chatSummary}</div>` : ""}
						<p style="color:#888;">This notification was triggered automatically by the AI assistant when it detected a scenario requiring human intervention.</p>
					</div>
				`;
      await this.send(admin.email, subject, htmlContent);
      //   console.log(`✅ Escalation email sent to admin: ${admin.email}`);
    } catch (error) {
      console.error(`❌ Failed to send escalation email: ${error.message}`);
      throw error;
    }
  }
  constructor() {
    // Using SendGrid (more reliable for production)
    // Always use Gmail service for Nodemailer
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    this.isUsingSendGrid = false;
    // Debug: Log email config at startup
    // console.debug(
    // 	"[EMAIL CONFIG] Using Gmail with user:",
    // 	process.env.EMAIL_USER,
    // );

    this.fromEmail = process.env.EMAIL_USER || "noreply@loanapp.com";
    this.companyName = "LoanApp";
  }

  /**
   * Send OTP Email to new user
   * USA standard verification email
   */
  async sendOtpEmail(email, otp, fullName) {
    try {
      const subject = `Verify Your Email - ${this.companyName}`;
      const htmlContent = this.getOtpTemplate(otp, fullName);

      await this.send(email, subject, htmlContent);
      //   console.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send OTP email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send Loan Application Received Email
   */
  async sendLoanApplicationReceivedEmail(
    email,
    fullName,
    applicationId,
    loanAmount,
  ) {
    try {
      const subject = `Loan Application Received - Application #${applicationId}`;
      const htmlContent = this.getLoanApplicationTemplate(
        fullName,
        applicationId,
        loanAmount,
      );

      await this.send(email, subject, htmlContent);
      //   console.log(`✅ Application confirmation email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send application email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send Loan Approval Email
   * USA standard approval notification
   */
  async sendLoanApprovalEmail(
    email,
    fullName,
    applicationId,
    loanAmount,
    monthlyPayment,
    term,
    interestRate,
  ) {
    try {
      const subject = `🎉 Loan Approved - ${this.companyName}`;
      const htmlContent = this.getLoanApprovalTemplate(
        fullName,
        applicationId,
        loanAmount,
        monthlyPayment,
        term,
        interestRate,
      );

      await this.send(email, subject, htmlContent);
      //   console.log(`✅ Approval email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send approval email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send Loan Rejection Email
   */
  async sendLoanRejectionEmail(email, fullName, applicationId, reason) {
    try {
      const subject = `Loan Application Status - ${this.companyName}`;
      const htmlContent = this.getLoanRejectionTemplate(
        fullName,
        applicationId,
        reason,
      );

      await this.send(email, subject, htmlContent);
      //   console.log(`✅ Rejection email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send rejection email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send Payment Reminder Email
   */
  async sendPaymentReminderEmail(
    email,
    fullName,
    applicationId,
    paymentAmount,
    dueDate,
  ) {
    try {
      const subject = `Payment Due Reminder - ${this.companyName}`;
      const htmlContent = this.getPaymentReminderTemplate(
        fullName,
        applicationId,
        paymentAmount,
        dueDate,
      );

      await this.send(email, subject, htmlContent);
      //   console.log(`✅ Payment reminder sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send payment reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send Contact Form Response Email
   */
  async sendContactResponseEmail(email, fullName, message, ticketId) {
    try {
      const subject = `We Received Your Message - Support Ticket #${ticketId}`;
      const htmlContent = this.getContactResponseTemplate(
        fullName,
        message,
        ticketId,
      );

      await this.send(email, subject, htmlContent);
      //   console.log(`✅ Contact confirmation email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send contact response: ${error.message}`);
      throw error;
    }
  }

  /**
   * Core send method (supports SendGrid and Nodemailer)
   */
  async send(to, subject, htmlContent) {
    try {
      // Debug: Log email send attempt
      console.debug(
        `[EMAIL SEND] Attempting to send email to: ${to} | Subject: ${subject}`,
      );
      if (this.isUsingSendGrid) {
        const msg = {
          to,
          from: this.fromEmail,
          subject,
          html: htmlContent,
        };
        await this.sgMail.send(msg);
        console.debug(`[EMAIL SEND] Email sent via SendGrid to: ${to}`);
      } else {
        const info = await this.transporter.sendMail({
          from: this.fromEmail,
          to,
          subject,
          html: htmlContent,
        });
        console.debug(
          `[EMAIL SEND] Email sent via Gmail to: ${to} | MessageId: ${info.messageId}`,
        );
      }
    } catch (error) {
      console.error(`❌ Email send error: ${error.message}`);
      throw error;
    }
  }

  /* ===============================
   ADD THIS TO EmailService CLASS
================================ */

  /**
   * Send Password Reset Email to Admin
   * Includes security warnings and reset link
   */
  async sendPasswordResetEmail(email, fullName, resetLink) {
    try {
      const subject = `Reset Your Admin Password - ${this.companyName}`;
      const htmlContent = this.getPasswordResetTemplate(fullName, resetLink);

      await this.send(email, subject, htmlContent);
      //   console.log(`✅ Password reset email sent to admin: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send password reset email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send Security Alert for New Login
   * Alert admin of new device/location access
   */
  async sendSecurityEmail(email, { device, ip, location, time }) {
    try {
      const subject = `🔐 Security Alert: New Login Detected - ${this.companyName}`;
      const htmlContent = this.getSecurityAlertTemplate(
        device,
        ip,
        location,
        time,
      );

      await this.send(email, subject, htmlContent);
      //   console.log(`✅ Security alert sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send security email: ${error.message}`);
      // We don't throw here so the login process isn't interrupted
    }
  }

  /* ===============================
	   EMAIL TEMPLATES
	================================ */

  getOtpTemplate(otp, fullName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Email Verification</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; margin-bottom: 30px; }
		.logo { font-size: 24px; font-weight: bold; color: #2c5aa0; }
		.content { background: #f9f9f9; padding: 20px; border-radius: 8px; }
		.otp-box { 
			background: #2c5aa0; 
			color: white; 
			padding: 20px; 
			text-align: center; 
			border-radius: 8px; 
			margin: 20px 0;
		}
		.otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; }
		.footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
		.warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 20px 0; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">${this.companyName}</div>
		</div>
		
		<div class="content">
			<p>Hello ${fullName},</p>
			
			<p>Thank you for signing up with ${this.companyName}! To complete your registration, please verify your email address using the code below:</p>
			
			<div class="otp-box">
				<p style="margin: 0; font-size: 14px; opacity: 0.9;">Your Verification Code</p>
				<div class="otp-code">${otp}</div>
			</div>
			
			<p><strong>This code will expire in 5 minutes.</strong></p>
			
			<div class="warning">
				<strong>Security Notice:</strong> Never share this code with anyone. ${this.companyName} staff will never ask for your verification code.
			</div>
			
			<p>If you didn't create this account, please ignore this email or contact support.</p>
			
			<p>Best regards,<br>
			The ${this.companyName} Team</p>
		</div>
		
		<div class="footer">
			<p>&copy; ${new Date().getFullYear()} ${this.companyName}. All rights reserved.<br>
			This is an automated email. Please do not reply directly.</p>
		</div>
	</div>
</body>
</html>
		`;
  }

  getLoanApplicationTemplate(fullName, applicationId, loanAmount) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Application Received</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; margin-bottom: 30px; }
		.logo { font-size: 24px; font-weight: bold; color: #2c5aa0; }
		.alert { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 4px; margin: 20px 0; }
		.details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
		.detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
		.footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
		.button { 
			background: #2c5aa0; 
			color: white; 
			padding: 10px 20px; 
			text-decoration: none; 
			border-radius: 4px; 
			display: inline-block; 
			margin: 20px 0;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">${this.companyName}</div>
		</div>
		
		<div class="alert">
			✅ Your loan application has been received successfully!
		</div>
		
		<p>Hello ${fullName},</p>
		
		<p>Thank you for applying for a loan with ${this.companyName}. We've received your application and our team is reviewing it.</p>
		
		<div class="details">
			<div class="detail-row">
				<strong>Application #:</strong>
				<span>${applicationId}</span>
			</div>
			<div class="detail-row">
				<strong>Requested Amount:</strong>
				<span>$${loanAmount.toLocaleString()}</span>
			</div>
			<div class="detail-row">
				<strong>Status:</strong>
				<span style="color: #ffc107;">⏳ Under Review</span>
			</div>
		</div>
		
		<p><strong>What happens next?</strong></p>
		<ul>
			<li>Our team will review your application within 24-48 business hours</li>
			<li>You may be asked to provide additional documentation</li>
			<li>We'll notify you via email and SMS of any updates</li>
			<li>You can check your application status anytime at ${process.env.WEBSITE_URL}</li>
		</ul>
		
		<a href="${process.env.WEBSITE_URL}/dashboard/application/${applicationId}" class="button">View Application Status</a>
		
		<p>If you have any questions, our support team is available 24/7. Contact us at support@loanapp.com</p>
		
		<p>Best regards,<br>
		The ${this.companyName} Team</p>
		
		<div class="footer">
			<p>&copy; ${new Date().getFullYear()} ${this.companyName}. All rights reserved.</p>
		</div>
	</div>
</body>
</html>
		`;
  }

  getLoanApprovalTemplate(
    fullName,
    applicationId,
    loanAmount,
    monthlyPayment,
    term,
    interestRate,
  ) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Loan Approved</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; margin-bottom: 30px; }
		.logo { font-size: 24px; font-weight: bold; color: #2c5aa0; }
		.success-alert { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; font-size: 18px; font-weight: bold; }
		.terms-box { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
		.term-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
		.term-item:last-child { border-bottom: none; }
		.button { 
			background: #28a745; 
			color: white; 
			padding: 12px 24px; 
			text-decoration: none; 
			border-radius: 4px; 
			display: inline-block; 
			margin: 20px 0;
			font-weight: bold;
		}
		.footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">${this.companyName}</div>
		</div>
		
		<div class="success-alert">
			🎉 Congratulations! Your Loan is Approved! 🎉
		</div>
		
		<p>Hello ${fullName},</p>
		
		<p>Great news! Your loan application (Application #${applicationId}) has been <strong>APPROVED</strong>!</p>
		
		<p>Here are your loan terms:</p>
		
		<div class="terms-box">
			<div class="term-item">
				<strong>Loan Amount:</strong>
				<span>$${loanAmount.toLocaleString()}</span>
			</div>
			<div class="term-item">
				<strong>Interest Rate (APR):</strong>
				<span>${interestRate}%</span>
			</div>
			<div class="term-item">
				<strong>Loan Term:</strong>
				<span>${term} months</span>
			</div>
			<div class="term-item">
				<strong>Monthly Payment:</strong>
				<span style="color: #2c5aa0; font-weight: bold;">$${monthlyPayment.toLocaleString()}</span>
			</div>
		</div>
		
		<p><strong>Next Steps:</strong></p>
		<ol>
			<li>Review and accept the loan agreement</li>
			<li>Complete identity verification (if not already done)</li>
			<li>Set up your repayment bank account</li>
			<li>Funds will be deposited within 1-2 business days</li>
		</ol>
		
		<a href="${process.env.WEBSITE_URL}/dashboard/accept/${applicationId}" class="button">Accept Loan &amp; Proceed</a>
		
		<p style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
			<strong>⚠️ Important:</strong> Please review all terms and conditions carefully before accepting. You can always contact our team if you have questions.
		</p>
		
		<p>Questions? Contact us at support@loanapp.com or call 1-800-LOANAPP</p>
		
		<p>Best regards,<br>
		The ${this.companyName} Team</p>
		
		<div class="footer">
			<p>&copy; ${new Date().getFullYear()} ${this.companyName}. All rights reserved.</p>
		</div>
	</div>
</body>
</html>
		`;
  }

  getLoanRejectionTemplate(fullName, applicationId, reason) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Application Decision</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; margin-bottom: 30px; }
		.logo { font-size: 24px; font-weight: bold; color: #2c5aa0; }
		.info-alert { background: #e7f3ff; border: 1px solid #b3d9ff; color: #004085; padding: 15px; border-radius: 4px; margin: 20px 0; }
		.footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
		.next-steps { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
		a { color: #2c5aa0; text-decoration: none; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">${this.companyName}</div>
		</div>
		
		<div class="info-alert">
			📋 Application Decision for Application #${applicationId}
		</div>
		
		<p>Hello ${fullName},</p>
		
		<p>Thank you for applying with ${this.companyName}. After careful review of your application, we regret to inform you that we are unable to approve your loan request at this time.</p>
		
		<p><strong>Reason:</strong></p>
		<p>${reason}</p>
		
		<div class="next-steps">
			<strong>What you can do next:</strong>
			<ul>
				<li>Reapply after 3 months (our requirements may have changed)</li>
				<li>Contact our team to discuss alternative loan options</li>
				<li>Check your credit report for any errors at annualcreditreport.com</li>
				<li>Work on improving your credit score or income documentation</li>
			</ul>
		</div>
		
		<p>We encourage you to reach out to our support team to discuss how you can strengthen your application. Everyone deserves a second chance!</p>
		
		<p>Contact us: support@loanapp.com or 1-800-LOANAPP</p>
		
		<p>Best regards,<br>
		The ${this.companyName} Team</p>
		
		<div class="footer">
			<p>&copy; ${new Date().getFullYear()} ${this.companyName}. All rights reserved.</p>
		</div>
	</div>
</body>
</html>
		`;
  }

  getPaymentReminderTemplate(fullName, applicationId, paymentAmount, dueDate) {
    const dueDateFormatted = new Date(dueDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Payment Reminder</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; margin-bottom: 30px; }
		.logo { font-size: 24px; font-weight: bold; color: #2c5aa0; }
		.reminder { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
		.payment-box { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
		.payment-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
		.amount { font-size: 24px; font-weight: bold; color: #2c5aa0; }
		.button { 
			background: #2c5aa0; 
			color: white; 
			padding: 10px 20px; 
			text-decoration: none; 
			border-radius: 4px; 
			display: inline-block; 
			margin: 20px 0;
		}
		.footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">${this.companyName}</div>
		</div>
		
		<div class="reminder">
			⏰ Payment Due Reminder - Loan #${applicationId}
		</div>
		
		<p>Hello ${fullName},</p>
		
		<p>This is a friendly reminder that your loan payment is due on <strong>${dueDateFormatted}</strong>.</p>
		
		<div class="payment-box">
			<div class="payment-row">
				<strong>Loan Account:</strong>
				<span>#${applicationId}</span>
			</div>
			<div class="payment-row">
				<strong>Amount Due:</strong>
				<span class="amount">$${paymentAmount.toLocaleString()}</span>
			</div>
			<div class="payment-row">
				<strong>Due Date:</strong>
				<span>${dueDateFormatted}</span>
			</div>
		</div>
		
		<p>You can make your payment through:</p>
		<ul>
			<li>Our online dashboard at ${process.env.WEBSITE_URL}/payments</li>
			<li>ACH bank transfer (automatic payments available)</li>
			<li>Phone: 1-800-LOANAPP</li>
		</ul>
		
		<a href="${process.env.WEBSITE_URL}/payments" class="button">Make Payment</a>
		
		<p>If you're having difficulty making this payment, please contact us immediately. We're here to help!</p>
		
		<p>Contact: support@loanapp.com or 1-800-LOANAPP</p>
		
		<p>Best regards,<br>
		The ${this.companyName} Team</p>
		
		<div class="footer">
			<p>&copy; ${new Date().getFullYear()} ${this.companyName}. All rights reserved.</p>
		</div>
	</div>
</body>
</html>
		`;
  }

  getContactResponseTemplate(fullName, message, ticketId) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Support Ticket Received</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; margin-bottom: 30px; }
		.logo { font-size: 24px; font-weight: bold; color: #2c5aa0; }
		.ticket { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0; }
		.ticket-id { font-size: 18px; font-weight: bold; }
		.message-box { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2c5aa0; }
		.footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">${this.companyName}</div>
		</div>
		
		<div class="ticket">
			✅ We received your message!<br>
			<span class="ticket-id">Support Ticket #${ticketId}</span>
		</div>
		
		<p>Hello ${fullName},</p>
		
		<p>Thank you for contacting ${this.companyName} support. We've received your message and our team will review it shortly.</p>
		
		<div class="message-box">
			<strong>Your Message:</strong><br>
			<p>${message}</p>
		</div>
		
		<p><strong>What to expect:</strong></p>
		<ul>
			<li>Our support team will respond within 24 hours</li>
			<li>You can track this ticket using ID: <strong>#${ticketId}</strong></li>
			<li>Check your email and spam folder for our response</li>
		</ul>
		
		<p>If your issue is urgent, you can also reach us by phone at 1-800-LOANAPP (available 24/7).</p>
		
		<p>Best regards,<br>
		The ${this.companyName} Support Team</p>
		
		<div class="footer">
			<p>&copy; ${new Date().getFullYear()} ${this.companyName}. All rights reserved.</p>
		</div>
	</div>
</body>
</html>
		`;
  }

  /**
   * Password Reset Template
   */
  getPasswordResetTemplate(fullName, resetLink) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; }
        .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #002D62; }
        .content { padding: 30px 20px; background: #ffffff; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { 
            background-color: #002D62; 
            color: #ffffff !important; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold;
            display: inline-block;
        }
        .warning { 
            background: #fff5f5; 
            border-left: 4px solid #fc8181; 
            padding: 15px; 
            margin: 20px 0; 
            font-size: 13px; 
            color: #c53030;
        }
        .footer { text-align: center; font-size: 12px; color: #718096; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin:0; color: #002D62;">${this.companyName} Admin Security</h2>
        </div>
        <div class="content">
            <p>Hello <strong>${fullName}</strong>,</p>
            <p>We received a request to reset the password for your administrator account. Click the button below to set a new password:</p>
            
            <div class="button-container">
                <a href="${resetLink}" class="button">Reset Admin Password</a>
            </div>

            <p>This link will expire in <strong>10 minutes</strong> for security reasons.</p>

            <div class="warning">
                <strong>Security Alert:</strong> If you did not request this password reset, please ignore this email and ensure your account is secure. An audit log has been created for this request.
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; font-size: 12px; color: #002D62;">${resetLink}</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${this.companyName} Corporate Systems. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  getSecurityAlertTemplate(device, ip, location, time) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Alert</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; }
        .header { text-align: center; padding: 20px 0; background-color: #f8f9fa; }
        .shield-icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 30px; }
        .alert-title { color: #d9534f; font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 20px; }
        .info-table { width: 100%; background: #fdfdfd; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #777; font-weight: bold; font-size: 13px; text-transform: uppercase; }
        .value { color: #333; font-weight: 500; }
        .action-box { background: #fff5f5; border: 1px dashed #d9534f; padding: 20px; border-radius: 8px; text-align: center; }
        .button { background: #d9534f; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 10px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="shield-icon">🔐</div>
            <div style="font-size: 22px; font-weight: bold; color: #2c5aa0;">${this.companyName} Security</div>
        </div>
        
        <div class="content">
            <div class="alert-title">New Login Detected</div>
            <p>Hello Admin,</p>
            <p>Your ${this.companyName} account was recently accessed from a new device or location. Please review the details below to ensure this was you.</p>
            
            <div class="info-table">
                <div class="info-row">
                    <span class="label">Device/Browser</span>
                    <span class="value">${device}</span>
                </div>
                <div class="info-row">
                    <span class="label">IP Address</span>
                    <span class="value">${ip}</span>
                </div>
                <div class="info-row">
                    <span class="label">Location</span>
                    <span class="value">${location}</span>
                </div>
                <div class="info-row">
                    <span class="label">Time (UTC)</span>
                    <span class="value">${time}</span>
                </div>
            </div>

            <div class="action-box">
                <p style="margin-top: 0; font-weight: bold; color: #d9534f;">Was this not you?</p>
                <p style="font-size: 14px;">If you do not recognize this activity, your account may be compromised. Please secure your account immediately.</p>
                <a href="${process.env.WEBSITE_URL}/auth/reset-password" class="button">Secure My Account</a>
            </div>
        </div>
        
        <div class="footer">
            <p>This is a mandatory security notification for your ${this.companyName} account.</p>
            <p>&copy; ${new Date().getFullYear()} ${this.companyName} Inc. | 123 Finance Way, New York, NY</p>
        </div>
    </div>
</body>
</html>
    `;
  }
}

// Export as singleton
module.exports = new EmailService();
