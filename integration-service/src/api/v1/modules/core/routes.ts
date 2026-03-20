import { ROLES } from "#constants";
import {
	methodNotAllowed,
	validatePurgedBusiness,
	validateRole,
	validateSchema,
	validateUser
} from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";

const router = Router();

// Integration groups: GET for Admin, Customer, and Internal; Admin-only manage
router
	.route("/integration-groups")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), api.getIntegrationGroups)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.createIntegrationGroup),
		api.createIntegrationGroup
	)
	.all(methodNotAllowed);

router
	.route("/internal/integration-groups")
	.get(validateSchema(schema.getIntegrationGroups), api.getIntegrationGroups)
	.all(methodNotAllowed);

// Integration tasks: flat list of all task+platform records (Internal & Admin only)
router
	.route("/integration-tasks")
	.get(validateUser, validateRole(ROLES.ADMIN), api.getIntegrationTasks)
	.all(methodNotAllowed);

router.route("/internal/integration-tasks").get(api.getIntegrationTasks).all(methodNotAllowed);

router
	.route("/integration-groups/:id")
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.updateIntegrationGroup),
		api.updateIntegrationGroup
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.deleteIntegrationGroup),
		api.deleteIntegrationGroup
	)
	.all(methodNotAllowed);

router
	.route("/integration-groups/:id/integrations")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.addIntegrationToGroup),
		api.addIntegrationToGroup
	)
	.all(methodNotAllowed);

router
	.route("/integration-groups/:id/integrations/:integrationTaskId")
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.removeIntegrationFromGroup),
		api.removeIntegrationFromGroup
	)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/integrations/:caseID?")
	.get(validateSchema(schema.getConnectedIntegrations), validatePurgedBusiness, api.internalGetConnectedIntegrations)
	.all(methodNotAllowed);
router.route("/internal/businesses/metadata").get(validatePurgedBusiness, api.businessMetadata).all(methodNotAllowed);
router
	.route("/businesses/:businessID/integrations")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.getConnectedIntegrations),
		validatePurgedBusiness,
		api.getConnectedIntegrations
	)
	.all(methodNotAllowed);

router
	.route("/connection-status")
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.updateConnectionStatusToSuccess),
		validatePurgedBusiness,
		api.updateConnectionStatusToSuccess
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/integrations/populate-business-details")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.populateBusinessDetails),
		validatePurgedBusiness,
		api.populateBusinessDetails
	)
	.all(methodNotAllowed);
router
	.route("/internal/businesses/:businessID/integrations/populate-business-details")
	.post(validateSchema(schema.populateBusinessDetails), validatePurgedBusiness, api.populateBusinessDetails)
	.all(methodNotAllowed);

router
	.route("/internal/business/:businessID/case/:caseID/customer/:customerID/verifications")
	.get(validateSchema(schema.getCaseVerifications), validatePurgedBusiness, api.getCaseVerifications)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/integrations-metadata")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.getIntegrationsMetadata),
		validatePurgedBusiness,
		api.getIntegrationsMetadata
	);

router
	.route("/businesses/:businessID/integrations/rerun")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.rerunIntegrations),
		api.rerunIntegrations
	)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/synchronous-state-update")
	.post(api.synchronousStateUpdate)
	.all(methodNotAllowed);

router
	.route("/test/required-tasks/:businessID/:customerID?")
	.get(validateUser, validateRole(ROLES.ADMIN), api.testGetAllRequiredTasks)
	.all(methodNotAllowed);

export default router;
