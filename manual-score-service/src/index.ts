// MUST BE THE FIRST IMPORT - DO NOT MOVE - Initialize Datadog tracer
import '@joinworth/worth-core-service';

import { enableEventLoopMonitor, reportEventLoopBlock } from "@joinworth/worth-core-service";
import { app } from "./app";
import { envConfig } from "#configs/index";
import { type Server, type IncomingMessage, type ServerResponse } from "http";
import { logger, connectDb, createTunnel, initializeLDClient, redisConnect, redisConfig } from "#helpers/index";
import { initKafkaHandler } from "./messaging";
import { initWorkers } from "./workers/index";

let server: null | Server<typeof IncomingMessage, typeof ServerResponse>;

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

	// Always verify database connectivity
	await connectDb();

	// Kafka: connect-only in health check mode (verifies brokers/credentials without consuming)
	// Normal mode: full consumer initialization with message processing
	await initKafkaHandler(isHealthCheckMode);

	// Always connect to Redis (needed for connectivity verification)
	redisConnect(redisConfig, logger);

	// Initialize LaunchDarkly (read-only, safe in all modes)
	await initializeLDClient();

	// Skip workers in health check mode (they would process Bull queue jobs)
	if (!isHealthCheckMode) {
		initWorkers();
	} else {
		logger.info("Skipping workers initialization (health-check mode)");
	}

	server = app.listen(envConfig.APP_PORT, () => {
		logger.info(`Listening on ${envConfig.HOSTNAME} http://localhost:${envConfig.APP_PORT}`);
		if (isHealthCheckMode) {
			logger.info("Health check mode: All connections verified, service ready for health check");
		}
	});

	if (envConfig.ENV === "development") {
		const tunnel = await createTunnel({ port: envConfig.APP_PORT, subdomain: envConfig.SUBDOMAIN }, logger);
		logger.info(`The assigned public url for your tunnel is : ${tunnel.url}`);
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

void init();
