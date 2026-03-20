import { envConfig } from "#configs/index";
import knex from "knex";
import { logger } from "./logger";

const db = knex({
	client: "pg",
	connection: {
		host: envConfig.DB_HOST,
		port: parseInt(envConfig.DB_PORT ?? "5432"),
		user: envConfig.DB_USER,
		password: envConfig.DB_PASSWORD,
		database: envConfig.DB_NAME,
		idle_in_transaction_session_timeout: 30000,
		connectionTimeout: 0,
		debug: envConfig.ENV === "production" ? false : true,
		ssl: envConfig.ENV === "production" ? { rejectUnauthorized: false } : false
	},
	pool: {
		max: parseInt(envConfig.DB_MAX_CONNECTIONS ?? "10")
	},
	searchPath: ["public"]
});

db.on("query", ({ sql, bindings }) => {
	logger.debug(`SQL: ${sql} | data: ${JSON.stringify(bindings)}`);
});

export { db };
