import { Router } from "express";
import {
	methodNotAllowed,
	validateDataPermission,
	validateRole,
	validateSchema,
	validateUser
} from "#middlewares/index";
import { validatePermissions } from "#middlewares/permission.middleware";
import { validatePurgedBusiness } from "#middlewares/purgedBusiness.middleware";
import { ROLES } from "#constants";
import { controller } from "./controller";
import { schema } from "./schemas";

const router = Router();

// Idempotent preseed: templates, categories, buckets, risk alerts (only when customer has none). Scoped under risk-monitoring.
router
	.route("/customers/:customerID/risk-monitoring/init")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.initCustomer),
		controller.initCustomer
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/risk-monitoring/run")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.runRefresh),
		controller.runRefresh
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/monitoring-templates")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.listTemplates),
		controller.listTemplates
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.createTemplate),
		controller.createTemplate
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/monitoring-templates/:templateID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getTemplate),
		controller.getTemplate
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.updateTemplate),
		controller.updateTemplate
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.deleteTemplate),
		controller.deleteTemplate
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/businesses/:businessID/monitoring-template")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getBusinessTemplate),
		validatePurgedBusiness,
		controller.getBusinessTemplate
	)
	.put(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.setBusinessTemplate),
		validatePurgedBusiness,
		controller.setBusinessTemplate
	)
	.all(methodNotAllowed);

// Risk categories (per customer)
router
	.route("/customers/:customerID/risk-categories")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.listRiskCategories),
		controller.listRiskCategories
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.createRiskCategory),
		controller.createRiskCategory
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/risk-categories/:categoryID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getRiskCategory),
		controller.getRiskCategory
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.updateRiskCategory),
		controller.updateRiskCategory
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.deleteRiskCategory),
		controller.deleteRiskCategory
	)
	.all(methodNotAllowed);

// Risk buckets (per customer)
router
	.route("/customers/:customerID/risk-buckets")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.listRiskBuckets),
		controller.listRiskBuckets
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.createRiskBucket),
		controller.createRiskBucket
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/risk-buckets/:bucketID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getRiskBucket),
		controller.getRiskBucket
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.updateRiskBucket),
		controller.updateRiskBucket
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.deleteRiskBucket),
		controller.deleteRiskBucket
	)
	.all(methodNotAllowed);

// Risk alerts (per customer)
router
	.route("/customers/:customerID/risk-alerts")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.listRiskAlerts),
		controller.listRiskAlerts
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.createRiskAlert),
		controller.createRiskAlert
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/risk-alerts/:alertID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getRiskAlert),
		controller.getRiskAlert
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.updateRiskAlert),
		controller.updateRiskAlert
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.deleteRiskAlert),
		controller.deleteRiskAlert
	)
	.all(methodNotAllowed);

export default router;
