import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import useragent from "express-useragent";

import { pinoHttpLogger } from "#helpers/index";
import { errorMiddleware } from "#middlewares/index";
import { jsend } from "#utils/index";
import apiRoutes from "./api";
import { envConfig } from "#configs";

const corsOptions = {
	origin: [/^https:\/\/[a-zA-Z0-9-]+(?:\.dev|\.staging|\.qa[1-5]?)?\.joinworth\.com$/u, ...(envConfig.FRONTEND_LOCAL_BASE_URLS ?? "").split(",")],
	credentials: true
};

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "20MB" }));
app.use(jsend());
app.use(express.urlencoded({ extended: false, limit: "50MB" }));
app.use(cookieParser());
app.use(pinoHttpLogger);
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.static(path.join(__dirname, "..", ".data")));
app.use(express.static(path.join(__dirname, "..", "logs")));
app.use(useragent.express());
app.use((req, _res, next) => {
	req.useragent = {
		browser: req.useragent.browser,
		version: req.useragent.version,
		os: req.useragent.os,
		platform: req.useragent.platform,
		source: req.useragent.source
	};
	next();
});

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.use("/api", apiRoutes);
app.use("/", (_req, res) => {
	res.json({ info: "Score service api server. Please visit health route for more information." });
});

app.use((err, req, res, next) => {
	errorMiddleware(err, req, res, next);
});

export { app };
