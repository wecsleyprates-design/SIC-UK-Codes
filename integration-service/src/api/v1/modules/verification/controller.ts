import { ERROR_CODES, INTEGRATION_ID, type IntegrationPlatformId, kafkaEvents, kafkaTopics } from "#constants";
import { getApplicationEdit, getOwners } from "#helpers/api";
import { getOwnerTitles } from "#helpers/api";
import { logger } from "#helpers/logger";
import { producer } from "#helpers/kafka";
import { getConnectionForBusinessAndPlatform, getOrCreateConnection, platformFactory } from "#helpers/platformHelper";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import { catchAsync, mapIdsToLabels } from "#utils/index";
import {
	getBusienssEntityVerificationByUniqueExternalId,
	getBusinessEntityVerificationService
} from "./businessEntityVerification";
import { VerificationApiError } from "./error";
import { verification } from "./verification";
import { OpenCorporates } from "#lib/opencorporates/opencorporates";
import { ZoomInfo } from "#lib/zoominfo/zoominfo";
import { genericBusinessEnqueue } from "#helpers/bull-queue";
import type { Request } from "express";
import { randomUUID, type UUID } from "crypto";
import { NPI } from "#lib/npi/npi";
import { StatusCodes } from "http-status-codes";
import {
	getWorthWebsiteScanningService,
	getWorthWebsiteScanResponse,
	WorthWebsiteScanning
} from "#lib/worthWebsiteScanning/worthWebsiteScanning";
import { IPlaidIDV } from "#lib/plaid/types";
import { getInputValidationForCountry, validate } from "#lib/plaid/idvInputValidation";
import { Strategy } from "plaid";
import { MatchUtil } from "#lib/match/matchUtil";
import { checkPermission } from "#helpers";
import { ErrorMatchResponse } from "../match-pro/error";
import { TruliooFactory } from "#lib/trulioo/utils/truliooFactory";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { getCachedSignedUrl } from "#utils/s3";
import axios from "axios";
import { convertPlaidToWorth } from "#lib/plaid/convert";

export const controller = {
	getAllVerificationIntegrations: catchAsync(async (req, res) => {
		const response = await verification.getAllVerificationIntegrations(req.params);
		res.jsend.success(response, "Verification data fetched successfully.");
	}),

	verifyBusinessEntity: catchAsync(async (req, res) => {
		const service = await getBusinessEntityVerificationService(req.params.businessID);
		const response = await service.submitBusinessEntityForReview(req.params, req.headers.authorization);

		try {
			const websiteScanService = await getWorthWebsiteScanningService(req.params.businessID);
			await websiteScanService.submitBusinessEntityWebsiteScanRequest({
				websiteUrl: req.body.official_website ?? req.body?.website?.url
			});
		} catch (error) {
			// Don't throw an error if submit fails, just log it
			logger.error({ error }, "[verifyBusinessEntity] - Error submitting business for worth website scan");
		}

		res.jsend.success(response, "Business Verification order submitted successfully.");
	}),

	internalVerifyBusinessEntity: catchAsync(async (req, res) => {
		const service = await getBusinessEntityVerificationService(req.params.businessID);
		const response = await service.internalSubmitBusinessEntityForReview(
			req.params,
			req.body,
			req.headers.authorization
		);

		try {
			const websiteScanService = await getWorthWebsiteScanningService(req.params.businessID);
			await websiteScanService.submitBusinessEntityWebsiteScanRequest({
				websiteUrl: req.body.official_website ?? req.body?.website?.url
			});
		} catch (error) {
			// Don't throw an error if submit fails, just log it
			logger.error({ error }, "[internalVerifyBusinessEntity] - Error submitting business for worth website scan");
		}

		res.jsend.success(response, "Business Verification order submitted successfully.");
	}),

	internalVerifyBusinessEntityAndCreateOrUpdateOrder: catchAsync(async (req, res) => {
		const service = await getBusinessEntityVerificationService(req.params.businessID);
		const response = await service.internalVerifyBusinessEntityAndCreateOrUpdateOrder(
			req.params,
			req.body,
			req.headers.authorization
		);

		try {
			const websiteScanService = await getWorthWebsiteScanningService(req.params.businessID);
			await websiteScanService.submitBusinessEntityWebsiteScanRequest({
				websiteUrl: req.body.official_website ?? req.body?.website?.url
			});
		} catch (error) {
			// Don't throw an error if submit fails, just log it
			logger.error(
				`[internalVerifyBusinessEntityAndCreateOrUpdateOrder] - Error submitting business for worth website scan: ${error}`
			);
		}

		res.jsend.success(response, "Business Verification order submitted successfully.");
	}),

	updateBusinessEntity: catchAsync(async (req, res) => {
		const service = await getBusinessEntityVerificationService(req.params.businessID);
		const isLightningVerification = req.body.is_lightning_verification || false;
		if (Object.hasOwn(req.body, "is_lightning_verification")) {
			delete req.body.is_lightning_verification;
		}

		const response = await service.updateBusinessEntityDetails(req.params, req.body, isLightningVerification);

		try {
			const websiteScanService = await getWorthWebsiteScanningService(req.params.businessID);
			await websiteScanService.submitBusinessEntityWebsiteScanRequest({
				websiteUrl: req.body.official_website ?? req.body?.website?.url
			});
		} catch (error) {
			// Don't throw an error if submit fails, just log it
			logger.error({ error }, "[updateBusinessEntity] - Error submitting business for worth website scan");
		}

		res.jsend.success(response, "Business entity updated successfully.");
	}),

	handleVerificationWebhook: catchAsync(async (req, res) => {
		// If the flow of execution made it here, past the middleware, the signature is valid.
		if (req.body.type === "business.updated") {
			const uniqueExternalId = req.body.data.object.unique_external_id;
			// fetch businessId by uniqueExternalId
			const businessEntity = await getBusienssEntityVerificationByUniqueExternalId(uniqueExternalId);
			let businessID = businessEntity?.business_id;

			if (!businessID) {
				businessID = uniqueExternalId;
				if (!businessID) {
					const errMsg = `Business entity verification webhook received for unknown business with uniqueExternalId: ${uniqueExternalId} and businessName: ${req.body?.data?.object?.name}`;
					logger.error(errMsg);
					throw new Error(errMsg);
				}
			}

			const service = await getBusinessEntityVerificationService(businessID as UUID);
			await service.handleBusinessEntityReviewUpdate({ businessID }, req.body);
		} else {
			logger.info(
				`Unhandled business entity verification webhook event type: ${req.body.type}, unique_external_id: ${req.body.data.object.unique_external_id}`
			);
		}

		res.jsend.success("Business verification webhook processed successfully.");
	}),

	getEntityVerificationDetails: catchAsync(async (req, res) => {
		const service = await getBusinessEntityVerificationService(req.params.businessID);
		const response = await service.getBusinessEntityReview(req.params, res.locals.user);
		res.jsend.success(response, "Business Verification status fetched successfully.");
	}),

	idvEnroll: catchAsync(async (req, res) => {
		const { businessID, platformID, applicantID } = req.params;
		// Default to Plaid IDV
		if (!platformID || platformID === INTEGRATION_ID.PLAID_IDV) {
			const owners = await getOwners(businessID);
			// Enroll applicant
			if (businessID && owners) {
				// There is no customer ID provided, so not updating this to account for new Plaid IDV strategy.
				// If this is expected to use the Plaid IDV strategy based on customer integration settings,
				// then a customer ID will need to be passed here. Otherwise, the default strategy will be used.
				// Not concerned about this since the endpoints that call this function are currently not being used.
				const plaidIdvWithStrategy = await strategyPlatformFactory<PlaidIdv>({
					businessID,
					platformID: INTEGRATION_ID.PLAID_IDV
				});

				const plaidIdv = await plaidIdvWithStrategy.initializePlaidIdvConnectionConfiguration();

				if (applicantID) {
					// Enroll single applicant
					const owner = owners.find(owner => owner.id === applicantID);
					if (plaidIdv && owner) {
						const enrollApplicant = await plaidIdv.enrollApplicantOrGetExistingIdvRecord(owner);
						return res.jsend.success(enrollApplicant);
					}
					throw new VerificationApiError("Could not enroll applicant in Identity Verification");
				} else {
					// Enroll business
					const enrollBusiness = await plaidIdv.enrollBusinessInPlaidIdv({ businessID, owners });
					return res.jsend.success(enrollBusiness);
				}
			}
			throw new VerificationApiError("Could not enroll business in Identity Verification");
		}
		return res.jsend.error("Could not determine verification provider from the request");
	}),

	idvGetStatusForApplicant: catchAsync(async (req, res) => {
		const { businessID, applicantID } = req.params;
		const connection = await getConnectionForBusinessAndPlatform(businessID, INTEGRATION_ID.PLAID_IDV);
		if (connection) {
			const hasPermission = await checkPermission(res.locals.user, "case:read:badge_display");
			if (!hasPermission) {
				return res.jsend.success({} as IPlaidIDV.GetApplicantResponse);
			}
			if (connection.configuration?.idv_enabled === false) {
				return res.jsend.success({
					applicant: {
						id: applicantID
					},
					identity_verification_attempted: false
				});
			}
			const records = await PlaidIdv.getApplicantVerificationResponse(applicantID);
			if (records && records[0]) {
				return res.jsend.success(records[0]);
			}
			if (res.locals.user?.is_guest_owner) {
				return res.jsend.success({} as IPlaidIDV.GetApplicantResponse);
			}
			return res.jsend.error("No records found for applicant");
		}
		return res.jsend.error("No connection found for business");
	}),

	idvGetTokenForApplicant: catchAsync(async (req, res) => {
		const { businessID, applicantID } = req.params;
		const connection = await getConnectionForBusinessAndPlatform(businessID, INTEGRATION_ID.PLAID_IDV);
		if (connection) {
			const record = await PlaidIdv.getTasksForIdentityVerificationByApplicantId(applicantID, businessID);
			const plaidIdvStatus = record?.metadata?.plaidResponse?.status;
			const idvRecordstatus = plaidIdvStatus ? convertPlaidToWorth("status", plaidIdvStatus) : null;

			// Fetch the template from the plaid response and check if it's background verification only.
			// This is more accurate than using the connection.configuration since customer settings could be different from the template used for the specific IDV request.
			const idvTemplateId = record?.metadata?.plaidResponse?.template?.id ?? null;
			let isBackgroundVerificationOnly = connection?.configuration?.background_verification_only;
			if (idvTemplateId) {
				const template = await PlaidIdv.getIdentityVerificatonTemplateById(idvTemplateId);
				isBackgroundVerificationOnly =
					template &&
					!template?.steps?.includes("documentary_verification") &&
					!template?.steps?.includes("selfie_check");
			}
			if (record) {
				return res.jsend.success({
					task_id: record.id,
					status: record.task_status,
					idv_status: idvRecordstatus,
					idv_id: record.metadata?.plaidResponse?.id ?? null,
					idv_template_id: idvTemplateId ?? null,
					token: record.metadata?.linkTokenData?.link_token ?? null,
					background_verification_only: isBackgroundVerificationOnly ?? true,
					identity_verification_enabled: connection?.configuration?.idv_enabled ?? false,
					custom_template: connection?.configuration?.custom_template_used ?? false,
					task_updated_at: record.updated_at ?? null,
					task_created_at: record.created_at ?? null
				});
			}
			logger.warn(
				`No identity verification records found for applicant ${applicantID} in business ${businessID}. The applicant may need to be enrolled first.`
			);
			throw new VerificationApiError("No records found for applicant", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		throw new VerificationApiError("No connection found for business", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
	}),
	/**
	 * Get the IDV requirements schema for a particular country code
	 */
	idvGetSchema: catchAsync(async (req, res) => {
		const { countryCode } = req.params;
		const schema = getInputValidationForCountry(countryCode);
		if (!schema) {
			throw new VerificationApiError(
				`Country code is not supported: ${countryCode}`,
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}
		res.jsend.success(schema);
	}),
	/**
	 * Validate the IDV input for a particular country code
	 */
	idvValidate: catchAsync(async (req, res) => {
		/* passing fake client_user_id and template_id to satisfy the type requirements for an IDV validation request -- this won't be persisted anywhere  */
		validate({ user: req.body, client_user_id: "123", template_id: "123", strategy: Strategy.Custom });
		const schema = getInputValidationForCountry(req.body?.address?.country);
		res.jsend.success({ message: `input validated successfully for country: ${schema?.country.name}`, data: req.body });
	}),

	getBusinessWebsiteDetails: catchAsync(async (req, res) => {
		let response: any;

		const inhouseWebsiteScanEnabled: boolean = await WorthWebsiteScanning.isEnabled(req.params.businessID);
		if (inhouseWebsiteScanEnabled) {
			response = await getWorthWebsiteScanResponse(req.params.businessID);
		} else {
			const service = await getBusinessEntityVerificationService(req.params.businessID);
			response = await service.getBusinessWebsiteDetails(
				req.params,
				Object.keys(req.body).length ? req.body : req.query
			);
		}

		res.jsend.success(
			response.data,
			response.message ? response.message : "Business website data fetched successfully."
		);
	}),

	getVerificationPeople: catchAsync(async (req, res) => {
		const service = await getBusinessEntityVerificationService(req.params.businessID);
		const response = await service.getVerificationPeople(req.params);
		res.jsend.success(response, "Business verification people fetched successfully.");
	}),

	getPeopleWatchlistResult: catchAsync(async (req, res) => {
		const service = await getBusinessEntityVerificationService(req.params.businessID);
		const response = await service.getPeopleWatchlistDetails(req.params);
		res.jsend.success(response, "Business verification people watchlist results fetched successfully.");
	}),

	matchOpenCorporates: catchAsync(async (req, res) => {
		const { businessID } = req.params;
		try {
			const updatedTask = await OpenCorporates.matchBusiness(businessID);
			res.jsend.success(
				updatedTask,
				`OpenCorporates match task created and processed with state of ${updatedTask.task_status}`
			);
		} catch {
			throw new VerificationApiError("Failed to match business");
		}
	}),
	submitHealthcareProviderMatch: catchAsync(async (req, res) => {
		const { businessID, caseID, npiID } = req.params;
		try {
			logger.debug(
				`Submitting healthcare provider match for businessID: ${businessID}, caseID: ${caseID}, npiID: ${npiID}`
			);

			// const connection = await getOrCreateConnection(businessID, INTEGRATION_ID.NPI);
			// const npi = new NPI(connection);
			const connection = await getOrCreateConnection(businessID, INTEGRATION_ID.NPI);
			const npi: NPI = platformFactory({
				dbConnection: connection,
				platformId: INTEGRATION_ID.NPI
			});

			if (res.locals.user?.is_guest_owner) {
				if (!req.body.invitation_id) {
					throw new VerificationApiError(
						"You are not allowed to update npi details without invitation",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.NOT_ALLOWED
					);
				}

				if (!Object.hasOwn(req.body, "oldNpiID")) {
					throw new VerificationApiError(
						"You are not allowed to update npi details without old npi id",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.NOT_ALLOWED
					);
				}
			}

			let metadata: null | any = null;
			if (res.locals.user?.is_guest_owner) {
				metadata = {
					business_id: businessID,
					customer_id: res.locals.user?.issued_for?.customer_id,
					user_name:
						`${res.locals.user?.issued_for?.first_name ?? ""} ${res.locals.user?.issued_for?.last_name ?? ""}`.trim(),
					created_by: res.locals.user?.issued_for?.user_id,
					old_npi_id: req.body.oldNpiID ?? null
				};
			}
			const result = await npi.submitProviderMatch(npiID, caseID, metadata);
			if (result) {
				logger.info(
					`Healthcare provider match submitted for businessID: ${businessID}, caseID: ${caseID}, npiID: ${npiID}. Result: ${JSON.stringify(result)}`
				);
				res.jsend.success(result, `NPI healthcare provider match task created and processed`);
			} else {
				logger.error(
					`Failed to submit healthcare provider match for businessID: ${businessID}, caseID: ${caseID}, npiID: ${npiID}.`
				);
				res.jsend.error("Failed to match healthcare provider");
			}
		} catch (error: any) {
			logger.error(
				`Error submitting healthcare provider match for businessID: ${businessID}, caseID: ${caseID}, npiID: ${npiID}. Details: ${error.message}`
			);
			throw error;
		}
	}),
	fetchHealthcareProviderByBusinessId: catchAsync(async (req, res) => {
		const { businessID } = req.params;
		try {
			const connection = await getConnectionForBusinessAndPlatform(businessID, INTEGRATION_ID.NPI);
			const npi = new NPI(connection);
			const result = await npi.fetchProviderMatch(businessID);
			const applicationEdit = await getApplicationEdit(req.params.businessID, { stage_name: "company" });
			const guestOwnerEdit =
				Array.isArray(applicationEdit?.data) && applicationEdit.data.length
					? [...new Set(applicationEdit.data.map(record => record.field_name))]
					: undefined;
			res.jsend.success({ ...result, guest_owner_edits: guestOwnerEdit });
		} catch (error: any) {
			throw error;
		}
	}),
	fetchHealthcareProviderByBusinessAndCase: catchAsync(async (req, res) => {
		const { businessID, caseID } = req.params;
		try {
			const connection = await getConnectionForBusinessAndPlatform(businessID, INTEGRATION_ID.NPI);
			const npi = new NPI(connection);
			const result = await npi.fetchProviderMatch(businessID, caseID);
			res.jsend.success(result);
		} catch (error: any) {
			throw new VerificationApiError(`Failed to match healthcare provider. Details: ${error.message}`);
		}
	}),
	fetchDoctorsDetails: catchAsync(async (req, res) => {
		const response = await verification.fetchDoctorsDetails(req.body, req.query);
		res.jsend.success(response, "Doctors information fetched successfully");
	}),
	matchZoomInfo: catchAsync(async (req, res) => {
		const { businessID } = req.params;
		try {
			const updatedTask = await ZoomInfo.matchBusiness(businessID);
			res.jsend.success(
				updatedTask,
				`ZoomInfo match task created and processed with state of ${updatedTask.task_status}`
			);
		} catch {
			throw new VerificationApiError("Failed to match business");
		}
	}),
	/**
	 * Trigger KYB verification for a business
	 * POST /api/v1/verification/businesses/:businessID/kyb-verification
	 */
	triggerKYBVerification: catchAsync(async (req, res) => {
		const { businessID } = req.params;
		try {
			const connection = await getOrCreateConnection(businessID, INTEGRATION_ID.TRULIOO);
			const truliooBusiness = TruliooFactory.createBusiness(businessID, connection);
			const updatedTask = await truliooBusiness.matchBusiness();
			res.jsend.success(
				updatedTask,
				`KYB verification task created and processed with state of ${updatedTask.task_status}`
			);
		} catch (error: any) {
			logger.error(`Failed to trigger KYB verification for Trulioo, ${error}`);
			throw new VerificationApiError(`Failed to trigger KYB verification for Trulioo, ${error.message}`);
		}
	}),

	matchZoomInfoBulk: catchAsync(async (req, res) => {
		await genericBusinessEnqueue(ZoomInfo.enqueueMatchRequest.bind(ZoomInfo), req, res);
	}),
	matchOpenCorporatesBulk: catchAsync(async (req, res) => {
		await genericBusinessEnqueue(OpenCorporates.enqueueMatchRequest.bind(OpenCorporates), req, res);
	}),
	matchNPIBulk: catchAsync(async (req, res) => {
		await genericBusinessEnqueue(NPI.enqueueMatchRequest.bind(NPI), req, res);
	}),
	matchAllBulk: catchAsync(async (req, res) => {
		try {
			const promises = await Promise.all([
				genericBusinessEnqueue(ZoomInfo.enqueueMatchRequest.bind(ZoomInfo), req, res),
				await genericBusinessEnqueue(OpenCorporates.enqueueMatchRequest.bind(OpenCorporates), req, res)
			]);
			res.jsend.success(promises, "Bulk match tasks created and processed");
		} catch (error) {
			const errorString = JSON.stringify(error);
			logger.error(`matchAllBulk error: ${errorString}`);
			throw new VerificationApiError(`Failed to enqueue bulk match request: ${errorString}`);
		}
	}),
	matchAsync: catchAsync(async (req: Request, res) => {
		try {
			const { businessID, platformID } = req.params;
			req.body = { business_id: businessID };
			if (!platformID) {
				const promises = await Promise.all([
					genericBusinessEnqueue(ZoomInfo.enqueueMatchRequest.bind(ZoomInfo), req, res),
					genericBusinessEnqueue(OpenCorporates.enqueueMatchRequest.bind(OpenCorporates), req, res)
				]);
				res.jsend.success(promises, `Asynchronous match tasks queued for business ${businessID}`);
			} else if (platformID) {
				const dbConnection = await getConnectionForBusinessAndPlatform(
					businessID as UUID,
					platformID as unknown as IntegrationPlatformId
				);
				const platform = platformFactory({ dbConnection });
				const requestId = randomUUID();
				// Get a static reference to the platform's class
				const matchTask = await platform.constructor.enqueueMatchRequest(requestId, req.body);
				res.jsend.success(
					matchTask,
					`Asynchronous match task ${requestId} queued for business ${businessID} on platform ${platformID}`
				);
			}
		} catch (error) {
			const errorString = JSON.stringify(error);
			logger.error(`matchAsync error: ${errorString}`);
			throw new VerificationApiError(`Failed to enqueue bulk match request: ${errorString}`);
		}
	}),
	matchSync: catchAsync(async (req, res) => {
		const { businessID, platformID } = req.params;
		const dbConnection = await getConnectionForBusinessAndPlatform(
			businessID as UUID,
			platformID as unknown as IntegrationPlatformId
		);
		const platform = platformFactory({ dbConnection });
		const updatedTask = await platform.constructor.matchBusiness(businessID);
		res.jsend.success(updatedTask, `Match task created and processed with state of ${updatedTask.task_status}`);
	}),
	getVerificationForBusinessOwners: catchAsync(async (req, res) => {
		const { businessID } = req.params;
		const connection = await getOrCreateConnection(businessID, INTEGRATION_ID.PLAID_IDV);
		if (!connection) {
			throw new VerificationApiError("No connection found for business", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const rawRecords = await PlaidIdv.getVerificationForBusinessOwners(businessID);
		if (!rawRecords?.length) {
			throw new VerificationApiError("No records found for business", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		// Extract title strings, handling both old (number) and new (object) formats
		let objectFormatCount = 0;
		let numericFormatCount = 0;

		const titleStrings = rawRecords.map(r => {
			if (typeof r.title === 'object' && r.title?.title) {
				// New format: title object with string already present
				objectFormatCount++;
				return r.title.title;
			} else if (typeof r.title === 'number') {
				// Old format: numeric ID (will be looked up below)
				numericFormatCount++;
				return null;
			}
			return null;
		});

		// Log title format distribution for monitoring
		if (objectFormatCount > 0 || numericFormatCount > 0) {
			logger.debug({
				message: "Title format distribution in KYC response",
				businessID,
				objectFormat: objectFormatCount,
				numericFormat: numericFormatCount
			});
		}

		// Only fetch title mappings if we have numeric IDs to look up
		const numericTitleIndices = rawRecords
			.map((r, idx) => ({ hasNumeric: typeof r.title === 'number', idx }))
			.filter(item => item.hasNumeric);

		if (numericTitleIndices.length > 0) {
			const titleIds = numericTitleIndices.map(item => rawRecords[item.idx].title as number);
			const titleMappings = await getOwnerTitles();
			const mappedStrings = mapIdsToLabels(titleIds, titleMappings, "title");

			// Fill in the null values with looked-up strings
			numericTitleIndices.forEach((item, mappingIdx) => {
				titleStrings[item.idx] = mappedStrings[mappingIdx];
			});
		}

		// rebuild each record preserving original key order, replacing title in‑place and dropping ssn
		const records = rawRecords.map((rec, idx) => {
			const humanTitle = titleStrings[idx];
			const entries = Object.entries(rec).reduce(
				(acc, [key, val]) => {
					if (key === "ssn") return acc;
					acc.push([key, key === "title" ? humanTitle : val]);
					return acc;
				},
				[] as [string, any][]
			);
			return Object.fromEntries(entries);
		});

		return res.jsend.success(records, "KYC Ownership Verification fetched successfully");
	}),
	matchPro: catchAsync(async (req, res) => {
		const { customerID, businessID } = req.params;
		const icas = req.body?.icas;
		try {
			const updatedTask = await MatchUtil.runMatchBusiness(customerID, businessID, icas);
			res.jsend.success(updatedTask, `Match-pro task created and processed with state of ${updatedTask.task_status}`);
		} catch {
			throw new VerificationApiError("Failed to Match-pro business");
		}
	}),
	matchProBulk: catchAsync(async (req, res) => {
		const impl = MatchUtil.enqueueMatchProRequest;
		await genericBusinessEnqueue(impl, req, res);
	}),
	getMatchBusinessResult: catchAsync(async (req, res) => {
		const response = await MatchUtil.getMatchBusinessResult(req.params);
		if (Object.keys(response).length === 0) {
			const error = new ErrorMatchResponse("DB", "This business has not been reviewed in Mastercard Match");
			return res.jsend.success(error.toJSON(), "Please make a sure to run Match-pro for this business.");
		}
		res.jsend.success(response, "Business Match result fetched successfully.");
	}),
	getIDVTemplate: catchAsync(async (req, res) => {
		const templateID = req.params.templateID;

		const template = await PlaidIdv.getIdentityVerificatonTemplateById(templateID);

		if (!template) {
			return res.jsend.fail(null, `Template not found for template_id: ${templateID}`);
		}
		res.jsend.success(template, "IDV template fetched successfully.");
	}),

	downloadIdentityDocument: catchAsync(async (req, res) => {
		const { businessID, applicantID } = req.params;
		const { document_id, type, case_id } = req.query;
		const side = (req.query.side as string) || "front";
		const documentType = (type as string) || "Identity Document";
		const userId = res.locals.user?.user_id;

		// Fetch the identity verification record
		const records = await PlaidIdv.getLocalIdentityVerificationRecordsForApplicant(applicantID as UUID);
		if (!records?.length) {
			throw new VerificationApiError("Identity verification record not found", StatusCodes.NOT_FOUND);
		}

		const record = records[0];

		// Get S3 keys directly from the record
		const s3Keys = record.document_s3_keys;
		const s3Key = side === "back" ? s3Keys?.back : s3Keys?.front;
		if (!s3Key) {
			throw new VerificationApiError("Document image not available", StatusCodes.NOT_FOUND);
		}

		// Generate signed URL from S3 key
		let signedUrl: string;
		try {
			const result = await getCachedSignedUrl(s3Key, "");
			signedUrl = result.signedRequest;
		} catch (error) {
			logger.error(`Failed to generate signed URL for ${s3Key}: ${(error as Error).message}`);
			throw new VerificationApiError("Failed to generate document URL", StatusCodes.INTERNAL_SERVER_ERROR);
		}

	// Send audit log
	try {
		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [
				{
					key: businessID,
					value: {
						event: kafkaEvents.IDENTITY_DOCUMENT_DOWNLOADED_AUDIT,
						business_id: businessID,
						applicant_id: applicantID,
						case_id,
							document_id: document_id || record.external_id,
							document_type: documentType,
							side,
							user_id: userId,
							timestamp: new Date().toISOString()
						}
					}
				]
			});
		} catch (error) {
			logger.error(`Failed to send audit log for document download: ${(error as Error).message}`);
		}

		// Proxy the image to force download (avoids CORS issues)
		try {
			const imageResponse = await axios.get(signedUrl, {
				responseType: "stream",
				timeout: 60000
			});

			const filename = `${documentType.replace(/\s+/g, "_")}_${side}.jpg`;
			res.setHeader("Content-Type", imageResponse.headers["content-type"] || "image/jpeg");
			res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

			imageResponse.data.pipe(res);
		} catch (error) {
			logger.error(`Failed to proxy document image: ${(error as Error).message}`);
			throw new VerificationApiError("Failed to download document image", StatusCodes.INTERNAL_SERVER_ERROR);
		}
	})
};
