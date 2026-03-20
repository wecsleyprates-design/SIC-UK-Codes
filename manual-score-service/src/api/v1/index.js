import { Router } from "express";
import scoreRoutes from "./modules/score/routes";

const router = new Router();

router.get("/", (req, res) => {
	res.jsend.success("Hello v1 API");
});

router.use(scoreRoutes);

export default router;
