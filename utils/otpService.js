const nodemailer = require("nodemailer");

exports.generateOTP = () => {
	return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.sendEmail = async (email, otp) => {
	const transporter = nodemailer.createTransport({
		service: "gmail",
		auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
	});

	await transporter.sendMail({
		from: '"LOANEX Security" <security@loanex.com>',
		to: email,
		subject: "Your Verification Code",
		text: `Your OTP is ${otp}. It expires in 10 minutes.`,
	});
};
