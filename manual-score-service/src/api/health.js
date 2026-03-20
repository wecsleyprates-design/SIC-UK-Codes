import { pkgConfig } from "#configs/index";

/**
 * GET /health
 */
export const getHealth = (req, res, next) => {
	try {
		res.jsend.success({
			name: pkgConfig.APP_NAME,
			version: pkgConfig.APP_VERSION,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		next(error);
	}
};
