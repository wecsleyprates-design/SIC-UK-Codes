import Redis, {
	type ScanStream,
	type Redis as IRedis,
	type Cluster,
	type RedisKey,
	type RedisValue,
	type ClusterNode
} from "ioredis";
import { envConfig } from "#configs/index";
import { Logger } from "pino";
import { ClusterOptions } from "ioredis";
import { logger } from "./logger";
const REDIS_READY_STATUS = "ready";

let client: Redis | Cluster;
const TTL = 300;

interface RedisConfig {
	ecClusterMode: boolean;
	conn: {
		url: string;
		host: string;
		port: string;
		password: string;
		disableTLS: boolean;
		rejectUnauthorized: boolean;
	};
	reconnectMaxWait: number;
}

// Connection parameters for the Redis instance which handles caching.
export const redisConfig: RedisConfig = {
	// Connect to Elasticache using ioRedis cluster mode. Use this if EC is responding with
	// "MOVED" errors.
	ecClusterMode: envConfig.REDIS_EC_CLUSTER,
	// Cache Redis connection credentials
	conn: {
		url: envConfig.REDIS_URL ?? "",
		host: envConfig.REDIS_HOST ?? "",
		port: envConfig.REDIS_PORT ?? "",
		password: envConfig.REDIS_PASSWORD ?? "",
		disableTLS: envConfig.REDIS_DISABLE_TLS,
		rejectUnauthorized: !Boolean(envConfig.REDIS_DISABLE_TLS_REJECT_UNAUTHORIZED)
	},
	// Max milliseconds to wait between reconnection attempts
	reconnectMaxWait: envConfig.REDIS_RECONNECT_MAX_WAIT || 2000
};
const getReconnectMaxWait = (config: RedisConfig): number => config.reconnectMaxWait || 2000;

const createClient = (config: RedisConfig, logger: Logger) => {
	const { conn } = config;
	const reconnectMaxWait = getReconnectMaxWait(config);
	const options: Record<string, any> = {
		retryStrategy(times: number) {
			logger.warn("Lost Redis connection, reattempting");
			return Math.min(times * 2, reconnectMaxWait);
		},
		// eslint-disable-next-line consistent-return
		reconnectOnError(err: any) {
			logger.error(err);
			const targetError = "READONLY";
			if (err.message.slice(0, targetError.length) === "READONLY") {
				// When a slave is promoted, we might get temporary errors saying
				// READONLY You can't write against a read only slave. Attempt to
				// reconnect if this happens.
				logger.warn("ElastiCache returned a READONLY error, reconnecting");
				return 2; // `1` means reconnect, `2` means reconnect and resend
				// the failed command
			}
		}
	};

	const keyPrefix = envConfig.REDIS_KEY_PREFIX || undefined;

	if (conn.url) {
		return new Redis(conn.url, { ...options, keyPrefix });
	}

	if (conn.password) {
		options.password = conn.password;
	}

	if (conn.disableTLS === true) {
		logger.warn("Connecting to Redis insecurely");
	} else {
		options.tls = {};
		const { rejectUnauthorized: ru } = conn;
		if (typeof ru === "boolean") {
			if (!ru) {
				logger.warn(
					"Skipping Redis CA validation. Consider changing to a hostname that matches the certificate's names instead of disabling rejectUnauthorized."
				);
			}
			options.tls.rejectUnauthorized = ru;
		}
	}

	if (config.ecClusterMode) {
		return new Redis.Cluster([`//${conn.host}:${conn.port}`], {
			scaleReads: "slave",
			keyPrefix,
			redisOptions: {
				...options
			}
		});
	}
	return new Redis(parseInt(conn.port), conn.host, { ...options, keyPrefix });
};

// Type guard to check if the client is a Cluster (otherwise it's an IRedis instance)
export function isCluster(client: Redis | Cluster): client is Cluster {
	return "nodes" in client && typeof (client as any).nodes === "function";
}

export const redisConnect = (config: RedisConfig, logger: Logger) => {
	client = createClient(config, logger);
	client.on("connect", () =>
		logger.info(
			{
				clusterMode: config.ecClusterMode ? "YES" : "NO",
				method: config.conn.url ? "URL connection string" : "host + port",
				password: config.conn.password ? "YES" : "NO",
				reconnectMaxWait: getReconnectMaxWait(config)
			},
			"Connecting to Redis..."
		)
	);
	client.on("ready", () => logger.info("Redis is ready"));
	client.on("error", err => logger.error(err));
	client.on("close", () => logger.warn("Redis connection closed"));
	client.on("reconnecting", (ms: number) => logger.info(`Reconnecting to Redis in ${ms}ms`));
	client.on("end", () => logger.warn("Redis connection ended"));
	return client;
};

export const isHealthy = () => {
	if (client.status === REDIS_READY_STATUS) {
		return client.ping();
	}
	return Promise.reject(Error(`Bad Redis status: ${client.status}`));
};

export const quitGracefully = () => {
	if (typeof client.quit === "function") {
		// Instance is a cluster connection that can be gracefully quit
		return client.quit();
	}
	if (typeof client.disconnect === "function") {
		// Instance is a non-clustered client
		client.disconnect();
		return Promise.resolve();
	}
	return Promise.reject(new Error("Cannot disconnect invalid Redis client instance"));
};

export const redis = {
	get: async <T = RedisValue>(key: RedisKey): Promise<T | null> => {
		const result = await client.get(key);
		try {
			return JSON.parse(result ?? "");
		} catch {
			return result as T;
		}
	},
	set: async <T extends string | number | object = string | number | object>(
		key: string,
		value: T
	): Promise<boolean> => {
		if (typeof value === "object") {
			await client.set(key, JSON.stringify(value));
		} else {
			await client.set(key, value);
		}
		return true;
	},
	/**
	 *
	 * @param key key to set
	 * @param value value to set
	 * @param ttl time to live in seconds
	 * @returns true if the value is set
	 */
	setex: async <T extends string | number | object = string | object>(
		key: string,
		value: T,
		ttl: number = 60
	): Promise<boolean> => {
		if (typeof value === "object") {
			await client.setex(key, ttl, JSON.stringify(value));
		} else {
			await client.setex(key, ttl, value);
		}
		return true;
	},
	hget: async <T extends object | string = object | string>(key: string, field: string): Promise<T | string | null> => {
		const result = await client.hget(key, field);
		try {
			return JSON.parse(result ?? "");
		} catch {
			return result;
		}
	},
	hmget: async (key: string, fields: (string | Buffer)[]): Promise<(string | null)[] | object[]> => {
		const result = await client.hmget(key, ...fields);
		try {
			return result.map(val => (val ? JSON.parse(val) : null));
		} catch {
			return result;
		}
	},
	/**
	 *  Increment a hash field by a given value */
	hincrby: async <T extends object | string = object | string>(
		key: string,
		field: keyof T,
		value: number = 1
	): Promise<number> => {
		return await client.hincrby(key, field as string, value);
	},
	/**
	 * Set a hash field to a value
	 * @param key: redis key of the hash
	 * @param record: A Record of key-value pairs
	 * @returns
	 */
	hset: async <T extends Record<string, any> = Record<string, any>>(key: string, record: T): Promise<void> => {
		// Is this a flat record of key-value pairs?
		const fields = Object.entries(record).map(([key, value]) => [key, JSON.stringify(value)]);
		await client.hset(key, ...fields.flat());
	},

	hgetall: async <T = Record<string, string | object>>(rediskey: RedisKey): Promise<T> => {
		let result = await client.hgetall(rediskey);
		result = Object.keys(result).reduce((acc, key) => {
			if (typeof result[key] === "string") {
				try {
					acc[key] = JSON.parse(result[key]);
				} catch {
					acc[key] = result[key];
				}
			} else {
				acc[key] = result[key];
			}
			return acc;
		}, {});

		return result as T;
	},

	exists: async (key: RedisKey): Promise<boolean> => {
		const result = await client.exists(key);
		return !!result;
	},

	/**
	 * Set the expiration time for a key
	 * @param key key to set the expiration time for
	 * @param seconds expiration time in seconds
	 * @returns true if the expiration time is set
	 */
	expire: async (key: RedisKey, seconds: number = TTL): Promise<boolean> => {
		await client.expire(key, seconds);
		return true;
	},

	delete: async (key: RedisKey): Promise<boolean> => {
		await client.del(key);
		return true;
	},
	// data is an array of key-value pairs [ key, JSON.stringify(value), key, JSON.stringify(value), ...]
	mset: async (data: [string, string][]) => {
		try {
			if (!Array.isArray(data)) {
				throw new Error("Data must be an array");
			}
			if (!data.length) {
				return;
			}
			const convertedData: (number | RedisKey)[] = data.flat();
			await client.mset(...convertedData);
		} catch (error) {
			throw error;
		}
	},

	mget: async (keys: string[]): Promise<(string | null)[]> => {
		try {
			if (!Array.isArray(keys)) {
				throw new Error("Keys must be an array");
			}
			const result = await client.mget(...keys);
			return result;
		} catch (error) {
			throw error;
		}
	},

	deleteMultipleKeys: async (keys: string[]) => {
		try {
			if (!keys.length) {
				return;
			}
			const pipeline = client.pipeline();
			keys.forEach(key => {
				pipeline.del(key);
			});
			await pipeline.exec();
		} catch (error) {
			throw error;
		}
	},

	deleteMultiple: (pattern: string, keyCount: number) => {
		const prefix = envConfig.REDIS_KEY_PREFIX || "";
		const prefixedPattern = `${prefix}${pattern}`;
		return new Promise(resolve => {
			let stream: ScanStream;
			if (redisConfig.ecClusterMode) {
				const newClient = client as Cluster;
				const node = newClient.nodes("master");
				stream = node[0].scanStream({
					match: prefixedPattern,
					count: keyCount
				});
			} else {
				const newClient = client as IRedis;
				stream = newClient.scanStream({
					match: prefixedPattern,
					count: keyCount
				});
			}
			const pipeline = client.pipeline();
			stream.on("data", keys => {
				keys.forEach((key: RedisKey) => {
					// SCAN returns full Redis keys (already prefixed), but pipeline.del() auto-prefixes via ioredis keyPrefix — strip to avoid double-prefixing
					const unprefixedKey = prefix ? String(key).slice(prefix.length) : key;
					pipeline.del(unprefixedKey);
				});
			});
			stream.on("end", async () => {
				await pipeline.exec();
				resolve(true);
			});
		});
	},

	generateStream: (pattern: string, limit: number = 100000): ScanStream => {
		const prefix = envConfig.REDIS_KEY_PREFIX || "";
		const prefixedPattern = `${prefix}${pattern}`;
		try {
			if (isCluster(client)) {
				const node = client.nodes("master");
				return node[0].scanStream({
					match: prefixedPattern,
					count: limit
				});
			}
		} catch (error) {
			logger.debug(error, "Failed to get cluster node, falling back to non-cluster stream");
		}
		return (client as IRedis).scanStream({
			match: prefixedPattern,
			count: limit
		});
	},
	/* 
	Get hash values by key pattern
	@param pattern: pattern to match
	@param limit: limit the number of keys to return
	@returns a Record of keys and values
	*/
	getHashByPattern: async <T extends Record<string, any> = Record<string, any>>(
		pattern: string,
		limit = 100000
	): Promise<Record<string, T>> => {
		const prefix = envConfig.REDIS_KEY_PREFIX || "";
		return new Promise<Record<string, T>>(resolve => {
			const stream = redis.generateStream(pattern, limit);
			// Commands being executed
			const pipeline = client.pipeline();
			// Keys that the pipeline has found so far
			const queuedKeys: string[] = [];

			// Listen for data getting returned from the stream
			stream.on("data", keys => {
				// Streams scans into the pipeline for later execution
				keys.forEach((key: RedisKey) => {
					// SCAN returns full Redis keys (already prefixed), but pipeline.hgetall() auto-prefixes via ioredis keyPrefix — strip to avoid double-prefixing
					const unprefixedKey = prefix ? String(key).slice(prefix.length) : String(key);
					queuedKeys.push(unprefixedKey);
					pipeline["hgetall"](unprefixedKey);
				});
			});

			// Listen for stream to end and then pull the key-value pairs from the pipeline and parse the results
			stream.on("end", async () => {
				// Blocking operation to get the pending results from the pipeline
				const execResults = (await pipeline.exec()) as Array<[Error | null, any]>;
				const result: Record<string, T> = {};
				for (let i = 0; i < queuedKeys.length; i++) {
					const key = queuedKeys[i];

					// Skip if no result or the result is an error tuple
					const tuple = execResults?.[i];
					if (!tuple) continue;
					const [err, raw] = tuple;
					if (err) continue;

					const parsed: Record<string, any> = {};
					for (const field of Object.keys(raw)) {
						parsed[field] = parseResult<T[keyof T]>(raw[field]);
					}
					result[key] = parsed as T;
				}
				// Resolve the parent promise with the final result
				resolve(result);
			});
		});
	},
	/**
	 * Determine the number of keys that match a given pattern
	 * @param pattern pattern to match
	 * @returns number of keys that match the pattern
	 */
	countKeysByPattern: async (pattern: string): Promise<number> => {
		const prefix = envConfig.REDIS_KEY_PREFIX || "";
		const prefixedPattern = `${prefix}${pattern}`;
		let cursor = "0";
		let count = 0;
		do {
			const [nextCursor, keys] = await client.scan(cursor, "MATCH", prefixedPattern, "COUNT", 1000);
			count += keys.length;
			cursor = nextCursor;
		} while (cursor !== "0");
		return count;
	},

	/**
	 * @description adds a value to a redis set or creates a new set if it doesn't exist
	 * @param {*} key key of the redis set
	 * @param {*} value can be a string or an array of strings
	 * @returns {Promise<boolean>} true if the value is added to the set
	 */
	sadd: async (key: string, value: string | string[]): Promise<boolean> => {
		let newValues = typeof value === "string" ? [value] : value;
		await client.sadd(key, newValues);
		return true;
	},
	/**
	 * Remove value(s) from a set
	 * @param key key of the redis set
	 * @param value value to remove from the set
	 * @returns true if the value is removed from the set
	 */
	srem: async (key: string, value: string | string[]): Promise<boolean> => {
		let newValues = typeof value === "string" ? [value] : value;
		await client.srem(key, newValues);
		return true;
	},
	spop: async (key: string, count: number | string = 1): Promise<string[] | null> => {
		const result = await client.spop(key, count);
		return result;
	},
	sismembers: async (key: string): Promise<string[]> => {
		const result = await client.smembers(key);
		return result;
	},
	sismember: async (key: string, value: string): Promise<boolean> => {
		const result = await client.sismember(key, value);
		return !!result;
	},

	scard: async (key: string): Promise<number> => {
		const result = await client.scard(key);
		return result;
	},
	incr: async (key: string, amount: number = 1): Promise<number> => {
		return await client.incrby(key, amount);
	},
	decr: async (key: string, amount: number = 1): Promise<number> => {
		return await client.decrby(key, amount);
	}
};

/**
 * @description creates a new Redis Cluster client as of now only with a single node
 * @param conn
 * @param opts
 * @returns
 */
export const createClusterClient = (conn: ClusterNode & { TLS: boolean; password: string }, opts: ClusterOptions) => {
	const clusterClient = new Redis.Cluster([conn], {
		...opts,
		dnsLookup: (address, callback) => callback(null, address),
		redisOptions: {
			tls: {
				rejectUnauthorized: conn.TLS
			},
			password: conn.password
		}
	});

	return clusterClient;
};

/**
 * Attempt to parse a string as JSON -- if it fails return as a string
 * @param raw raw string to parse
 * @returns parsed result or raw string
 */
const parseResult = <T>(raw: string): T | string => {
	try {
		return JSON.parse(raw);
	} catch (e) {
		return raw;
	}
};
