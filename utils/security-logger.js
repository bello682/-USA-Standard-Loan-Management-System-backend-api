const requestIp = require("request-ip");
const UAParser = require("ua-parser-js");

const captureLoginMetadata = async (req) => {
	try {
		const clientIp = requestIp.getClientIp(req);
		const parser = new UAParser(req.headers["user-agent"]);

		const device = `${parser.getOS().name || "Unknown OS"} - ${parser.getBrowser().name || "Browser"}`;

		// Use a simple fetch for location
		let location = "Unknown Location";
		try {
			const response = await fetch(`https://ipapi.co/${clientIp}/json/`);
			const data = await response.json();
			if (data.city) location = `${data.city}, ${data.country_name}`;
		} catch (e) {
			/* ignore geo errors */
		}

		return { clientIp, device, location };
	} catch (err) {
		return { clientIp: "Unknown", device: "Unknown", location: "Unknown" };
	}
};

module.exports = { captureLoginMetadata };

//  npm install ua-parser-js node-fetch nodemailer
//  npm uninstall node-fetch
// $ npm install ejs@^3.1.10
