import { Router } from "express";
import progressionRoutes from "./modules/progression/routes";

const router = new Router();

router.use(progressionRoutes);

export default router;
