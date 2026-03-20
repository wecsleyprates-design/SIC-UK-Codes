import { envConfig } from "#configs";
import { logger } from "#helpers/logger";
import { catchAsync, isKnexError, isPgDatabaseError } from "#utils/index";
import { StatusCodes } from "http-status-codes";
import { v4 as uuid } from "uuid";
import { businesses } from "./businesses";
import { BusinessInvites, businessInvites } from "./businessInvites";
import { isMapperError } from "./mapper";
import { canAddBusinesses, hasDataPermission } from "#helpers/index";
import { isBusinessApiError } from "./error";
import { DISPOSABLE_DOMAINS, ROLES, WEBHOOK_EVENTS } from "#constants";
import { assertTINValid, checkMaximumRetries, setBusinessRetries, validateBusiness } from "./validateBusiness";
import { sendEventToFetchAdverseMedia, sendEventToGatherWebhookData } from "#common/index";
import { BulkUpdateNaicsMccMap } from "./maps/bulkUpdateNaicsMccMap";
import { customerLimits } from "../onboarding/customer-limits";
import { onboarding } from "../onboarding/onboarding";
import { onboardingServiceRepository } from "../onboarding/repository";
import { relatedBusinesses } from "./relatedBusinesses";
import { getPurgedBusinesses } from "./handlers/getPurgeBusinesses";
import { searchCustomerBusinesses } from "./handlers";
import { CloneBusiness } from "./cloneBusiness";
import { Owners } from "./owners";
import { parseBulkProcessBody, normalizeBulkRows, initMapper } from "./helpers/bulkProcessBusiness";
import { getOrCreateLock, IdempotencyLockError, isIdempotencyLockError, releaseLock } from "#helpers/idempotencyLock";
import { BusinessState } from "./businessState";

// Pre-compute the Set once at module load time
const DISPOSABLE_DOMAINS_SET = new Set(DISPOSABLE_DOMAINS);

export const controller = {
	getBusinesses: catchAsync(async (req, res) => {
		const params = req.body && Object.keys(req.body).length ? req.body : req.query;
		const response = await businesses.getBusinesses(params, req.headers, res.locals.user);
		res.jsend.success(response, "Businesses fetched successfully");
	}),

	getBusinessByID: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessByID(req.params, req.query, res.locals.user);
		res.jsend.success(response, "Business fetched successfully");
	}),

	updateBusinessDetails: catchAsync(async (req, res) => {
		const response = await businesses.updateBusinessDetails(req.body, req.params, res.locals.user);
		res.jsend.success(response, "Business details added successfully");
	}),

	updateOrLinkBusiness: catchAsync(async (req, res) => {
		const response = await businesses.updateOrLinkBusiness(req.body, req.params, res.locals.user, req.headers);
		res.jsend.success(response.data, response.message);
	}),

	addOrUpdateOwners: catchAsync(async (req, res) => {
		const response = await Owners.addOrUpdateOwners(req.body, req.params.businessID, res.locals.user);
		res.jsend.success(response, "Ownership details added successfully");
	}),
	updateOwner: catchAsync(async (req, res) => {
		const response = await Owners.updateOwner(req.body, req.params, res.locals.user, req.headers);
		res.jsend.success(response, "Ownership details updated successfully");
	}),
	deleteBusinessOwner: catchAsync(async (req, res) => {
		const response = await Owners.deleteBusinessOwner(req.params, req.query, res.locals.user);
		res.jsend.success(response, "Business owner removed successfully");
	}),

	getBusinessCustomers: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessCustomers(req.params, req.query, req.headers);
		res.jsend.success(response, "Customers associated with business fetched successfully");
	}),

	internalBusinessCustomers: catchAsync(async (req, res) => {
		const params = req.body && Object.keys(req.body).length ? req.body : req.query;
		const response = await businesses.internalBusinessCustomers(req.params, params);
		res.jsend.success(response, "Customers associated with business fetched successfully");
	}),

	getCustomerBusinesses: catchAsync(async (req, res) => {
		const params = req.body && Object.keys(req.body).length ? req.body : req.query;
		const response = await businesses.getCustomerBusinesses(req.params, params, res.locals.user);
		res.jsend.success(response, "Businesses associated with customer fetched successfully");
	}),

	getCasesByBusinessID: catchAsync(async (req, res) => {
		const response = await businesses.getCasesByBusinessID(req.params, req.query, req.headers);
		res.jsend.success(response, "Business cases fetched successfully");
	}),

	getBusinessApplicantsForCustomer: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessApplicantsForCustomer(req.params, req.headers);
		res.jsend.success(response);
	}),

	getBusinessDetails: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessDetails(req.params, res.locals?.user);
		res.jsend.success(response, "Business details successfully");
	}),

	inviteBusiness: catchAsync(async (req, res) => {
		const { files } = req;
		const { customerID } = req.params;
		const response = await BusinessInvites.inviteBusiness(customerID, req.body, res.locals.user, files);
		const message = response.message ?? "Business invited successfully";
		res.jsend.success(response, message);
	}),

	auroraInviteBusiness: catchAsync(async (req, res) => {
		const response = await businesses.auroraInviteBusiness(req.body);
		res.jsend.success(response, "Business invited successfully");
	}),

	verifyInvitationToken: catchAsync(async (req, res) => {
		const response = await businesses.verifyInvitationToken(req.params);
		res.jsend.success(response, "Invitation Validated");
	}),

	updateInvitationStatus: catchAsync(async (req, res) => {
		const response = await businesses.updateInvitationStatus(req.body, res.locals.user);
		res.jsend.success({}, response.message);
	}),

	createApplicantBusiness: catchAsync(async (req, res) => {
		const response = await businesses.createApplicantBusiness(res.locals.user);
		res.jsend.success(response, "Business created successfully");
	}),

	getBusinessOwners: catchAsync(async (req, res) => {
		const response = await Owners.getBusinessOwners(req.params.businessID);
		res.jsend.success(response, "Business owners fetched successfully");
	}),

	getBusinessOwnersUnencrypted: catchAsync(async (req, res) => {
		const response = await Owners.getBusinessOwnersUnencrypted(req.params.businessID);
		res.jsend.success(response, "Business owners fetched successfully");
	}),

	setBusinessMonitoring: catchAsync(async (req, res) => {
		const response = await businesses.setBusinessMonitoring(req.body);
		res.jsend.success(response, "Business monitoring set successfully");
	}),

	/* @deprecated */
	startApplication: catchAsync(async (req, res) => {
		const response = await businesses.startApplication(req.body, req.params, res.locals.user);
		res.jsend.success(response, "Success");
	}),

	getBusinessesInternal: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessesInternal(req.query, req.headers);
		res.jsend.success(response, "Businesses fetched successfully");
	}),

	submitCase: catchAsync(async (req, res) => {
		const response = await businesses.submitCase(req.params, res.locals.user, req.headers);
		res.jsend.success({}, response.message);
	}),

	getBusinessStatus: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessStatus();
		res.jsend.success(response, "Success");
	}),

	getBusinessInvites: catchAsync(async (req, res) => {
		const params = req.body && Object.keys(req.body).length ? req.body : req.query;
		const response = await businesses.getBusinessInvites(req.params, params, req.headers);
		res.jsend.success(response, "Business invites fetched successfully");
	}),

	getInvitationByID: catchAsync(async (req, res) => {
		const response = await businesses.getInvitationByID(req.params);
		res.jsend.success(response, "Invite detail fetched successfully");
	}),

	getInvitationDetails: catchAsync(async (req, res) => {
		const response = await businesses.getInvitationDetails(req.query, req.headers);
		res.jsend.success(response, "Invite details fetched successfully");
	}),

	resendCustomerBusinessInvite: catchAsync(async (req, res) => {
		const response = await businesses.resendCustomerBusinessInvite(req.params, req.query, res.locals.user);
		res.jsend.success(response, "Invite resend successfully");
	}),
	getApplicantBusinessInvites: catchAsync(async (req, res) => {
		const response = await businesses.getApplicantBusinessInvites(req.params, req.query, res.locals.user);
		res.jsend.success(response, "Applicant business invites fetched successfully.");
	}),
	bulkValidateBusinesses: catchAsync(async (req, res) => {
		const rawBody = await parseBulkProcessBody(req);
		if (!Array.isArray(rawBody) || rawBody.length === 0) {
			throw new Error("Invalid bulk validation request. Please provide a valid CSV file or JSON array.");
		}
		const body = normalizeBulkRows(rawBody);
		const runMode: "create" | "update" = req.method === "POST" ? "create" : "update";
		const matches = new Map();
		const failures = new Map();
		for (const key in body) {
			const row = body[key];
			const input = new Map(Object.entries(row));
			if (req.params.applicantID) {
				input.set("applicant_id", req.params.applicantID);
			}

			const mapper = initMapper(input, runMode);
			mapper.setAuth(req.headers.authorization);
			mapper.setAdditionalMetadata({
				userID: res.locals.user?.user_id ?? envConfig.ENTERPRISE_APPLICANT_ID,
				customerID: req.params.customerID
			});

			try {
				const match = await mapper.match();
				match.mapped = mapper.toApiResponse();
				if (match.required.length > 0 || match.rejected.length > 0) {
					failures.set(key, match);
					continue;
				}
				matches.set(key, match);
			} catch (ex: unknown) {
				if (Error.isError(ex)) {
					logger.error({ error: ex, row }, `error in processing bulk validate business row: ${JSON.stringify(ex)}`);
					if (isKnexError(ex) || isPgDatabaseError(ex)) {
						failures.set(key, "Unexpected database error while processing row");
						continue;
					}
					failures.set(key, { message: ex.message, data: "data" in ex ? ex.data : undefined });
				}
			}
		}
		if (failures.size > 0) {
			res.jsend.fail("Bulk validation failed", { failed_rows: Object.fromEntries(failures) });
		} else {
			res.jsend.success({ success: Object.fromEntries(matches) }, "Bulk validation succeeded");
		}
		return;
	}),
	bulkProcessBusiness: catchAsync(async (req, res) => {
		const rawBody = await parseBulkProcessBody(req);
		if (!Array.isArray(rawBody) || rawBody.length == 0) {
			throw new Error("Invalid bulk process request. Please provide a valid CSV file or JSON array.");
		}
		const { applicantID, customerID } = req.params;
		const body = normalizeBulkRows(rawBody);
		const isAsync: boolean = Boolean(req.query?.async) ?? false;
		const reqBusinessId: string | null = req.query?.businessID ?? null;
		let idempotencyKey: string | null = null;
		const runMode: "create" | "update" = req.method === "POST" ? "create" : "update";
		const exceptions = { databaseErrors: [] as any[], otherErrors: [] as any[] }; //Track database errors separately for debug purposes
		const runId = uuid();
		const matches = new Map();
		const failures = new Map();

		if (runMode === "create") {
			// Throws if onboarding limit will be exceeded for the customer
			await canAddBusinesses(customerID, body.length);
		}

		// Only enable risk monitoring if the user is a customer && has the risk monitoring write permission
		const riskMonitoring =
			res.locals.user?.role?.code === ROLES.CUSTOMER &&
			(await hasDataPermission(res.locals.user, "risk_monitoring_module:write"));

		for (const index in body) {
			const row = body[index];

			try {
				const input = new Map(Object.entries(row));
				// Allow applicant_id to be passed in the URL
				if (applicantID) {
					input.set("applicant_id", applicantID);
				}

				const mapper = initMapper(input, runMode, runId);
				mapper.setAuth(req.headers.authorization);
				mapper.setAdditionalMetadata({
					userID: res.locals.user?.user_id ?? envConfig.ENTERPRISE_APPLICANT_ID,
					customerID: customerID,
					businessID: reqBusinessId,
					riskMonitoring,
					async: isAsync
				});

				if (runMode === "update" && customerID) {
					// check if maximum retries is exceeded for the customer and business
					await checkMaximumRetries({
						customerId: customerID,
						businessId: reqBusinessId,
						externalId: row.external_id
					});
				}

				const match = await mapper.match();

				// Once we run the match, we should be able to retrieve an external_id
				if (runMode === "create") {
					const externalId = mapper.getMappedValueForColumn("external_id", "rel_business_customer_monitoring");
					if (externalId) {
						idempotencyKey = `bulkProcessBusiness:${customerID}:${externalId}`;
						const [acquired] = await getOrCreateLock(idempotencyKey, runId);
						if (!acquired) {
							throw new IdempotencyLockError(
								`Duplicate request for same external_id detected: ${externalId}`,
								idempotencyKey
							);
						}
					}
				}

				await mapper.validate();
				await mapper.execute();

				const metadata = mapper.getAdditionalMetadata();

				// If nothing is being updated, return early with simplified 200 response
				if (metadata?.noChanges) {
					res.jsend.success({}, "No changes were made to the business");
					return;
				}

				match.mapped = mapper.toApiResponse();
				if (match.required.length > 0 || match.rejected.length > 0) {
					failures.set(index, match);
				}

				matches.set(index, mapper.sanitizeMetadata());

				const businessID = metadata.data_businesses?.id;

				try {
					if (!businessID) {
						throw new Error(`businessID not found`);
					}
					await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: businessID });

					await sendEventToFetchAdverseMedia(businessID, req.params.customerID, metadata?.data_cases?.id);

					switch (runMode) {
						case "update":
							await setBusinessRetries(req.params.customerID, businessID);
							break;
						case "create":
							await customerLimits.addBusinessCount(req.params.customerID, businessID);
							break;
					}
				} catch (err) {
					logger.error(
						`error in fetching business details businessID: ${metadata.data_businesses?.id} ${err instanceof Error ? err.message : "Unknown error"}`
					);
				}
			} catch (ex: unknown) {
				logger.error({ error: ex, row, idempotencyKey }, `error in processing business row: ${JSON.stringify(ex)}`);

				if (isIdempotencyLockError(ex)) {
					failures.set(index, {
						message: ex.message
					});
				} else if (isMapperError(ex)) {
					if (idempotencyKey) {
						// Release the idempotency lock if a Mapper error because you should be able to edit and retry the row
						await releaseLock(idempotencyKey);
					}
					if (ex.field) {
						const { value, providedKey, column, description } = ex.field;
						failures.set(index, { value, providedKey, column, description });
					}
				} else if (isBusinessApiError(ex)) {
					failures.set(index, { message: ex.message, data: ex?.data });
					await releaseLock(idempotencyKey);
				} else if (Error.isError(ex)) {
					if (isKnexError(ex) || isPgDatabaseError(ex)) {
						failures.set(index, "Unexpected error while processing row");
						exceptions.databaseErrors.push(ex);
					} else {
						failures.set(index, ex.message);
						exceptions.otherErrors.push(ex);
					}
				}
			}
		}
		if (!failures || failures.size === 0) {
			res.jsend.success({ runId, result: Object.fromEntries(matches) }, "Bulk process succeeded");
			return;
		}
		const hasExceptions = exceptions.databaseErrors.length > 0 || exceptions.otherErrors.length > 0;
		logger.error(
			{ failures, matches, runId, body, hasExceptions, exceptions },
			`Bulk process attempt had error. Unhandled exceptions=${hasExceptions ? "yes" : "no"} Database errors=${exceptions.databaseErrors.length} Other errors=${exceptions.otherErrors.length}`
		);
		res.jsend.fail("Bulk process had errors", {
			runId,
			failed_rows: Object.fromEntries(failures),
			result: Object.fromEntries(matches)
		});
	}),
	/* Get all possible fields for bulk processing */
	bulkProcessBusinessFields: catchAsync((req, res) => {
		const input = new Map();
		const runId = uuid();
		const mapper = initMapper(input, "create", runId);
		// Get all possible fields, sort them so that entries that are required are first, then entries alphabetically
		const fields = Object.values(mapper.toApiResponse(mapper.getPossibleFields()));
		fields.sort((a, b) => {
			if (
				a.column &&
				b.column &&
				Boolean(a.required) === Boolean(b.required) &&
				typeof a.column === typeof b.column &&
				typeof a.column === "string"
			) {
				return a.column.localeCompare(b.column);
			}
			return a.required ? -1 : 1;
		});
		if (req.query?.csv) {
			const entries = fields.reduce(
				(acc, f) => {
					acc.header.push(f.column);
					acc.desc.push(`"${f.description}"`);
					acc.optional.push(f.required ? "required" : "optional");
					return acc;
				},
				{ header: [] as string[], desc: [] as string[], optional: [] as string[] }
			);
			const csv = Object.entries(entries)
				.flatMap(([_key, value]) => [...value].join(","))
				.join("\n");
			res.setHeader("Content-Type", "text/csv");
			res.setHeader("Content-Disposition", 'attachment; filename="bulk_process_fields.csv"');
			res.send(csv);
		} else {
			res.jsend.success(fields, "Returning valid fields for bulk processing");
		}
	}),

	getProgression: catchAsync(async (req, res) => {
		const response = await businesses.getProgression(req.params, req.query, res.locals.user, req.headers);
		res.jsend.success(response, "Business progression fetched successfully");
	}),

	addOrUpdateCustomFields: catchAsync(async (req, res) => {
		const response = await businesses.addOrUpdateCustomFields(req.params, req.body, req.files, res.locals.user);
		res.jsend.success(response, "Custom fields added successfully");
	}),

	validateBusiness: catchAsync(async (req, res) => {
		const { businessID } = req.params;
		const response = await validateBusiness(businessID, req.body, res.locals.user.user_id, {
			authorization: req.headers?.authorization,
			shouldRunSerpSearch: true,
			userInfo: res.locals.user
		});

		res.jsend.success(response.data, response.message);
	}),

	assertTinValid: catchAsync(async (req, res) => {
		let isTINRequired = true;
		if (req.params.customerID) {
			const progressionConfig = await businesses.getProgressionConfig(req.params.customerID);
			isTINRequired = await businesses.getTinRequirementStatus(progressionConfig, req.headers?.authorization, false);
		}
		if (isTINRequired) {
			const response = await assertTINValid(req.params.businessID, req.body.attempts ?? 40);
			res.jsend.success(response, "TIN verification successful");
		} else {
			res.jsend.success({}, "TIN verification not required");
		}
	}),
	acceptInvitation: catchAsync(async (req, res) => {
		const response = await businesses.acceptInvitation(req.params, res.locals.user);
		res.jsend.success(response.data, response.message);
	}),

	singleBusinessEncryption: catchAsync(async (req, res) => {
		const response = await businesses.singleBusinessEncryption(req.params, req.body);
		res.jsend.success(response, "Success");
	}),
	getBusinessByTin: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessByTin(req.params.tin);
		if (response && response.id) {
			res.jsend.success(response, "Business fetched successfully");
		} else {
			res.jsend.error("Business not found", StatusCodes.NOT_FOUND);
		}
	}),
	getBusinessByExternalId: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessByExternalId(req.params.externalID, req.params.customerID);
		if (response && response.length) {
			res.jsend.success(response, "Business fetched successfully");
		} else {
			res.jsend.error("Business not found", StatusCodes.NOT_FOUND);
		}
	}),
	getCustomerBusiness: catchAsync(async (req, res) => {
		const response = await businesses.getCustomerBusinessById(req.params.businessID, req.params.customerID);
		if (response && response.id) {
			res.jsend.success(response, "Business fetched successfully");
		} else {
			res.jsend.error("Business not found", StatusCodes.NOT_FOUND);
		}
	}),
	refreshBusinessScore: catchAsync(async (req, res) => {
		const { businessID, customerID } = req.params;
		await businesses.triggerEventToRefreshScore(businessID, customerID);
		res.jsend.success({}, "Success");
	}),

	getBusinessAllNames: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessAllNames(req.params);
		res.jsend.success(response, "Business names fetched successfully");
	}),

	getBusinessAllAddresses: catchAsync(async (req, res) => {
		const response = await businesses.getBusinessAllAddresses(req.params);
		res.jsend.success(response, "Business addresses fetched successfully");
	}),
	getBusinessAllNamesAddresses: catchAsync(async (req, res) => {
		const { businessID } = req.params;
		const [names, addresses] = await Promise.all([
			businesses.getBusinessAllNames({ businessID }),
			businesses.getBusinessAllAddresses({ businessID })
		]);
		logger.info(`Fetched business names and addresses for businessID: ${businessID}`);
		logger.info(`Business names: ${JSON.stringify(names)} and addresses: ${JSON.stringify(addresses)}`);
		res.jsend.success({ businessID, names, addresses }, "Business names and addresses fetched successfully");
	}),
	purgeBusinesses: catchAsync(async (req, res) => {
		const response = await businesses.purgeBusiness(req.body, res.locals.user);
		res.jsend.success(response, "Purging of businesses initiated successfully");
	}),
	refreshProcessingTime: catchAsync(async (req, res) => {
		const response = await businesses.refreshProcessingTime(req.params, req.query);
		res.jsend.success(response, "Success");
	}),
	// temp api to update naics code for businesses
	bulkUpdateNaicsCode: catchAsync(async (req, res) => {
		const response = await businesses.bulkUpdateNaicsCode(req.body);
		res.jsend.success(response, "Success");
	}),
	bulkUpdateCoreNaicsMccCode: catchAsync(async (req, res) => {
		// const response = await businesses.bulkUpdateNaicsCode(req.body);
		const rawBody = await parseBulkProcessBody(req);
		if (!Array.isArray(rawBody) || rawBody.length === 0) {
			throw new Error("Invalid bulk update request. Please provide a valid CSV file or JSON array.");
		}
		const body = normalizeBulkRows(rawBody);
		const runId = uuid();
		const matches = new Map();
		const failures = new Map();
		await Promise.allSettled(
			body.map(async (val, key) => {
				const row = val;
				try {
					const input = new Map(Object.entries(row));
					let mapper;
					if (req.method === "POST") {
						mapper = new BulkUpdateNaicsMccMap(input);
					} else {
						throw new Error("invalid method");
					}
					const match = await mapper.match();
					await mapper.validate();
					await mapper.execute();
					match.mapped = Object.entries(match.mapped).reduce((acc, [k, f]) => {
						acc[k] = mapper.toString(f);
						return acc;
					}, {});
					if (match.required.length > 0 || match.rejected.length > 0) {
						failures.set(key, match);
					}
					matches.set(key, mapper.sanitizeMetadata());
				} catch (ex) {
					logger.error(
						{ error: ex, row },
						`error in processing bulk update core naics mcc code row: ${JSON.stringify(ex)}`
					);
					if (isMapperError(ex) && ex.field) {
						const { value, providedKey, column, description } = ex.field;
						failures.set(key, { value, providedKey, column, description });
					} else if (isBusinessApiError(ex)) {
						failures.set(key, { message: ex.message, data: ex?.data });
					}
					if (Error.isError(ex)) {
						failures.set(key, ex.message);
					}
				}
			})
		);
		if (failures.size > 0) {
			res.jsend.fail("Bulk process had errors", {
				runId,
				failed_rows: Object.fromEntries(failures),
				result: Object.fromEntries(matches)
			});
		} else {
			res.jsend.success({ runId, result: Object.fromEntries(matches) }, "Bulk process succeeded");
		}
		return;
	}),

	inviteCoApplicants: catchAsync(async (req, res) => {
		const response = await businesses.inviteCoApplicants(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Co-Applicant(s) invited successfully");
	}),

	getCoApplicantInvites: catchAsync(async (req, res) => {
		const response = await businessInvites.getCoApplicantInvites(req.params, req.query);
		res.jsend.success(response, "Co-Applicant(s) invites fetched successfully.");
	}),

	resendCoApplicantInvite: catchAsync(async (req, res) => {
		const response = await businessInvites.resendCoApplicantInvite(req.params, req.query, res.locals.user);
		res.jsend.success(response, "Invite resend successfully");
	}),

	revokeCoApplicantInvite: catchAsync(async (req, res) => {
		const response = await businessInvites.revokeCoApplicantInvite(req.params);
		res.jsend.success(response, "Invite revoked successfully");
	}),

	requestInviteLink: catchAsync(async (req, res) => {
		const response = await businessInvites.requestInviteLink(req.body);
		res.jsend.success(response, "Request sent successfully");
	}),

	acceptInviteLinkRequest: catchAsync(async (req, res) => {
		const response = await businessInvites.acceptInviteLinkRequest(req.params);
		res.jsend.success(response, "Request accepted successfully");
	}),

	denyInviteLinkRequest: catchAsync(async (req, res) => {
		const response = await businessInvites.denyInviteLinkRequest(req.params);
		res.jsend.success(response, "Request denied successfully");
	}),
	deleteRelNaicsMccCodes: catchAsync(async (req, res) => {
		const response = await businesses.deleteRelNaicsMccCodes();
		res.jsend.success(response, "NAICS codes and MCC codes mapping deleted successfully");
	}),

	convertRequestDataFormatToArray: (req, _, next) => {
		req.body = req.body ? [req.body] : [];
		return next();
	},

	addCustomFieldsFromInvite: catchAsync(async (req, res) => {
		const { inviteID } = req.params;
		const response = await onboarding.createBusinessCustomFieldValuesForInvite(inviteID);
		res.jsend.success(response, "Custom fields added successfully");
	}),
	getRelatedBusinesses: catchAsync(async (req, res) => {
		const response = await relatedBusinesses.getRelatedBusinesses(req.params, req.query);
		res.jsend.success(response, "Related Businesses fetched successfully");
	}),
	getRelatedBusinessByBusinessId: catchAsync(async (req, res) => {
		const response = await relatedBusinesses.getRelatedBusinessByBusinessId(
			req.params.businessID,
			req.body.customer_id
		);
		res.jsend.success(response, "Business fetched successfully");
	}),
	validateBusinessHasApplicant: catchAsync(async (req, res) => {
		const response = await businesses.validateBusinessHasApplicant(req.params);
		res.jsend.success(response);
	}),
	getPurgedBusinesses: catchAsync(async (req, res) => {
		const response = await getPurgedBusinesses(req.query, res.locals.user);
		res.jsend.success(response, "Purged businesses fetched successfully");
	}),
	archiveBusinesses: catchAsync(async (req, res) => {
		const response = await businesses.archiveBusiness(req.body, res.locals.user);
		res.jsend.success(response, "Businesses archived successfully");
	}),
	unarchiveBusinesses: catchAsync(async (req, res) => {
		const response = await businesses.unarchiveBusinesses(req.body, res.locals.user);
		res.jsend.success(response, "Businesses unarchived successfully");
	}),
	cloneBusiness: catchAsync(async (req, res) => {
		const response = await CloneBusiness.cloneBusiness(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Business cloned successfully");
	}),
	searchCustomerBusinesses: catchAsync(async (req, res) => {
		const response = await searchCustomerBusinesses(req.params, req.query);
		res.jsend.success(response, "Businesses searched successfully");
	}),
	sendOwnerUpdatedEvent: catchAsync(async (req, res) => {
		const { ownerID } = req.params;
		const response = await Owners.sendOwnerUpdateEvent(ownerID);
		res.jsend.success(response, "Owner updated event sent successfully");
	}),

	checkDisposableDomain: catchAsync(async (req, res) => {
		const { domain } = req.query;
		const normalizedDomain = domain.toLowerCase();
		const isDisposable = DISPOSABLE_DOMAINS_SET.has(normalizedDomain);
		res.jsend.success({ isDisposable }, "Domain checked successfully");
	}),
	saveBusinessState: catchAsync(async (req, res) => {
		const { businessID } = req.params;
		const businessState = await BusinessState.forBusiness(businessID);
		const response = await businessState.saveState();
		res.jsend.success(response, "Business state saved successfully");
	}),
	getCustomFieldTemplate: catchAsync(async (req, res) => {
		const { customerID } = req.params;
		const response = await onboarding.getCurrentOnboardingTemplate(customerID);
		res.jsend.success(response ?? null, "Custom field template fetched successfully");
	}),

	getCustomFieldDefinitions: catchAsync(async (req, res) => {
		const { templateId } = req.params;
		const response = await onboardingServiceRepository.getCustomFields(templateId);
		res.jsend.success(response, "Custom field definitions fetched successfully");
	}),

	getBusinessCustomFieldValues: catchAsync(async (req, res) => {
		const { businessID, caseID } = req.params;
		const { templateId } = req.query;
		const response = await onboardingServiceRepository.getActiveBusinessCustomFieldValues(
			businessID,
			caseID,
			templateId
		);
		res.jsend.success(response, "Custom field values fetched successfully");
	}),

	updateBusinessCustomFieldValues: catchAsync(async (req, res) => {
		const { businessID, caseID } = req.params;
		const { businessId, templateId, fields, userId } = req.body;
		const response = await businesses.addOrUpdateCustomFields(
			{ caseID },
			{ businessId: businessId || businessID, templateId, fields },
			[],
			{ user_id: userId }
		);
		res.jsend.success(response, "Custom fields updated successfully");
	})
};
