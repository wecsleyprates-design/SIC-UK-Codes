// MUST BE THE FIRST IMPORT - DO NOT MOVE - Initialize Datadog tracer
import '@joinworth/worth-core-service';

import { enableEventLoopMonitor, reportEventLoopBlock } from "@joinworth/worth-core-service";
import { envConfig } from "#configs/index";
import { connectDb, createTunnel, getConsumer, initializeLDClient, logger, redisConfig, redisConnect } from "#helpers/index";
import { IncomingMessage, Server, ServerResponse } from "http";
import { app } from "./app";
import { initKafkaHandler } from "./messaging";
import { initWorkers } from "./workers";
import { SERVICE_MODES, VALID_WORKER_TYPES, WORKER_TYPES } from "#constants";
import { TimeoutMonitorService } from "./services/timeoutMonitorService";

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
	await initializeLDClient();
	redisConnect(redisConfig, logger);

	const bootHandler: Record<string, () => Promise<void>> = {
		[SERVICE_MODES.WORKER]: initWorker,
		[SERVICE_MODES.API]: initAPI,
		[SERVICE_MODES.JOB]: initJob
	};
	const serviceMode: string | undefined = envConfig.SERVICE_MODE;
	if (!serviceMode || !bootHandler[serviceMode] || typeof bootHandler[serviceMode] !== "function") {
		// Do all service modes
		if (serviceMode == null) {
			logger.warn(`⚠️ No service mode specified, doing all service modes!`);
		} else {
			logger.warn(`⚠️ Invalid service mode specified (${serviceMode}): doing all service modes!`);
		}
		for (const handler of Object.values(bootHandler)) {
			await handler();
		}
	} else {
		await bootHandler[serviceMode]();
	}
};

const initAPI = async () => {
	logger.info("✅ Booting in API Mode!");
	// Initialize timeout monitor service

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
	const workerType = envConfig.WORKER_TYPE;

	if (workerType && !VALID_WORKER_TYPES.includes(workerType)) {
		logger.fatal(
			{ workerType, validValues: VALID_WORKER_TYPES },
			`Invalid WORKER_TYPE. Must be one of: ${VALID_WORKER_TYPES.join(", ")}`
		);
		process.exit(1);
	}

	if (isHealthCheckMode) {
		logger.info("✅ Booting in background worker mode (health-check mode - verifying connectivity only)!");
	} else {
		logger.info(
			{ workerType: workerType || "all" },
			"✅ Booting in background worker mode!"
		);
	}

	// Kafka: run when legacy (no WORKER_TYPE) or WORKER_TYPE=kafka
	const runKafka = !workerType || workerType === WORKER_TYPES.KAFKA;
	if (runKafka) {
		await initKafkaHandler(isHealthCheckMode);
	}

	// Bull workers: run when legacy or WORKER_TYPE=critical or WORKER_TYPE=general
	// When workerType is unset (e.g. local dev), runBull and runKafka are both true → everything runs
	const runBull = !workerType || workerType === WORKER_TYPES.CRITICAL || workerType === WORKER_TYPES.GENERAL;
	if (!isHealthCheckMode && runBull) {
		await initWorkers();
		await TimeoutMonitorService.initialize();
	} else if (isHealthCheckMode) {
		logger.info("Skipping workers initialization (health-check mode)");
	}
};

const initJob = async () => {
	logger.info("✅ Booting in job mode!");
	// Job mode: specify job-specific configuration here
	// No API, no Kafka, no Bull queues
};

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
	if (isShuttingDown) return;
	isShuttingDown = true;

	logger.info({ signal }, "Starting graceful shutdown");

	// 1. Disconnect Kafka consumer FIRST — sends LeaveGroup to coordinator
	try {
		const consumerInstance = getConsumer();
		if (consumerInstance) {
			logger.info("Disconnecting Kafka consumer...");
			await consumerInstance.disconnect();
			logger.info("Kafka consumer disconnected cleanly");
		}
	} catch (err) {
		logger.error({ err }, "Error disconnecting Kafka consumer");
	}

	// 2. Close HTTP server (stop accepting new requests)
	if (server) {
		server.close(() => {
			logger.info("Server closed");
			process.exit(0);
		});
		// Force exit if server doesn't close within 10s
		setTimeout(() => {
			logger.warn("Server close timed out, forcing exit");
			process.exit(1);
		}, 10000);
	} else {
		process.exit(0);
	}
};

const unexpectedErrorHandler = async (error: unknown) => {
	const err = error instanceof Error ? error : new Error(String(error));
	logger.fatal({ err }, "unexpectedErrorHandler");

	// Attempt graceful consumer disconnect even on unexpected errors
	try {
		const consumerInstance = getConsumer();
		if (consumerInstance) {
			await Promise.race([
				consumerInstance.disconnect(),
				new Promise<void>(resolve => setTimeout(resolve, 5000)) // 5s max wait
			]);
		}
	} catch (disconnectErr) {
		logger.error({ err: disconnectErr }, "Failed to disconnect consumer during crash");
	}

	process.exit(1);
};

process.on("uncaughtException", (err: unknown) => {
	void unexpectedErrorHandler(err);
});
process.on("unhandledRejection", (reason: unknown) => {
	void unexpectedErrorHandler(reason);
});

process.on("SIGTERM", () => {
	void gracefulShutdown("SIGTERM");
});
process.on("SIGINT", () => {
	void gracefulShutdown("SIGINT");
});

init();
