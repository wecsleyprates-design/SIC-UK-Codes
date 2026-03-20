import { validateUser, validateSchema, validatePurgedBusiness } from "#middlewares/index";
import { Router } from "express";
import { schema } from "./schema";
import { controller as api } from "./controllers";
import { methodNotAllowed } from "#middlewares/route.middleware";
import { validateRole } from "#middlewares/role.middleware";
import { ROLES } from "#constants";
import { validateDataPermission } from "#middlewares/access.middleware";
import { getCache, saveCacheAndSend } from "#middlewares/cache.middleware";

const router = Router();

/** Business Details Routes */
router
	.route("/facts/business/:businessID/details")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.businessIDParam),
		getCache(),
		validatePurgedBusiness,
		api.getBusinessDetails,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);
router
	.route("/facts/case/:caseID/details")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.caseIDParam),
		api.getBusinessDetailsByCase
	)
	.all(methodNotAllowed);

router
	.route("/internal/facts/business/:businessID/details")
	.get(validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getBusinessDetails, saveCacheAndSend())
	.all(methodNotAllowed);

/** KYB Routes  */
router
	.route(["/facts/business/:businessID/kyb/ca", "/facts/business/:businessID/kyb/canada"])
	.get(
		validateUser,
		validateDataPermission,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.businessIDParam),
		getCache(),
		validatePurgedBusiness,
		api.getBusinessKybDetailsCa,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);
router
	.route("/facts/business/:businessID/kyb")
	.get(
		validateUser,
		validateDataPermission,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.businessIDParam),
		getCache(),
		validatePurgedBusiness,
		api.getBusinessKybDetails,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);

router
	.route("/internal/facts/business/:businessID/kyb/ca")
	.get(validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getBusinessKybDetailsCa, saveCacheAndSend())
	.all(methodNotAllowed);

router
	.route("/internal/facts/business/:businessID/kyb")
	.get(validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getBusinessKybDetails, saveCacheAndSend())
	.all(methodNotAllowed);

/** KYC Routes */
router
	.route("/facts/business/:businessID/kyc")
	.get(
		validateUser,
		validateDataPermission,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.businessIDParam),
		getCache(),
		validatePurgedBusiness,
		api.getBusinessKycDetails,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);

router
	.route("/internal/facts/business/:businessID/kyc")
	.get(validateSchema(schema.businessIDParam), getCache(), validatePurgedBusiness, api.getBusinessKycDetails, saveCacheAndSend())
	.all(methodNotAllowed);

/** BJL Routes */
router
	.route("/facts/business/:businessID/bjl")
	.get(
		validateUser,
		validateDataPermission,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.businessIDParam),
		getCache(),
		validatePurgedBusiness,
		api.getBusinessBJL,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);

router
	.route("/internal/facts/business/:businessID/bjl")
	.get(validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getBusinessBJL, saveCacheAndSend())
	.all(methodNotAllowed);

/** Reviews Routes */
router
	.route("/facts/business/:businessID/reviews")
	.get(
		validateUser,
		validateDataPermission,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.businessIDParam),
		getCache(),
		validatePurgedBusiness,
		api.getBusinessReviews,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);
router
	.route("/internal/facts/business/:businessID/reviews")
	.get(validateSchema(schema.businessIDParam), api.getBusinessReviews, saveCacheAndSend())
	.all(methodNotAllowed);
router
	.route("/internal/facts/business/:businessID/reviews")
	.get(validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getBusinessReviews, saveCacheAndSend())
	.all(methodNotAllowed);
router
	.route("/internal/facts/business/:businessID/cache")
	.delete(validateSchema(schema.businessIDParam), api.invalidateBusinessCache)
	.all(methodNotAllowed);

/** Financials Routes */
router
	.route("/facts/business/:businessID/financials")
	.get(
		validateUser,
		validateDataPermission,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.businessIDParam),
		getCache(),
		validatePurgedBusiness,
		api.getBusinessFinancials,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);
router
	.route("/internal/facts/business/:businessID/financials")
	.get(validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getBusinessFinancials, saveCacheAndSend())
	.all(methodNotAllowed);

/** Processing History Facts Routes */
router
	.route("/facts/business/:businessID/processing-history")
	.get(
		validateUser,
		validateDataPermission,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.businessIDParam),
		getCache(),
		validatePurgedBusiness,
		api.getProcessingHistoryFacts,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);
router
	.route("/internal/facts/business/:businessID/processing-history")
	.get(validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getProcessingHistoryFacts, saveCacheAndSend())
	.all(methodNotAllowed);

// Expressly want to make sure matches are only available to admins and are not serving up the cached version
router
	.route("/facts/business/:businessID/matches")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.businessIDParam),
		api.getBusinessMatches,
		saveCacheAndSend()
	)
	.all(methodNotAllowed);

router
	.route("/internal/facts/business/:businessID/matches")
	.get(validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getBusinessMatches, saveCacheAndSend())
	.all(methodNotAllowed);

// The /all route is intentionally not cached and admin only. Leaks information that we do not want customers to have.
router
	.route("/facts/business/:businessID/all")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.businessIDParam),
		validatePurgedBusiness,
		api.getAllBusinessFacts
	)
	.all(methodNotAllowed);

/* Handle Fact Override/Mutation */
router
	.route(["/facts/business/:businessID/override/:factName", "/facts/business/:businessID/override"])
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.getFactOverride),
		api.getFactOverride
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateFactOverride),
		api.updateFactOverride
	)
	.put(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateFactOverride),
		api.updateFactOverride
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.deleteFactOverride),
		api.deleteFactOverride
	)
	.all(methodNotAllowed);

router
	.route("/proxy/facts/business/:businessID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.proxyBusinessDetails),
		api.getProxyBusinessDetails
	)
	.all(methodNotAllowed);

router.route("/internal/facts/business/:businessID/override").patch(api.updateFactOverride).all(methodNotAllowed);

module.exports = router;
