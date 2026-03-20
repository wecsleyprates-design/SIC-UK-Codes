import { pkgConfig } from "#configs/index";
import { searchSerpWithGoogleEngine } from "#lib/serp/util";

/**
 * GET /health
 */
export const getHealth = async (req, res, next) => {
	try {
		let serpResponse = null;
		if (req.query.search) serpResponse = await searchSerpWithGoogleEngine(req.query.search);

		res.jsend.success({
			name: pkgConfig.APP_NAME,
			version: pkgConfig.APP_VERSION,
			timestamp: new Date().toISOString(),
			serp_response: serpResponse
		});
	} catch (error) {
		next(error);
	}
};
