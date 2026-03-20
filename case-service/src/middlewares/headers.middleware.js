export const extractCustomHeaders = (req, res, next) => {
	try {
		res.locals.custom_headers = {
			"app-version": req.headers["app-version"],
			platform: req.headers.platform
		};

		return next();
	} catch (error) {
		throw error;
	}
};
