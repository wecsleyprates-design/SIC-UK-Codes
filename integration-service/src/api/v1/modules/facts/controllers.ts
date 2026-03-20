import { businessFacts } from "#lib/facts/businessDetails";
import { kybFacts } from "#lib/facts/kyb";
import { facts as kybCaFacts } from "#lib/facts/kyb/ca";
import { kycFacts } from "#lib/facts/kyc";
import { processingHistoryFacts } from "#lib/facts/processingHistory";
import { FactEngine } from "#lib/facts/factEngine";
import { combineFacts, factWithHighestConfidence, combineWatchlistMetadata } from "#lib/facts/rules";
import { catchAsync } from "#utils/catchAsync";
import { bjlFacts } from "#lib/facts/bjl";
import { INTEGRATION_ID, ROLES } from "#constants";
import { reviewFacts } from "#lib/facts/reviews";
import type { NextFunction, Request } from "express";
import type { Response, UserInfo } from "#types/index";
import { getApplicationEdit } from "#helpers/api";
import { financialFacts } from "#lib/facts/financials/financials";
import { matchingFacts } from "#lib/facts/matches/matches";
import { logger } from "#helpers/logger";
import { allFacts, FactEngineWithDefaultOverrides } from "#lib/facts";
import { getOrCreateConnection } from "#helpers";
import { ManualIntegration } from "#lib/manual/manualIntegration";
import type { FactName, FactOverride } from "#lib/facts/types";
import type { UUID } from "crypto";
import { factsProxy } from "./facts-proxy";
import { invalidateBusinessCache } from "#middlewares/cache.middleware";

const injectFields = (res: Response) => {
	// Default fields to include
	const fieldInclusions = ["source.confidence", "source.platformId"];
	// Add the Source Name if user is an admin
	if (res.locals?.user?.role?.code === ROLES.ADMIN) {
		fieldInclusions.push("source.name");
		fieldInclusions.push("ruleApplied");
		fieldInclusions.push("isNormalized");
	}
	return fieldInclusions;
};

export const controller = {
	getBusinessDetails: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngine(businessFacts, { business: req.params.businessID });
		// Return all the facts together for "names" to get all the names from different sources as the value
		facts.addRuleOverride("names", combineFacts);
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));
		// get customer edits
		const applicationEdit = await getApplicationEdit(req.params.businessID, { stage_name: "company" });
		const guestOwnerEdit =
			Array.isArray(applicationEdit?.data) && applicationEdit.data.length
				? [...new Set(applicationEdit.data.map(record => record.field_name))]
				: undefined;

		res.locals.cacheOutput = {
			data: guestOwnerEdit ? { ...data, guest_owner_edits: guestOwnerEdit } : data,
			message: "Business details fetched successfully"
		};
		return next();
	}),
	getProxyBusinessDetails: catchAsync(async (req, res: Response, next: NextFunction) => {
		const response = await factsProxy.getProxyBusinessDetails(
			req.params.businessID,
			res.locals.user as UserInfo,
			req.query.category
		);
		res.jsend.success(response, "Business details fetched successfully");
	}),
	getBusinessDetailsByCase: catchAsync(async (req, res) => {
		const facts = new FactEngine(businessFacts, { case: req.params.caseID });
		// Return all the facts together for "names" to get all the names from different sources as the value
		facts.addRuleOverride("names", combineFacts);
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));
		res.jsend.success(data, "Business details fetched successfully");
	}),
	getBusinessKybDetails: catchAsync(async (req, res: Response, next: NextFunction) => {
		const { logger } = await import("#helpers/logger");
		logger.info(`[DEBUG getBusinessKybDetails] Called for businessID: ${req.params.businessID}`);
		const facts = new FactEngine(kybFacts, { business: req.params.businessID });
		facts.addRuleOverride(
			["addresses", "addresses_found", "dba_found", "names_found", "phone_found", "website_found"],
			combineFacts
		);
		facts.addRuleOverride("watchlist_raw", combineWatchlistMetadata);
		await facts.applyRules(factWithHighestConfidence);
		let data = await facts.getResults(injectFields(res));

		// Special handling for TIN: if source.platformId === INTEGRATION_ID.VERDATA and source.name === "verdataRaw", remove TIN value
		if (data && data.tin && typeof data.tin === "object") {
			const tin = data.tin;
			if ([INTEGRATION_ID.VERDATA].includes(tin["source.platformId"])) {
				data.tin.value = null;
				data.tin.alternatives = data.tin.alternatives?.filter(alt => alt.source !== INTEGRATION_ID.VERDATA);
			}
		}

		// Calculate process_completion_data from KYB timestamp
		if (data?.process_completion_data) {
			const bevTimestamp = data.process_completion_data.value as string | null;
			(data as any).process_completion_data = {
				all_kyb_processes_complete: bevTimestamp ? true : null,
				last_updated: bevTimestamp || null
			};
		}

		// get customer edits
		const applicationEdit = await getApplicationEdit(req.params.businessID, { stage_name: "company" });
		const guestOwnerEdit =
			Array.isArray(applicationEdit?.data) && applicationEdit.data.length
				? [...new Set(applicationEdit.data.map(record => record.field_name))]
				: undefined;

		res.locals.cacheOutput = {
			data: guestOwnerEdit ? { ...data, guest_owner_edits: guestOwnerEdit } : data,
			message: "Business KYB details fetched successfully"
		}
		next();
	}),
	getBusinessKybDetailsCa: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngine(kybCaFacts, { business: req.params.businessID });
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));
		res.locals.cacheOutput = {
			data,
			message: "Business KYB details fetched successfully"
		};
		next();
	}),
	getBusinessKycDetails: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngine(kycFacts, { business: req.params.businessID });
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));

		// get customer edits for ownership stage
		const applicationEdit = await getApplicationEdit(req.params.businessID, { stage_name: "ownership" });
		const guestOwnerEdit =
			Array.isArray(applicationEdit?.data) && applicationEdit.data.length
				? [...new Set(applicationEdit.data.map(record => record.field_name))]
				: undefined;

		const responseData = guestOwnerEdit ? { ...data, guest_owner_edits: guestOwnerEdit } : data;
		res.locals.cacheOutput = {
			data: responseData,
			message: "Business KYC details fetched successfully"
		};
		next();
	}),
	getBusinessBJL: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngine(bjlFacts, { business: req.params.businessID });
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));

		res.locals.cacheOutput = {
			data,
			message: "Business BJL details fetched successfully"
		};
		next();
	}),
	getBusinessReviews: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngine(reviewFacts, { business: req.params.businessID });
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));
		res.locals.cacheOutput = {
			data,
			message: "Business reviews fetched successfully"
		};
		next();
	}),
	getBusinessFinancials: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngine(financialFacts, { business: req.params.businessID });
		await facts.applyRules(factWithHighestConfidence);
		facts.addRuleOverride("revenue_all_sources", combineFacts);
		const data = await facts.getResults(injectFields(res));
		res.locals.cacheOutput = {
			data,
			message: "Business financials fetched successfully"
		};
		next();
	}),
	getProcessingHistoryFacts: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngine(processingHistoryFacts, { business: req.params.businessID });
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));

		// Get customer edits for processing history
		const applicationEdit = await getApplicationEdit(req.params.businessID, { stage_name: "processing_history" });
		const guestOwnerEdit =
			Array.isArray(applicationEdit?.data) && applicationEdit.data.length
				? [...new Set(applicationEdit.data.map(record => record.field_name))]
				: undefined;

		res.locals.cacheOutput = {
			data: guestOwnerEdit ? { ...data, guest_owner_edits: guestOwnerEdit } : data,
			message: "Processing history facts fetched successfully"
		};
		next();
	}),
	getBusinessMatches: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngineWithDefaultOverrides(matchingFacts, { business: req.params.businessID });
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));

		res.locals.cacheOutput = {
			data,
			message: "Business matches fetched successfully"
		};
		next();
	}),
	getAllBusinessFacts: catchAsync(async (req, res: Response, next: NextFunction) => {
		const facts = new FactEngineWithDefaultOverrides(allFacts, { business: req.params.businessID });
		await facts.applyRules(factWithHighestConfidence);
		const data = await facts.getResults(injectFields(res));
		res.jsend.success(data, "All facts fetched successfully");
	}),
	deleteFactOverride: catchAsync(async (req, res: Response, next: NextFunction) => {
		const userID = res.locals?.user?.user_id;
		if (!userID) {
			throw new Error("User ID is required");
		}
		const factName: FactName | undefined = req.params.factName;
		const businessID = req.params.businessID;
		const customerID = req.query.customerID ?? res.locals.user?.customer_id ?? undefined;
		const caseID = req.query.caseID ?? undefined;

		const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.MANUAL);

		const manualIntegration = new ManualIntegration(dbConnection);
		const deleted = await manualIntegration.deleteFactOverride({ factName, userID, customerID, caseID });

		/** Invalidate cache for this business so deletion is immediately visible */
		await invalidateBusinessCache(businessID);

		res.jsend.success(deleted ?? {}, "Fact override deleted successfully");
	}),
	updateFactOverride: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const userID = res.locals?.user?.user_id ?? (req.query.userId as UUID);
		if (!userID) {
			throw new Error("User ID is required");
		}
		let httpMethod = req.method as "DELETE" | "PATCH" | "PUT";
		const businessID = req.params.businessID as UUID;
		const customerID = (req.query.customerID ?? res.locals.user?.customer_id ?? undefined) as UUID | undefined;
		const caseID = (req.query.caseID ?? undefined) as UUID | undefined;
		const factOverrides: Record<FactName, FactOverride | { value: string; comment: string }> = req.body;
		const factName = req.params.factName as FactName | undefined;

		// If factName is provided and the method is PUT then change it to PATCH so we don't blow away the whole set of overrides for the business
		if (factName && req.method === "PUT") {
			httpMethod = "PATCH";
		}
		if (factName && httpMethod === "PATCH") {
			// Ensure the factName is in factOverrides & it is the only one in there
			if (!factOverrides[factName]) {
				throw new Error(`Fact ${factName} does not exist in the request body`);
			}
			if (Object.keys(factOverrides).length !== 1) {
				throw new Error(
					`Only one Fact may be provided in the request payload when specifying a specific fact name in the request`
				);
			}
		}

		const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.MANUAL);
		const manualIntegration = new ManualIntegration(dbConnection);

		manualIntegration.validateFactOverride(factOverrides, allFacts);
		const updated = await manualIntegration.updateFactOverride(factOverrides, {
			method: httpMethod,
			userID,
			customerID,
			caseID
		});
		logger.info(`Fact override updated successfully: ${JSON.stringify(updated)}`);

		/** Invalidate cache for this business so override is immediately visible */
		await invalidateBusinessCache(businessID);

		res.jsend.success(updated ?? {}, "Fact override updated successfully");
	}),
	getFactOverride: catchAsync(async (req, res: Response, next: NextFunction) => {
		const factName: FactName | undefined = req.params.factName;
		const businessID = req.params.businessID;
		const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.MANUAL);
		const manualIntegration = new ManualIntegration(dbConnection);
		const current = await manualIntegration.getCurrentFactOverrides(businessID);
		if (factName) {
			res.jsend.success(current?.[factName] ?? {}, "Fact override fetched successfully");
		} else {
			res.jsend.success(current ?? {}, "Fact override fetched successfully");
		}
	}),
	invalidateBusinessCache: catchAsync(async (req, res: Response, next: NextFunction) => {
		const businessID = req.params.businessID;
		await invalidateBusinessCache(businessID);
		res.jsend.success({}, "Business cache invalidated successfully");
	})
};
