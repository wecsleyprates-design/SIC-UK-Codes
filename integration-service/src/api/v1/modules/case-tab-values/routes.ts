import { Router } from "express";
import { validateUser, validateSchema, validatePurgedBusiness } from "#middlewares/index";
import { validateRole } from "#middlewares/role.middleware";
import { getCache, saveCacheAndSend } from "#middlewares/cache.middleware";
import { methodNotAllowed } from "#middlewares/route.middleware";
import { validateDataPermission } from "#middlewares/access.middleware";
import { ROLES } from "#constants";
import { controller as api } from "./controller";
import { schema } from "./schema";

const router = Router();

/** Single cache key per (user, businessId, caseId); no query params. Frontend filters by tab on load. */
router
	.route("/business/:businessId/case/:caseId/values")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getCaseTabValues),
		getCache(),
		validatePurgedBusiness,
		api.getCaseTabValues,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);

/** Re-run completion: call after re-run succeeds to set case_results_executions.updated_at so isRegenerated and GET /values show correctly. */
router
	.route("/business/:businessId/case/:caseId/values/acknowledge")
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.acknowledgeCaseTabValues),
		validatePurgedBusiness,
		api.acknowledgeCaseTabValues
	)
	.all(methodNotAllowed);

export default router;
