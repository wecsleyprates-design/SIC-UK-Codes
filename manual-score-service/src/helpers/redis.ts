import Redis, { type ScanStream, type Redis as IRedis, type Cluster, type RedisKey, type RedisValue, type ClusterNode, type ClusterOptions } from "ioredis";
import { envConfig } from "#configs";
import { type Logger } from "pino";
const REDIS_READY_STATUS = "ready";

let client: Redis | Cluster;
const TTL = "300";

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
		rejectUnauthorized: !envConfig.REDIS_DISABLE_TLS_REJECT_UNAUTHORIZED
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

	if (conn.disableTLS) {
		logger.warn("Connecting to Redis insecurely");
	} else {
		options.tls = {};
		const { rejectUnauthorized: ru } = conn;
		if (typeof ru === "boolean") {
			if (!ru) {
				logger.warn("Skipping Redis CA validation. Consider changing to a hostname that matches the certificate's names instead of disabling rejectUnauthorized.");
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

export const redisConnect = (config: RedisConfig, logger: Logger) => {
	client = createClient(config, logger);
	client.on("connect", () => {
		logger.info({
			clusterMode: config.ecClusterMode ? "YES" : "NO",
			method: config.conn.url ? "URL connection string" : "host + port",
			password: config.conn.password ? "YES" : "NO",
			reconnectMaxWait: getReconnectMaxWait(config)
		}, "Connecting to Redis...");
	});
	client.on("ready", () => {
		logger.info("Redis is ready");
	});
	client.on("error", err => {
		logger.error(err);
	});
	client.on("close", () => {
		logger.warn("Redis connection closed");
	});
	client.on("reconnecting", (ms: number) => {
		logger.info(`Reconnecting to Redis in ${ms}ms`);
	});
	client.on("end", () => {
		logger.warn("Redis connection ended");
	});
	return client;
};

export const isHealthy = async () => {
	if (client.status === REDIS_READY_STATUS) {
		const result = await client.ping();
		return result;
	}
	throw new Error(`Bad Redis status: ${client.status}`);
};

export const quitGracefully = async () => {
	if (typeof client.quit === "function") {
		// Instance is a cluster connection that can be gracefully quit
		await client.quit();
	}
	if (typeof client.disconnect === "function") {
		// Instance is a non-clustered client
		client.disconnect();
	}

	const error = new Error("Cannot disconnect invalid Redis client instance");
	throw error;
};

export const redis = {
	get: async (key: RedisKey): Promise<RedisValue | null> => {
		const result = await client.get(key);
		try {
			return JSON.parse(result ?? "");
		} catch {
			return result;
		}
	},
	jsonget: async (key: RedisKey, path: string = ".") => {
		const result = await client.call("JSON.GET", key, path);
		return result;
	},
	set: async (key: string, value: string | object): Promise<boolean> => {
		if (typeof value === "object") {
			await client.set(key, JSON.stringify(value));
		} else {
			await client.set(key, value);
		}
		return true;
	},
	jsonset: async (key: RedisKey, path: string, value: string | object) => {
		if (typeof value === "object") {
			await client.call("JSON.SET", key, path, JSON.stringify(value));
		} else {
			await client.call("JSON.SET", key, path, value);
		}
		return true;
	},
	hget: async (key: string, field: string): Promise<string | null> => {
		const result = await client.hget(key, field);
		try {
			return JSON.parse(result ?? "");
		} catch {
			return result;
		}
	},
	hmget: async (key: string, fields: Array<string | Buffer>): Promise<Array<string | null> | object[]> => {
		const result = await client.hmget(key, ...fields);
		try {
			return result.map(val => (val ? JSON.parse(val) : null));
		} catch {
			return result;
		}
	},
	hset: async (key: string, field: string, value: string | object): Promise<boolean> => {
		if (typeof value === "object") {
			await client.hset(key, field, JSON.stringify(value));
		} else if (!value && Array.isArray(field)) {
			// field is an array of key-value pairs [ key, JSON.stringify(value), key, JSON.stringify(value), ...]
			await client.hset(key, ...field);
		} else {
			await client.hset(key, field, value);
		}
		return true;
	},

	hgetall: async (rediskey: RedisKey): Promise<Record<string, string | object>> => {
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

		return result;
	},

	exists: async (key: RedisKey): Promise<boolean> => {
		const result = await client.exists(key);
		return Boolean(result);
	},

	expire: async (key: RedisKey, EX: string = TTL): Promise<boolean> => {
		await client.expire(key, EX);
		return true;
	},

	delete: async (key: RedisKey): Promise<boolean> => {
		await client.del(key);
		return true;
	},

	// data is an array of key-value pairs [ key, JSON.stringify(value), key, JSON.stringify(value), ...]
	mset: async (data: Array<[string, string]>): Promise<string | null> => {
		if (!Array.isArray(data)) {
			throw new Error("Data must be an array");
		}
		if (!data.length) {
			return null;
		}
		const convertedData: Array<number | RedisKey> = data.flat();
		const result = await client.mset(...convertedData);
		return result;
	},

	mget: async (keys: string[]): Promise<Array<string | null>> => {
		if (!Array.isArray(keys)) {
			throw new Error("Keys must be an array");
		}
		const result = await client.mget(...keys);
		return result;
	},

	deleteMultipleKeys: async (keys: string[]) => {
		if (!keys.length) {
			return;
		}
		const pipeline = client.pipeline();
		keys.forEach(key => {
			pipeline.del(key);
		});
		await pipeline.exec();
	},

	deleteMultiple: async (pattern: string, keyCount: number) => {
		const prefix = envConfig.REDIS_KEY_PREFIX || "";
		const prefixedPattern = `${prefix}${pattern}`;
		const response = await new Promise(resolve => {
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
			stream.on("end", () => {
				resolve(pipeline.exec());
			});
		});

		return response;
	},

	// limit is a key count under which the scan will stop.
	// scan will look for pattern in all keys and return the values of the keys that match the pattern
	getByPattern: async (pattern: string, limit = 100000) => {
		// eslint-disable-next-line no-return-await
		const prefix = envConfig.REDIS_KEY_PREFIX || "";
		const prefixedPattern = `${prefix}${pattern}`;
		return await new Promise(resolve => {
			const pipeline = client.pipeline();
			let stream: ScanStream;
			if (redisConfig.ecClusterMode) {
				const newClient = client as Cluster;
				const node = newClient.nodes("master");
				stream = node[0].scanStream({
					match: prefixedPattern,
					count: limit
				});
			} else {
				const newClient = client as IRedis;
				stream = newClient.scanStream({
					match: prefixedPattern,
					count: limit
				});
			}
			stream.on("data", keys => {
				keys.forEach((key: RedisKey) => {
					// SCAN returns full Redis keys (already prefixed), but pipeline.get() auto-prefixes via ioredis keyPrefix — strip to avoid double-prefixing
					const unprefixedKey = prefix ? String(key).slice(prefix.length) : key;
					pipeline.get(unprefixedKey);
				});
			});

			stream.on("end", () => {
				resolve(pipeline.exec());
			});
		});
	},

	/**
	 * @description adds a value to a redis set or creates a new set if it doesn't exist
	 * @param {*} key key of the redis set
	 * @param {*} value can be a string or an array of strings
	 * @returns {Promise<boolean>} true if the value is added to the set
	 */
	sadd: async (key: string, value: string | string[]): Promise<boolean> => {
		const newValues = typeof value === "string" ? [value] : value;
		await client.sadd(key, newValues);
		return true;
	},

	spop: async (key: string, count: number | string = 1): Promise<string[] | null> => {
		const result = await client.spop(key, count);
		return result;
	},

	sismember: async (key: string, value: string): Promise<boolean> => {
		const result = await client.sismember(key, value);
		return Boolean(result);
	},

	scard: async (key: string): Promise<number> => {
		const result = await client.scard(key);
		return result;
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
		dnsLookup: (address, callback) => {
			callback(null, address);
		},
		redisOptions: {
			tls: {
				rejectUnauthorized: conn.TLS
			},
			password: conn.password
		}
	});

	return clusterClient;
};
