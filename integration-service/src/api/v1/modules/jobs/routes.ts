import { ROLES } from "#constants";
import { methodNotAllowed, paginate, validateDataPermission, validateRole, validateUser } from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
export const router = Router();

const UUID = `([0-9a-fA-F-]{36})`;

// Customer-facing Routes
router
	.route(`/jobs/request/customer/:customer_id${UUID}`)
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		api.getRequestsByCustomer,
		paginate
	)
	.all(methodNotAllowed);
router
	.route(`/jobs/request/customer/:customer_id${UUID}/:request_id${UUID}/enriched`)
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, api.getRequestEnriched)
	.all(methodNotAllowed);

// Admin-only Routes (no customer context)

router
	.route("/jobs/request")
	.post(validateUser, api.createRequest)
	.get(validateUser, validateRole(ROLES.ADMIN), api.getAll, paginate)
	.all(methodNotAllowed);
router
	.route(`/jobs/request/:request_id${UUID}/enriched`)
	.get(validateUser, validateRole(ROLES.ADMIN), api.getRequestEnriched)
	.all(methodNotAllowed);

router
	.route(`/jobs/request/:request_id${UUID}/jobs`)
	.get(validateUser, validateRole(ROLES.ADMIN), api.getJobsByRequest, paginate)
	.all(methodNotAllowed);

router
	.route(`/jobs/request/:request_id${UUID}`)
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), api.getRequest)
	.all(methodNotAllowed);

router
	.route(`/jobs/request/:request_id${UUID}/job`)
	.post(validateUser, validateRole(ROLES.ADMIN), api.createJob)
	.all(methodNotAllowed);

router
	.route(`/jobs/:job_id${UUID}/enriched`)
	.get(validateUser, validateRole(ROLES.ADMIN), api.getJobEnriched)
	.all(methodNotAllowed);

router
	.route(`/jobs/:job_id${UUID}`)
	.get(validateUser, validateRole(ROLES.ADMIN), api.getJobEnriched)
	.post(validateUser, validateRole(ROLES.ADMIN), api.executeJob)
	.patch(validateUser, validateRole(ROLES.ADMIN), api.patchJob)
	.all(methodNotAllowed);
