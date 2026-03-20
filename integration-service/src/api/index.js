import { Router } from "express";
import { routeNotFound } from "#middlewares/index";
import { getHealth } from "./health";
import v1Routes from "./v1";

const router = new Router();

router.get("/health", getHealth);
router.use("/v1", v1Routes);
router.all("*", routeNotFound);

export default router;
