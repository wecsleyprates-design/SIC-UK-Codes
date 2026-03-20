import { Router } from "express";
import { validateUser } from "#middlewares/authentication.middleware";
import { validateRole } from "#middlewares/role.middleware";
import { ROLES } from "#constants/roles.constant";
import { controller } from "./controller";
import { methodNotAllowed } from "#middlewares/route.middleware";
import { Utils, Cases } from "@joinworth/types";

const router = Router();

router
  .route("/business/:business_id/progression")
  .get(
    validateUser,
    validateRole(ROLES.APPLICANT),
    Utils.validateParams(Cases.Progression.ParamsSchema),
    Utils.validateQuery(Cases.Progression.QuerySchema),
    controller.getProgression
  )
  .all(methodNotAllowed);

export default router;
