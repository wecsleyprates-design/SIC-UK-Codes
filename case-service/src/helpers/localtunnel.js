const localtunnel = require("localtunnel");

export const createTunnel = async (config, logger) => {
	const tunnel = await localtunnel(config);

	tunnel.on("error", () => {
		logger.error("error occured in tunnel");
	});

	tunnel.on("close", () => {
		logger.info("tunnel closed");
	});
	return tunnel;
};
