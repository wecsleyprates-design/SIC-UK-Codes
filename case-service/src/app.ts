import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";
import express from "express";
import { express as useragentMiddleware, type AgentDetails } from "express-useragent";
import helmet from "helmet";
import path from "path";
import { envConfig } from "#configs/index";
import { pinoHttpLogger } from "#helpers/index";
import { errorMiddleware } from "#middlewares/index";
import { jsend } from "#utils/index";
import apiRoutes from "./api";
import { controller as subscriptionsApi } from "./api/v1/modules/subscriptions/controller";
import qs from "qs";

const corsOptions: CorsOptions = {
	origin: [
		/^https:\/\/[a-zA-Z0-9-]+(?:\.dev|\.staging|\.qa[1-5]?)?\.joinworth\.com$/u,
		...(envConfig.FRONTEND_LOCAL_BASE_URLS ?? "").split(",")
	],
	credentials: true
};

const app = express();

app.set("query parser", (str: string) => qs.parse(str));

app.use(helmet());
app.use(cors(corsOptions));
app.use(jsend());

// this should be above expresss.json
app.post(
	"/api/v1/stripe/webhook/subscriptions",
	express.raw({ type: "application/json" }),
	subscriptionsApi.stripeWebhookSubscriptions
);

app.use(express.text({ type: "text/*" }));
app.use(express.json({ limit: "20MB" }));
app.use(express.urlencoded({ extended: false, limit: "50MB" }));
app.use(cookieParser());
app.use(pinoHttpLogger);
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.static(path.join(__dirname, "..", ".data")));
app.use(express.static(path.join(__dirname, "..", "logs")));

app.use(useragentMiddleware());
app.use((req, _res, next) => {
	if (req.useragent !== null && req.useragent !== undefined) {
		req.useragent = {
			browser: req.useragent.browser,
			version: req.useragent.version,
			os: req.useragent.os,
			platform: req.useragent.platform,
			source: req.useragent.source
		} as AgentDetails;
	}
	next();
});

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.use("/api", apiRoutes);
app.use("/", (_req, res) => {
	res.json({ info: "Worth AI api server. Please visit health route for more information." });
});

app.use(((err, req, res, next) => {
	errorMiddleware(err, req, res, next);
}) as express.ErrorRequestHandler);

export { app };
