import { envConfig } from "#configs/index";
import { ENVIRONMENTS } from "#constants";
import { logger } from "../logger";
import { kafkaClient } from "./kafka";

/**
 * Ensures that all required Kafka topics exist in the cluster.
 *
 * Behavior:
 * - In DEVELOPMENT: automatically creates any missing topics (idempotent).
 * - In NON-DEVELOPMENT (e.g., staging/production): throws an error if topics are missing,
 *   so that misconfiguration or infra issues are caught early at startup.
 *
 * @param topics - Array of Kafka topic names that must exist.
 * @throws Error if required topics are missing in non-development environments.
 *
 * Example usage:
 * ```ts
 * await confirmKafkaTopicsExist(["user-events", "order-events"]);
 * ```
 */
export const confirmKafkaTopicsExist = async (topics: string[]) => {
	const admin = kafkaClient.admin();

	try {
		// Establish a short-lived admin connection
		await admin.connect();

		// Retrieve all topic names currently registered in the cluster
		const existing = await admin.listTopics();

		// Identify which required topics are missing
		const missing = topics.filter(t => !existing.includes(t));

		// Determine whether we are in development mode
		const isDev = envConfig.ENV === ENVIRONMENTS.DEVELOPMENT;

		if (missing.length > 0) {
			if (isDev) {
				// Development: create only the missing topics (idempotent — safe to call multiple times)
				await admin.createTopics({
					topics: missing.map(topic => ({
						topic,
						numPartitions: 1,
						replicationFactor: 1
					})),
					waitForLeaders: true // ensure leader election before proceeding
				});

				// Log each topic creation explicitly for better observability
				missing.forEach(topic => {
					logger.info(`Created Kafka topic: ${topic}`);
				});
			} else {
				// Non-development: fail fast so infra/config problems are surfaced early
				throw new Error(`Missing required Kafka topics: ${missing.join(", ")}`);
			}
		} else {
			// All required topics are present → nothing to do
			logger.debug("All required Kafka topics exist");
		}

		// Normal completion (return is optional here but explicit for clarity)
	} catch (err) {
		// Log error context and propagate upwards to caller
		logger.error(err as Error, "confirmKafkaTopicsExist failed");
		throw err;
	} finally {
		// Always clean up connection.
		// If disconnect itself fails, log a warning instead of throwing,
		// so that the original error (if any) isn't masked.
		await admin.disconnect().catch(err => {
			logger.warn(err as Error, "Kafka admin disconnect failed");
		});
	}
};
