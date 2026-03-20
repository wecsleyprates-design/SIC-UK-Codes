import { Router } from "express";
import { controller as api } from "./controller";
import { validateRole, validateSchema, validateUser } from "#middlewares";
import { schema } from "./schema";
import { ROLES } from "#constants/roles.constant";

const router = Router();
router.route("/pii-prefill")
	.post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT), validateSchema(schema.kyxMatch), api.kyxMatch);
router.route("/pii-prefill/business/:businessId")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT), validateSchema(schema.getKyxMatch), api.getKYXMatch);
router.route("/pii-prefill/jobs/:jobId")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT), validateSchema(schema.getJobStatus), api.getJobStatus);
export default router;
