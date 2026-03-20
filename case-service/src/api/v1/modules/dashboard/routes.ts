import { Router } from "express";
const router = Router();
import { methodNotAllowed, validateRole, validateSchema, validateDataPermission, validateUser } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants/roles.constant";

router.route("/customers/:customerID/dashboard/decision-stats").get(validateUser, validateRole(ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.getDecisionStats), api.getDecisionStats).all(methodNotAllowed);
router.route("/customers/:customerID/dashboard/businesses/score-stats").get(validateUser, validateRole(ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.getBusinessScoreRangeStats), api.getBusinessScoreRangeStats).all(methodNotAllowed);
router.route("/customers/:customerID/dashboard/portfolio").get(validateUser, validateRole(ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.getCustomerPortfolio), api.getCustomerPortfolio).all(methodNotAllowed);
router.route("/customers/:customerID/dashboard/average-score-stats").get(validateUser, validateRole(ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.averageScoreStats), api.averageScoreStats).all(methodNotAllowed);
router.route("/customers/:customerID/dashboard/industry-exposure").get(validateUser, validateRole(ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.industryExposure), api.industryExposure).all(methodNotAllowed);
router.route("/customers/:customerID/dashboard/total-application-stats").get(validateUser, validateRole(ROLES.CUSTOMER, ROLES.ADMIN), validateDataPermission, validateSchema(schema.totalApplicaitons), api.totalApplications).all(methodNotAllowed);

router.route("/customers/:customerID/dashboard/applications/stats/received-approved").get(validateUser, validateRole(ROLES.CUSTOMER, ROLES.ADMIN), validateDataPermission, validateSchema(schema.applicationReceivedApprovedStats), api.applicationReceivedApprovedStats).all(methodNotAllowed);

router.route("/customers/:customerID/dashboard/team-performance/stats").get(validateUser, validateRole(ROLES.CUSTOMER, ROLES.ADMIN), validateDataPermission, validateSchema(schema.teamPerformanceStats), api.teamPerformanceStats).all(methodNotAllowed);
router.route("/customers/:customerID/dashboard/time-to-approval").get(validateUser, validateRole(ROLES.CUSTOMER, ROLES.ADMIN), validateDataPermission, validateSchema(schema.timeToApproval), api.timeToApproval).all(methodNotAllowed);
router.route("/customers/:customerID/dashboard/pipeline/stats").get(validateUser, validateRole(ROLES.CUSTOMER, ROLES.ADMIN), validateDataPermission, validateSchema(schema.pipelineStats), api.pipelineStats).all(methodNotAllowed);
module.exports = router;
