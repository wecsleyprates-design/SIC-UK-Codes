import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";
import express from "express";
import useragent from "express-useragent";
import helmet from "helmet";
import path from "path";

import { envConfig } from "#configs/index";
import { pinoHttpLogger } from "#helpers/index";
import { errorMiddleware } from "#middlewares/index";
import { jsend } from "#utils/index";
import apiRoutes from "./api/index";

import { verifyWebhookSignature } from "#lib/middesk";
import { verifyTruliooWebhookSignature } from "#lib/trulioo";
import { verifyStripeWebhook } from "#middlewares/stripe.middleware";

const corsOptions: CorsOptions = {
	origin: [
		/^https:\/\/[a-zA-Z0-9-]+(?:\.dev|\.staging|\.qa[1-5]?)?\.joinworth\.com$/u,
		...(envConfig.FRONTEND_LOCAL_BASE_URLS ?? "").split(",")
	],
	credentials: true
};

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(jsend());
app.use((req, res, next) => {
	/**
	 * If the request is for verification webhook routes, we need to verify the signature
	 * before parsing the body. This is because if any other middleware parses the body, the webhook signature
	 * verification won't have access to the raw body because the request stream can only be consumed once
	 */
	const path = req.path?.toLowerCase().replace(/\/$/, "");
	if (path === "/api/v1/verification/businesses/webhook") {
		return verifyWebhookSignature(req, res, next);
	}
	if (path === "/api/v1/verification/international-businesses/webhook") {
		return verifyTruliooWebhookSignature(req, res, next);
	}
	if (path === "/api/v1/verification/international-businesses/person/webhook") {
		return verifyTruliooWebhookSignature(req, res, next);
	}
	if (req.path?.startsWith("/api/v1/payment-processors/webhook/stripe/")) {
		return verifyStripeWebhook(req, res, next);
	}
	// For any other path, just continue to the next middleware
	next();
});
app.use(express.text({ limit: "20MB", type: "text/*" }));
app.use(express.json({ limit: "20MB" }));
app.use(express.urlencoded({ extended: false, limit: "50MB" }));
app.use(cookieParser());
app.use(pinoHttpLogger);
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.static(path.join(__dirname, "..", ".data")));
app.use(express.static(path.join(__dirname, "..", "logs")));
app.use(useragent.express());
app.use((req, _res, next) => {
	if (req.useragent) {
		(req.useragent as Partial<useragent.Details>) = {
			browser: req.useragent.browser,
			version: req.useragent.version,
			os: req.useragent.os,
			platform: req.useragent.platform,
			source: req.useragent.source
		};
	}
	next();
});

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.use("/api", apiRoutes);
app.use("/", (_req, res) => {
	res.json({
		info: "Worth AI api server. Please visit health route for more information."
	});
});

app.use(((err, req, res, next) => {
	errorMiddleware(err, req, res);
}) as express.ErrorRequestHandler);

export { app };
