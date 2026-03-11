// notFound error
const notFound = (req, res, next) => {
	const error = new Error(`Page Not Found: ${req.originalUrl}`);
	res.status(404);
	next(error);
};

// Error Handling Middleware
const errorHandler = (error, req, res, next) => {
	if (res.headerSent) {
		return next(error);
	}

	// res
	// 	.status(error.statusCode || 500)
	// 	.json({ message: error.message || "Sorry an error occurred" });

	// OR
	res.status(error.statusCode || 500);
	res.json({
		message: error.message || "Sorry an error occurred",
		status: error.statusCode || 500,
	});
};
module.exports = { notFound, errorHandler };
