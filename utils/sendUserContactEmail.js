const nodemailer = require("nodemailer");

const sendContactUsEmail = async (email, { fullName, message }) => {
	try {
		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASS,
			},
		});

		const mailOptions = {
			from: email, //  email of the user trying to send message to admin on contact us page fro the  front-end
			to: process.env.EMAIL_USER, // Admin email to receive the message
			subject: `New Contact Us Message from ${fullName}`,
			html: `
		  <h2>New Contact Request</h2>
		  <p><strong>Full Name:</strong> ${fullName}</p>
		  <p><strong>Email:</strong> ${email}</p>
		  <p><strong>Message:</strong></p>
		  <p>${message}</p>
		`,
		};

		await transporter.sendMail(mailOptions);
	} catch (error) {
		console.error("Error in sendContactUsEmail:", error);
		throw new Error("Failed to send contact us email.");
	}
};

module.exports = sendContactUsEmail;
