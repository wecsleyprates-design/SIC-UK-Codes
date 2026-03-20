import pino from "pino";
import pinoHttp from "pino-http";
import pretty from "pino-pretty";
import { envConfig } from "#configs/index";
import { LOG_LEVELS, ENVIRONMENTS } from "#constants/index";

const level = envConfig.ENV === ENVIRONMENTS.PRODUCTION ? (envConfig.LOG_LEVEL ?? LOG_LEVELS.INFO) : LOG_LEVELS.DEBUG;
const isProduction = envConfig.ENV === ENVIRONMENTS.PRODUCTION;

const createDevStream = () => {
	return pretty({
		colorize: true,
		levelFirst: true,
		ignore: "hostname,pid,module",
		translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l"
	});
};

const createProdStream = () => {
	// Output to stdout for Datadog collection
	// Datadog agent collects logs from stdout/stderr, not from files
	return process.stdout;
};

export const logger = pino(
	{
		name: "server",
		level,
		formatters: {
			level(label) {
				return { level: label };
			}
		}
	},
	isProduction ? createProdStream() : createDevStream()
);

export const pinoHttpLogger = pinoHttp({
	logger: pino(
		{
			name: "express",
			formatters: {
				level(label) {
					return { level: label };
				}
			}
		},
		isProduction ? createProdStream() : createDevStream()
	),
	customLogLevel: (req, res, err) => {
		if (res.statusCode >= 400 && res.statusCode < 500) {
			return "warn";
		} else if (res.statusCode >= 500 || err) {
			return "error";
		}
		return "silent";
	},
	serializers: {
		res: res => ({
			status: res.statusCode
		}),
		req: req => ({
			method: req.method,
			url: req.url
		})
	},
	redact: {
		paths: ["req.headers.authorization", "req.headers.cookie"],
		censor: "*** (masked value)"
	}
});
