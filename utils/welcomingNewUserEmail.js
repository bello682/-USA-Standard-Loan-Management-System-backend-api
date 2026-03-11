const nodemailer = require("nodemailer");

const sendWelcomeEmail = async (email, fullName) => {
	try {
		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASS,
			},
		});

		const mailOptions = {
			from: process.env.EMAIL_USER,
			to: email,
			subject: "🎉 Welcome to Our Platform!",
			html: `
                <div style="
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                ">
                    <h2 style="color: #4CAF50; text-align: center;">Welcome to Our Platform, ${fullName}!</h2>
                    <p style="font-size: 16px; color: #333;">
                        We're thrilled to have you onboard. 🎯 
                        Your account has been successfully created, and you're now part of an amazing community.
                    </p>
                    <p style="font-size: 16px; color: #333;">
                        Get ready to explore all the exciting features we have to offer.
                        If you have any questions, feel free to reach out to our support team.
                    </p>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="https://your-platform.com/login" style="
                            background-color: #4CAF50;
                            color: #ffffff;
                            padding: 12px 24px;
                            text-decoration: none;
                            border-radius: 5px;
                            display: inline-block;
                            font-size: 16px;
                            font-weight: bold;
                            transition: background-color 0.3s ease;
                        " onMouseOver="this.style.backgroundColor='#45a049'">
                            Get Started 🚀
                        </a>
                    </div>
                    <p style="font-size: 14px; color: #777; text-align: center;">
                        If you didn’t create an account, you can safely ignore this email.
                    </p>
                    <p style="font-size: 14px; color: #777; text-align: center;">
                        Thank you for joining us! 💖
                    </p>
                </div>
            `,
		};

		await transporter.sendMail(mailOptions);
		// console.log("Welcome email sent successfully!");
	} catch (error) {
		console.error("Error in sendWelcomeEmail:", error);
		throw new Error("Failed to send welcome email.");
	}
};

module.exports = sendWelcomeEmail;
