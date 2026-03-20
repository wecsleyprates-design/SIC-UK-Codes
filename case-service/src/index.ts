// MUST BE THE FIRST IMPORT - DO NOT MOVE - Initialize Datadog tracer
import '@joinworth/worth-core-service';

import { enableEventLoopMonitor, reportEventLoopBlock } from "@joinworth/worth-core-service";
import { envConfig } from "#configs";
import { createTunnel, logger, redisConfig, redisConnect, connectDb } from "#helpers";
import { app } from "./app";
import { type Server, type IncomingMessage, type ServerResponse } from "http";
import { initWorkers } from "./workers";
import { initializeLDClient } from "#helpers/LaunchDarkly";
import { initKafkaHandler } from "#messaging";
import { SERVICE_MODES } from "#constants";

let server: null | Server<typeof IncomingMessage, typeof ServerResponse> = null;

const init = async () => {
	// Initialize event loop monitoring with Datadog and pino logger
	enableEventLoopMonitor({
		thresholdMs: 20,
		logger,
		onBlock: (durationMs: number) => {
			reportEventLoopBlock(durationMs, logger);
		}
	});

	const isHealthCheckMode = envConfig.HEALTH_CHECK_MODE;

	if (isHealthCheckMode) {
		logger.info(
			"Starting in HEALTH_CHECK_MODE - verifying connectivity only, not consuming messages or processing jobs"
		);
	}

	// Shared: always verify database, Redis, and LaunchDarkly
	await connectDb();
	redisConnect(redisConfig);
	await initializeLDClient();

	const bootHandler: Record<string, () => Promise<void>> = {
		[SERVICE_MODES.API]: initAPI,
		[SERVICE_MODES.WORKER]: initWorker
	};
	const serviceMode: string | undefined = envConfig.SERVICE_MODE;
	if (!serviceMode || !bootHandler[serviceMode] || typeof bootHandler[serviceMode] !== "function") {
		if (serviceMode == null) {
			logger.warn("⚠️ No service mode specified, doing all service modes!");
		} else {
			logger.warn(`⚠️ Invalid service mode specified (${serviceMode}): doing all service modes!`);
		}
		await initAPI();
		await initWorker();
	} else {
		await bootHandler[serviceMode]();
	}
};

const initAPI = async () => {
	logger.info("✅ Booting in API Mode!");
	server = app.listen(envConfig.APP_PORT, () => {
		logger.info(`Listening on ${envConfig.HOSTNAME} http://localhost:${envConfig.APP_PORT}`);
		if (envConfig.HEALTH_CHECK_MODE) {
			logger.info("Health check mode: All connections verified, service ready for health check");
		}
	});
	if (envConfig.ENV === "development") {
		const tunnel = await createTunnel({ port: envConfig.APP_PORT, subdomain: envConfig.SUBDOMAIN }, logger);
		logger.info(`The assigned public url for your tunnel is : ${tunnel.url}`);
	}
};

const initWorker = async () => {
	const isHealthCheckMode = envConfig.HEALTH_CHECK_MODE;
	if (isHealthCheckMode) {
		logger.info("✅ Booting in worker mode (health-check mode - verifying connectivity only)!");
	} else {
		logger.info("✅ Booting in background worker mode!");
	}
	await initKafkaHandler(isHealthCheckMode);
	if (!isHealthCheckMode) {
		initWorkers();
	} else {
		logger.info("Skipping workers initialization (health-check mode)");
	}
};

const exitHandler = () => {
	if (server) {
		server.close(() => {
			logger.info("Server closed");
			process.exit(1);
		});
	} else {
		process.exit(1);
	}
};

const unexpectedErrorHandler = (error: unknown) => {
	const err = error instanceof Error ? error : new Error(String(error));
	logger.fatal({ err }, "unexpectedErrorHandler");
	exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

process.on("SIGTERM", () => {
	logger.info("SIGTERM received");
	if (server) {
		server.close();
	}
});

init();
