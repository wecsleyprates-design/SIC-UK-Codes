import { ROLES } from "#constants/index";
import {
	methodNotAllowed,
	validateDataPermission,
	validateRole,
	validateSchema,
	validateUser,
	validatePurgedBusiness
} from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";

/** @type Router */
const router = Router();

router
	.route("/customers/:customerID/applicant-config/:coreConfigID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCustomerApplicantConfig),
		api.getCustomerApplicantConfig
	)
	.put(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateCustomerApplicantConfig),
		api.updateCustomerApplicantConfig
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateCustomerApplicantStatus),
		api.updateCustomerApplicantStatus
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/applicant-config/:coreConfigID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getBusinessApplicantConfig),
		validatePurgedBusiness,
		api.getBusinessApplicantConfig
	)
	.put(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateBusinessApplicantConfig),
		validatePurgedBusiness,
		api.updateBusinessApplicantConfig
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateBusinessApplicantStatus),
		validatePurgedBusiness,
		api.updateBusinessApplicantStatus
	)
	.all(methodNotAllowed);


module.exports = router;
