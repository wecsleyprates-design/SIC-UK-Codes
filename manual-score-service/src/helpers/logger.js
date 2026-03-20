import pino from "pino";
import pinoHttp from "pino-http";
import pretty from "pino-pretty";
import { envConfig } from "#configs/index";
import { LOG_LEVELS, ENVIRONMENTS } from "#constants/index";

const level = envConfig.ENV === ENVIRONMENTS.PRODUCTION ? envConfig.LOG_LEVEL ?? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

const createStream = () => {
	return pretty({
		colorize: true,
		levelFirst: true, // --levelFirst: display the log level name before the logged date and time
		ignore: "hostname,pid,module",
		translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l"
	});
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
	envConfig.ENV === ENVIRONMENTS.DEVELOPMENT && createStream()
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
		envConfig.ENV === ENVIRONMENTS.DEVELOPMENT && createStream()
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
