import { INTEGRATION_ID, type IntegrationPlatformId } from "#constants";
import businessLookupHelper from "#helpers/businessLookupHelper";
import { AccountingRest } from "#api/v1/modules/accounting/accountingRest";
import { db } from "#helpers/knex";
import { publicRecords } from "#api/v1/modules/public-records/public-records";
import { logger } from "#helpers/logger";
import { confidenceScore, getBusinessCustomers, getScoreByBusinessId, TIN_BEHAVIOR } from "#helpers/api";
import currency from "currency.js";

import type { FactSource } from "./types";
import type { UUID } from "crypto";
import type { ZoomInfoResponse } from "#lib/zoominfo/types";
import type { NPIResponse } from "#lib/npi/types";
import type { OpenCorporateResponse } from "#lib/opencorporates/types";
import type { EquifaxCombined } from "#lib/equifax/types";
import type { GetBusinessEntityReview } from "#api/v1/modules/verification/types";
import type { ReportResponse } from "#api/v1/modules/accounting/types";
import type { IDBConnection, IIdentityVerification, IRequestResponse, IBusinessEntityAddressSource, IBusinessEntityReviewTask } from "#types/db";
import type { FactEngine } from "./factEngine";
import type * as VerdataType from "#lib/verdata/types";
import type { BusinessEntityVerificationResponse } from "#lib/middesk";
import type { SerpScrapeResponseSchema } from "#api/v1/modules/data-scrape/schema";
import type { AINaicsEnrichmentResponse } from "#lib/aiEnrichment/aiNaicsEnrichment";
import type { AIWebsiteEnrichmentResponse } from "#lib/aiEnrichment/aiWebsiteEnrichment";
import type { CanadaOpenEntityMatchTask } from "#lib/canadaOpen/types";
import type { IdentityVerification as PlaidIdentityVerification } from "plaid";
import { NormalizedBusiness } from "#lib/business/normalizedBusiness";
import { confidenceScoreMany } from "#helpers/api";
import { KYX } from "#lib/kyx/kyx";
import { extractWatchlistResultsFromTruliooResponse } from "#lib/trulioo/common/utils";
import { TruliooPersonSourceHelper } from "./helpers/truliooPersonSourceHelper";

export const MAX_CONFIDENCE_INDEX = 55;

/* Helper to pull confidence, updatedAt, and raw response from the request_response table */
type ConfidenceGetter<T = any> = (rawResponse: T) => number | undefined;
type UpdatedAtGetter<T = any> = (requestResponse: IRequestResponse<T>) => Date | undefined;
type RequestResponseGetters = {
	confidence: ConfidenceGetter;
	updatedAt: UpdatedAtGetter;
};
const getFromRequestResponse = async <T extends any = any>(
	businessID: string,
	params: { platform_id?: IntegrationPlatformId | IntegrationPlatformId[]; request_type?: string; org_id?: string },
	getters?: Partial<RequestResponseGetters>
): Promise<[T, ReturnType<ConfidenceGetter>, ReturnType<UpdatedAtGetter>]> => {
	// Handle if platform_id is an array, make it an IN clause

	const query = db("integration_data.request_response")
		.select("response", "requested_at", "request_received")
		.where({ business_id: businessID })
		.orderBy("requested_at", "DESC")
		.limit(1)
		.first();
	for (const param in params) {
		if (Array.isArray(params[param])) {
			query.whereIn(param, params[param]);
		} else {
			query.andWhere({ [param]: params[param] });
		}
	}

	const defaultConfidenceGetter = rawResponse => {
		let index: unknown | null = rawResponse?.match?.index ?? null;
		if (typeof index === "string") {
			index = parseInt(index);
		}
		if (typeof index === "number" && Number.isInteger(index) && index > 0) {
			return index / MAX_CONFIDENCE_INDEX;
		}
		return undefined;
	};
	const defaultUpdatedAtGetter = requestResponse =>
		(requestResponse?.request_received ?? requestResponse?.requested_at) as Date | undefined;

	const queryResponse: IRequestResponse<T> = await query;

	const confidenceGetter = getters?.confidence ?? defaultConfidenceGetter;
	const confidence = confidenceGetter(queryResponse?.response);
	const updatedAtGetter = getters?.updatedAt ?? defaultUpdatedAtGetter;
	const updatedAt = updatedAtGetter(queryResponse);

	return [queryResponse?.response, confidence, updatedAt];
};

/**
 * Get ALL request_response records for a business matching the given params
 * This is useful when multiple records exist (e.g., one per owner for PSC screening)
 * @param businessID - Business ID
 * @param params - Query parameters (platform_id, request_type, org_id)
 * @returns Array of all matching request_response records
 */
const getAllFromRequestResponse = async <T extends any = any>(
	businessID: string,
	params: { platform_id?: IntegrationPlatformId | IntegrationPlatformId[]; request_type?: string | string[]; org_id?: string }
): Promise<IRequestResponse<T>[]> => {
	const query = db("integration_data.request_response")
		.select("response", "requested_at", "request_received", "request_id", "external_id")
		.where({ business_id: businessID })
		.orderBy("requested_at", "DESC");

	for (const param in params) {
		if (Array.isArray(params[param])) {
			query.whereIn(param, params[param]);
		} else {
			query.andWhere({ [param]: params[param] });
		}
	}

	return await query;
};

/* Maintain the sources here, the exported `sources` object is used in the FactEngine */
const dictionary = {
	AINaicsEnrichment: {
		category: "business",
		scope: "business",
		platformId: INTEGRATION_ID.AI_NAICS_ENRICHMENT,
		getter: async function (businessID: any) {
			const [response, confidence, updatedAt] = await getFromRequestResponse<AINaicsEnrichmentResponse>(
				businessID,
				{ platform_id: INTEGRATION_ID.AI_NAICS_ENRICHMENT, request_type: "perform_business_enrichment" },
				{ confidence: response => response?.confidence }
			);
			this.confidence = confidence ?? undefined;
			this.updatedAt = updatedAt ?? undefined;
			return response;
		}
	} as Omit<FactSource<any>, "name">,
	AIWebsiteEnrichment: {
		category: "business",
		scope: "business",
		platformId: INTEGRATION_ID.AI_WEBSITE_ENRICHMENT,
		getter: async function (businessID: any) {
			const [response, confidence, updatedAt] = await getFromRequestResponse<AIWebsiteEnrichmentResponse>(
				businessID,
				{ platform_id: INTEGRATION_ID.AI_WEBSITE_ENRICHMENT, request_type: "perform_business_enrichment" },
				{ confidence: response => response?.confidence }
			);
			this.confidence = confidence ?? undefined;
			this.updatedAt = updatedAt ?? undefined;
			return response;
		}
	} as Omit<FactSource<any>, "name">,
	businessDetails: {
		category: "business",
		scope: "business",
		confidence: 1,
		weight: 10,
		platformId: 0,
		getter: async function (businessID: any) {
			const business = await businessLookupHelper({ businessID, tinBehavior: TIN_BEHAVIOR.PLAIN });
			const businessRecord = business?.[0];
			if (!businessRecord) {
				return;
			}
			this.updatedAt = businessRecord.updated_at ?? undefined;
			return businessRecord;
		}
	},
	businessCustomers: {
		platformId: 0,
		category: "business",
		scope: "business",
		confidence: 1,
		getter: async (businessID: any) => getBusinessCustomers(businessID)
	},
	canadaopen: {
		category: "kyb",
		scope: "business",
		platformId: INTEGRATION_ID.CANADA_OPEN,
		weight: 1,
		getter: async function (businessID: any) {
			const [response, confidence, updatedAt] = await getFromRequestResponse<CanadaOpenEntityMatchTask>(
				businessID,
				{ platform_id: INTEGRATION_ID.CANADA_OPEN },
				{ confidence: rawResponse => rawResponse?.prediction }
			);
			if (!response) {
				return;
			}
			this.confidence = confidence ?? undefined;
			this.updatedAt = updatedAt ?? undefined;
			return response?.business && response;
		}
	},
	middesk: {
		category: "kyb",
		scope: "business",
		platformId: INTEGRATION_ID.MIDDESK,
		weight: 1,
		getter: async function (businessID: any, engine: FactEngine) {
			try {
				// Lazy import to avoid circular dependency during module initialization
				const { getBusinessEntityVerificationService } = require("#api/v1/modules/verification/businessEntityVerification");
				const service = await getBusinessEntityVerificationService(businessID);
				const middeskRecord = await service.getBusinessEntityReview(
					{ businessID, platformID: INTEGRATION_ID.MIDDESK },
					{ user_id: businessID, role: { id: 1, code: "admin" } }
				);
				// Calculate a confidence based upon how many review tasks passed
				const isTaskSuccess = (middesk, taskKey: string): boolean => {
					return (middesk?.reviewTasks?.find((task: any) => task.key === taskKey) as any)?.status === "success";
				};

				// Gather confidence scores from warehouse service first.
				if (middeskRecord?.businessEntityVerification && middeskRecord?.names && middeskRecord?.addressSources) {
					let middeskNormalizedBusinesses = NormalizedBusiness.fromBusinessEntityReviewComplete(businessID, {
						names: middeskRecord.names,
						addressSources: middeskRecord.addressSources
					});

					// Get normalized business from business details (Customer submitted)
					let submittedNormalizedBusinesses = await NormalizedBusiness.fromCustomerSubmission(businessID);

					// If we have both a submitted business and a middesk normalized business, run confidence scoring
					if (submittedNormalizedBusinesses && middeskNormalizedBusinesses) {
						try {
							const result = await confidenceScoreMany(submittedNormalizedBusinesses, middeskNormalizedBusinesses);

							// Set confidence to the highest confidence we get from middesk
							if (result && result.length > 0) {
								this.confidence = Math.max(...result.map(r => r.prediction));
							}
						} catch (err: unknown) {
							logger.warn(err, `Could not run confidence score for middesk`);
						}
					}
				}

				// if we still don't have a confidence score, fall back to calculating it ourselves
				if (middeskRecord?.businessEntityVerification?.external_id && !this.confidence) {
					let confidence = 0.15;
					confidence += isTaskSuccess(middeskRecord, "name") ? 0.2 : 0;
					confidence += isTaskSuccess(middeskRecord, "tin") ? 0.2 : 0;
					confidence += isTaskSuccess(middeskRecord, "address_verification") ? 0.2 : 0;
					confidence += isTaskSuccess(middeskRecord, "sos_match") ? 0.2 : 0;
					this.confidence = confidence;
				}

				this.updatedAt = (middeskRecord.reviewTasks?.[0]?.updated_at ?? undefined) as Date | undefined;
				return middeskRecord;
			} catch (ex) {
				logger.error({ error: ex }, "business entity verification failed");
				return {};
			}
		}
	} as Omit<FactSource<GetBusinessEntityReview>, "name">,
	middeskRaw: {
		category: "kyb",
		platformId: INTEGRATION_ID.MIDDESK,
		scope: "business",
		weight: 2,
		getter: async function (businessID: any, engine: FactEngine) {
			const [middeskRecord, confidence, updatedAt] = await getFromRequestResponse(businessID, {
				platform_id: INTEGRATION_ID.MIDDESK
			});
			if (!middeskRecord) {
				return;
			}
			const isTaskSuccess = (middesk, taskKey: string): boolean => {
				return middesk?.review.tasks?.find(task => task.key === taskKey)?.status === "success";
			};
			// Base of .16 just for having a record at all -- giving it a slightly higher confidence than middeskRaw
			if (middeskRecord?.external_id) {
				let confidence = 0.15;
				confidence += isTaskSuccess(middeskRecord, "name") ? 0.2 : 0;
				confidence += isTaskSuccess(middeskRecord, "tin") ? 0.2 : 0;
				confidence += isTaskSuccess(middeskRecord, "address_verification") ? 0.2 : 0;
				confidence += isTaskSuccess(middeskRecord, "sos_match") ? 0.2 : 0;
			}
			this.confidence = confidence;
			this.updatedAt = updatedAt ?? undefined;
			return middeskRecord;
		}
	} as Omit<FactSource<BusinessEntityVerificationResponse>, "name">,
	zoominfo: {
		category: "kyb",
		platformId: INTEGRATION_ID.ZOOMINFO,
		scope: "business",
		weight: 0.8,
		getter: async function (businessID: any) {
			const [response, index, updatedAt] = await getFromRequestResponse<ZoomInfoResponse>(businessID, {
				platform_id: INTEGRATION_ID.ZOOMINFO
			});
			if (!response) {
				return;
			}
			this.confidence = index ?? undefined;
			this.updatedAt = updatedAt ?? undefined;
			return response?.firmographic && response;
		}
	} as Omit<FactSource<ZoomInfoResponse>, "name">,
	opencorporates: {
		category: "kyb",
		platformId: INTEGRATION_ID.OPENCORPORATES,
		weight: 0.9,
		scope: "business",
		getter: async function (businessID: any) {
			const [response, confidence, updatedAt] = await getFromRequestResponse<OpenCorporateResponse>(businessID, {
				platform_id: INTEGRATION_ID.OPENCORPORATES
			});
			if (!response) {
				return;
			}
			this.confidence = confidence ?? undefined;
			this.updatedAt = updatedAt ?? undefined;
			return response?.firmographic && response;
		}
	} as Omit<FactSource<OpenCorporateResponse>, "name">,
	equifax: {
		category: "publicRecords",
		platformId: INTEGRATION_ID.EQUIFAX,
		scope: "business",
		weight: 0.7, // Equifax has a low weight because it relies upon manual files being ingested at some unknown cadence
		getter: async function (businessID: any) {
			const queryResult = await db("integration_data.request_response")
				.join(
					"integrations.data_business_integrations_tasks",
					"request_response.request_id",
					"data_business_integrations_tasks.id"
				)
				.select(
					"data_business_integrations_tasks.metadata",
					"request_response.response",
					"request_response.requested_at"
				)
				.where({ business_id: businessID, platform_id: INTEGRATION_ID.EQUIFAX, request_type: "fetch_public_records" })
				.andWhereRaw("response->>'efx_id' is not null")
				.orderBy("requested_at", "DESC")
				.limit(1)
				.first();
			if (!queryResult?.metadata) {
				// exit early if no metadata because we have no match
				return;
			}
			const match = queryResult.metadata?.match;
			// Select from all the possible ways we ever scored Equifax
			// match.prediction is the most recent using the AI prediction score
			// match.index is from heuristic matching pulling rows from Redshift
			// queryResult.metadata.result.matches.score is from the earliest iteration of Equifax via Athena
			this.confidence = match?.prediction
				? match.prediction
				: match?.index
					? match.index / MAX_CONFIDENCE_INDEX
					: queryResult.metadata?.result?.matches?.score
						? queryResult.metadata?.result?.matches?.score / MAX_CONFIDENCE_INDEX
						: undefined;
			const response = { ...queryResult.metadata?.result, ...queryResult.response };
			this.updatedAt = queryResult.requested_at ?? undefined;
			return response;
		}
	} as Omit<FactSource<EquifaxCombined>, "name">,
	equifax_supplemental: {
		category: "publicRecords",
		description:
			"Fetches additional fields from Equifax: number_of_employees, woman_owned_enterprise, veteran_owned_enterprise, minority_business_enterprise",
		platformId: INTEGRATION_ID.EQUIFAX,
		scope: "business",
		weight: 0.7,
		getter: async function (businessID: any) {
			const fields = await db("integration_data.request_response")
				.select("response")
				.where({ business_id: businessID, platform_id: INTEGRATION_ID.EQUIFAX, request_type: "fetch_public_records" })
				.andWhereRaw(
					" nullif(response->>'additional_fields','') is not null  and nullif(response->'additional_fields'->>'number_of_employees','') is not null"
				)
				.orderBy("requested_at", "DESC")
				.limit(1)
				.first();
			if (fields?.response?.match?.index) {
				// Use a local variable instead of trying to assign to read-only property
				const confidenceValue = fields.response.match.index / MAX_CONFIDENCE_INDEX;
				// We can't directly assign to this.confidence as it's read-only
				Object.defineProperty(this, "confidence", { value: confidenceValue });
			}
			return fields?.response?.additional_fields;
		}
	} as Omit<FactSource<any>, "name">,
	npi_reverse_lookup: {
		category: "kyb",
		platformId: INTEGRATION_ID.NPI,
		scope: "business",
		getter: async function (businessID: any) {
			const [response, index] = await getFromRequestResponse<NPIResponse>(businessID, {
				platform_id: INTEGRATION_ID.NPI
			});
			if (!response) {
				return;
			}
			this.confidence = index ?? undefined;
			return response;
		}
	} as Omit<FactSource<NPIResponse>, "name">,
	npiHealthcare: {
		category: "kyb",
		platformId: INTEGRATION_ID.NPI,
		scope: "business",
		confidence: 1,
		getter: async function (businessID: any) {
			const result = await db("integration_data.healthcare_provider_information")
				.where({ business_id: businessID })
				.orderBy("created_at", "desc")
				.first();
			if (!result) {
				return;
			}
			this.updatedAt = result.updated_at ?? result.created_at ?? undefined;
			return result;
		}
	},
	verdataRaw: {
		category: "publicRecords",
		platformId: INTEGRATION_ID.VERDATA,
		scope: "business",
		weight: 0.8, // Lower the weight of Verdata because it's not as reliable as some other sources
		getter: async function (businessID: any) {
			const [response, _, updatedAt] = await getFromRequestResponse<VerdataType.Record>(businessID, {
				platform_id: INTEGRATION_ID.VERDATA
			});

			let customerBusiness = await NormalizedBusiness.fromCustomerSubmission(businessID);
			let verdataBusiness = NormalizedBusiness.fromPublicRecord(businessID, response);

			// If we have both a submitted business and a verdata business, run confidence scoring
			if (customerBusiness && verdataBusiness) {
				try {
					const confidenceResult = await confidenceScore({
						business: customerBusiness,
						integration_business: verdataBusiness
					});

					if (confidenceResult) {
						this.confidence = confidenceResult.prediction;
					}
				} catch (err: unknown) {
					logger.warn(err, `Could not run confidence score for verdata`);
				}
			}

			// Calculate a confidence based upon what matches
			if (response?.match_score?.score && !this.confidence) {
				let confidence = 0;
				// Sum up name & address scores them divide by 2 to get the actual score.
				confidence = currency(response.match_score.name_score).add(response.match_score.addr_score).divide(2).value;
				if (confidence === 1) {
					confidence = 0.95; // Force it to not be 100% confident. That's just arrogant.
				}
				this.confidence = confidence;
			}
			this.updatedAt = updatedAt ?? undefined;
			return response?.seller && response;
		}
	},
	verdata: {
		category: "publicRecords",
		platformId: INTEGRATION_ID.VERDATA,
		scope: "business",
		getter: async (businessID: any) => {
			return await db("integration_data.public_records")
				.select("public_records.*")
				.join(
					"data_business_integrations_tasks",
					"public_records.business_integration_task_id",
					"data_business_integrations_tasks.id"
				)
				.join("data_connections", "data_business_integrations_tasks.connection_id", "data_connections.id")
				.where({ "data_connections.business_id": businessID, "data_connections.platform_id": INTEGRATION_ID.VERDATA })
				.orderBy("public_records.created_at", "DESC")
				.limit(1)
				.first();
		}
	},
	verdataCase: {
		category: "publicRecords",
		platformId: INTEGRATION_ID.VERDATA,
		scope: "case",
		getter: async (caseID: UUID) => {
			// Get businessId from case
			const businessId = await db("data_cases").select("business_id").where({ id: caseID }).first();
			if (businessId) {
				return publicRecords.getPublicRecords(businessId, { case_id: caseID });
			}
			return {};
		}
	},
	manualCustomer: {
		platformId: INTEGRATION_ID.MANUAL,
		category: "business",
		scope: "customerbusiness",
		weight: 0.1,
		confidence: 0.1,
		getter: async (request: { customer_id: string; business_id: string }) => {
			const [response] = await getFromRequestResponse(request.business_id, {
				platform_id: INTEGRATION_ID.MANUAL,
				org_id: request.customer_id
			});
			return response;
		}
	},
	manualCase: {
		platformId: INTEGRATION_ID.MANUAL,
		category: "business",
		scope: "case",
		weight: 0.1,
		confidence: 0.1,
		getter: async (case_id: string) => {
			// Resolve case_id to business_id and customer_id
			const caseRecord = await db("data_cases").select(["business_id", "customer_id"]).where({ id: case_id }).first();
			const [response] = await getFromRequestResponse(caseRecord.business_id, {
				platform_id: INTEGRATION_ID.MANUAL,
				org_id: caseRecord.customer_id
			});
			return response;
		}
	},
	manual: {
		platformId: INTEGRATION_ID.MANUAL,
		category: "business",
		scope: "business",
		getter: async function (business_id: string) {
			const [response, _, updatedAt] = await getFromRequestResponse(business_id, {
				platform_id: INTEGRATION_ID.MANUAL,
				request_type: "fact_override"
			});
			this.updatedAt = updatedAt ?? undefined;
			return response;
		}
	},
	serp: {
		platformId: INTEGRATION_ID.SERP_SCRAPE,
		category: "publicRecords",
		scope: "business",
		getter: async function (businessID: any) {
			const [response, _, updatedAt] = await getFromRequestResponse<SerpScrapeResponseSchema>(businessID, {
				platform_id: INTEGRATION_ID.SERP_SCRAPE
			});
			if (!response) {
				return;
			}

			// If we have both a submitted business and a serp business, run confidence scoring
			let customerBusiness = await NormalizedBusiness.fromCustomerSubmission(businessID);
			let serpBusiness = NormalizedBusiness.fromSerpScrapeResponse(businessID, response);

			if (customerBusiness && serpBusiness) {
				try {
					const confidenceResult = await confidenceScore({
						business: customerBusiness,
						integration_business: serpBusiness
					});

					if (confidenceResult) {
						this.confidence = confidenceResult.prediction;
					}
				} catch (err: unknown) {
					logger.warn(err, `Could not run confidence score for serp`);
				}
			}

			// Calculate a confidence for the response
			if (!this.confidence) {
				let confidence = 0;
				if (response?.businessMatch) {
					confidence = confidence + 0.5;
					if (response.local_results?.length == 0) {
						confidence = confidence + 0.3;
					}
				}
				this.confidence = confidence;
				this.updatedAt = updatedAt ?? undefined;
			}
			return response.businessMatch && response;
		}
	},
	googlePlacesRatings: {
		platformId: INTEGRATION_ID.GOOGLE_PLACES_REVIEWS,
		category: "publicRecords",
		scope: "business",
		getter: async (businessID: any) => {
			const thisYear = new Date().getFullYear();
			const lastYear = thisYear - 1;
			const [lastYearReviews, thisYearReviews] = await Promise.all([
				publicRecords.getGoogleBusinessRatings({ businessID }, { year: lastYear }),
				publicRecords.getGoogleBusinessRatings({ businessID }, { year: thisYear })
			]);
			if (!lastYearReviews || !thisYearReviews) {
				return;
			}
			// Return "this year" if there are reviews, last year if not
			return thisYearReviews?.records?.length > 1 ? thisYearReviews : lastYearReviews;
		}
	},
	accountingBalanceSheets: {
		category: "accounting",
		scope: "business",
		platformId: -1,
		getter: async (business_id: any): Promise<ReportResponse> =>
			AccountingRest.getReport({ business_id, report: "accounting_balancesheet", params: { groupBy: "year" } })
	},
	accountingIncomeStatements: {
		platformId: -1,
		category: "accounting",
		scope: "business",
		confidence: 0.99,
		getter: async (business_id: any): Promise<ReportResponse> => {
			return AccountingRest.getReport({
				business_id,
				report: "accounting_incomestatement",
				params: { groupBy: "year" }
			});
		}
	} as Omit<FactSource<ReportResponse>, "name">,
	accountingCashFlows: {
		platformId: -1,
		category: "accounting",
		scope: "business",
		confidence: 0.99,
		getter: async (business_id: any): Promise<ReportResponse> =>
			AccountingRest.getReport({ business_id, report: "accounting_cashflow", params: { groupBy: "year" } })
	},
	accountingBalanceSheetsS3: {
		platformId: -1,
		category: "accounting",
		scope: "business",
		confidence: 0.99,
		getter: async (business_id: any): Promise<any> => {
			const { getRawIntegrationDataFromS3 } = await import("#common/index");
			const { DIRECTORIES } = await import("#constants/s3-directories.constant");
			// Handle S3 data format from Rutter
			const s3RutterData = await getRawIntegrationDataFromS3(
				business_id,
				"balancesheet",
				DIRECTORIES.ACCOUNTING,
				"rutter",
				false
			);
			if (s3RutterData && s3RutterData.length > 0) {
				return s3RutterData;
			}
			// else handle S3 data format from Plaid
			const s3PLAIDData = await getRawIntegrationDataFromS3(
				business_id,
				"balancesheet",
				DIRECTORIES.ACCOUNTING,
				"PLAID",
				false
			);
			if (s3PLAIDData && s3PLAIDData?.balance_sheets) {
				return s3PLAIDData?.balance_sheets;
			}
		}
	},
	accountingAccountReceivableS3: {
		platformId: -1,
		category: "accounting",
		scope: "business",
		confidence: 0.99,
		getter: async (business_id: any): Promise<any> => {
			const { getRawIntegrationDataFromS3 } = await import("#common/index");
			const { DIRECTORIES } = await import("#constants/s3-directories.constant");
			const s3RutterData = await getRawIntegrationDataFromS3(
				business_id,
				"accounts_receivable",
				DIRECTORIES.ACCOUNTING,
				"rutter",
				false
			);
			if (s3RutterData && s3RutterData.length > 0) {
				return s3RutterData;
			}
		}
	},
	accountingAccountPayableS3: {
		platformId: -1,
		category: "accounting",
		scope: "business",
		confidence: 0.99,
		getter: async (business_id: any): Promise<any> => {
			const { getRawIntegrationDataFromS3 } = await import("#common/index");
			const { DIRECTORIES } = await import("#constants/s3-directories.constant");
			const s3RutterData = await getRawIntegrationDataFromS3(
				business_id,
				"accounts_payable",
				DIRECTORIES.ACCOUNTING,
				"rutter",
				false
			);
			if (s3RutterData && s3RutterData.length > 0) {
				return s3RutterData;
			}
		}
	},
	accountingIncomeStatementsS3: {
		platformId: -1,
		category: "accounting",
		scope: "business",
		confidence: 0.99,
		getter: async (business_id: any): Promise<any> => {
			const { getRawIntegrationDataFromS3 } = await import("#common/index");
			const { DIRECTORIES } = await import("#constants/s3-directories.constant");
			// Handle S3 data format from Rutter
			const s3RutterData = await getRawIntegrationDataFromS3(
				business_id,
				"incomestatement",
				DIRECTORIES.ACCOUNTING,
				"rutter",
				false
			);
			if (s3RutterData && s3RutterData.length > 0) {
				return s3RutterData;
			}
			// else handle S3 data format from Plaid
			const s3PLAIDData = await getRawIntegrationDataFromS3(
				business_id,
				"incomestatement",
				DIRECTORIES.ACCOUNTING,
				"PLAID",
				false
			);
			if (s3PLAIDData && s3PLAIDData?.income_statements) {
				return s3PLAIDData?.income_statements;
			}
		}
	},
	accountingCashFlowsS3: {
		platformId: -1,
		category: "accounting",
		scope: "business",
		confidence: 0.99,
		getter: async (business_id: any): Promise<any> => {
			const { getRawIntegrationDataFromS3 } = await import("#common/index");
			const { DIRECTORIES } = await import("#constants/s3-directories.constant");
			// Handle S3 data format from Rutter
			const s3RutterData = await getRawIntegrationDataFromS3(
				business_id,
				"cashflow",
				DIRECTORIES.ACCOUNTING,
				"rutter",
				false
			);
			if (s3RutterData && s3RutterData.length > 0) {
				return s3RutterData;
			}
			// else handle S3 data format from Plaid
			const s3PLAIDData = await getRawIntegrationDataFromS3(
				business_id,
				"cashflow",
				DIRECTORIES.ACCOUNTING,
				"PLAID",
				false
			);
			if (s3PLAIDData && s3PLAIDData?.cash_flows) {
				return s3PLAIDData?.cash_flows;
			}
		}
	},
	accountingBalanceSheetsCase: {
		platformId: -1,
		category: "accounting",
		scope: "case",
		confidence: 0.99,
		getter: async (case_id: any) =>
			AccountingRest.getReport({ case_id, report: "accounting_balancesheet", params: { groupBy: "year" } })
	},
	accountingIncomeStatementsCase: {
		platformId: -1,
		category: "accounting",
		scope: "case",
		confidence: 0.99,
		getter: async (case_id: any) =>
			AccountingRest.getReport({ case_id, report: "accounting_incomestatement", params: { groupBy: "year" } })
	},
	accountingCashFlowsCase: {
		platformId: -1,
		category: "accounting",
		scope: "case",
		confidence: 0.99,
		getter: async (case_id: any) =>
			AccountingRest.getReport({ case_id, report: "accounting_cashflow", params: { groupBy: "year" } })
	},
	connectionConfigs: {
		platformId: 0,
		category: "business",
		scope: "business",
		getter: async (businessID: any): Promise<IDBConnection[]> => {
			const connectionConfigs = await db<IDBConnection>("data_connections")
				.select("*")
				.where({ business_id: businessID });
			return connectionConfigs;
		}
	} as Omit<FactSource<any>, "name">,
	plaidIdv: {
		category: "business",
		scope: "business",
		platformId: INTEGRATION_ID.PLAID_IDV,
		getter: async (businessID: any): Promise<IIdentityVerification<PlaidIdentityVerification>[]> => {
			const idvRows = await db("integration_data.identity_verification").select("*").where({ business_id: businessID });
			return idvRows;
		}
	} as Omit<FactSource<any>, "name">,
	business: {
		category: "kyb",
		scope: "business",
		platformId: INTEGRATION_ID.TRULIOO,
		weight: 0.8, // High weight for UK/Canada businesses
		getter: async function (businessID: UUID) {
			const [response, _, updatedAt] = await getFromRequestResponse(businessID, {
				platform_id: INTEGRATION_ID.TRULIOO,
				request_type: "fetch_business_entity_verification"
			});
			if (!response) {
				return;
			}

			// Always extract watchlist results from fullServiceDetails to ensure we use subjectMatched correctly
			// This reprocesses watchlist results even if they were previously stored with incorrect values
			if (response?.clientData) {
				const watchlistResults = extractWatchlistResultsFromTruliooResponse(response.clientData);
				if (watchlistResults?.length) {
					response.clientData.watchlistResults = watchlistResults;
				}
			}

			const businessData = response?.clientData?.businessData;

			// Try to get confidence from warehouse service (confidence scoring)
			// This requires both customer-submitted business and Trulioo business data
			let customerBusiness = await NormalizedBusiness.fromCustomerSubmission(businessID);
			let truliooBusiness = businessData ? NormalizedBusiness.fromTrulioo(businessID, businessData) : undefined;

			// If we have both customer and Trulioo businesses, run confidence scoring
			if (customerBusiness && truliooBusiness) {
				try {
					const confidenceResult = await confidenceScore({
						business: customerBusiness,
						integration_business: truliooBusiness
					});

					if (confidenceResult) {
						this.confidence = confidenceResult.prediction;
					}
				} catch (err: unknown) {
					logger.warn(`Could not run confidence score for trulioo: ${err}`);
				}
			}

			// Fallback: Calculate confidence based on verification status and data quality
			if (!this.confidence) {
				let calculatedConfidence = 0;
				const status = response?.clientData?.status;

				// Base confidence from verification status
				if (status === "completed" || status === "success") {
					calculatedConfidence = 0.7; // High confidence for successful verification
				} else if (status === "pending" || status === "in_progress") {
					calculatedConfidence = 0.4; // Lower confidence for pending verification
				} else if (status === "failed" || status === "error" || status === "REJECTED") {
					calculatedConfidence = 0.2; // Low confidence for failed verification
				} else {
					calculatedConfidence = 0.3; // Default confidence for unknown status
				}

				// Increase confidence based on data completeness
				if (businessData) {
					if (businessData.name) calculatedConfidence += 0.1;
					if (businessData.address || businessData.business_addresses?.length > 0) calculatedConfidence += 0.1;
					if (businessData.ubos?.length > 0 || businessData.directors?.length > 0) calculatedConfidence += 0.05;
				}

				// Cap confidence at 0.95 (never 100% confident)
				if (calculatedConfidence > 0.95) {
					calculatedConfidence = 0.95;
				}

				this.confidence = calculatedConfidence;
			}

			this.updatedAt = updatedAt ?? undefined;

			// Get addressSources and reviewTasks from database using the same pattern as getBusinessEntityReview
			let addressSources: IBusinessEntityAddressSource[] = [];
			let reviewTasks: IBusinessEntityReviewTask[] = [];
			try {
				const businessEntityVerification = await db<{ id: UUID }>("integration_data.business_entity_verification")
					.select("integration_data.business_entity_verification.id")
					.where("integration_data.business_entity_verification.business_id", businessID)
					.join(
						"integrations.data_business_integrations_tasks",
						"integration_data.business_entity_verification.business_integration_task_id",
						"integrations.data_business_integrations_tasks.id"
					)
					.join(
						"integrations.data_connections",
						"integrations.data_business_integrations_tasks.connection_id",
						"integrations.data_connections.id"
					)
					.where("integrations.data_connections.platform_id", INTEGRATION_ID.TRULIOO)
					.orderByRaw(`
						EXISTS(
							SELECT 1 FROM integration_data.business_entity_address_source
							WHERE business_entity_verification_id = integration_data.business_entity_verification.id
						) DESC,
						integration_data.business_entity_verification.created_at DESC
					`)
					.first();

				if (businessEntityVerification?.id) {
					const [addressSourcesResult, reviewTasksResult] = await Promise.all([
						db<IBusinessEntityAddressSource>("integration_data.business_entity_address_source")
							.select(
								"id",
								"business_entity_verification_id",
								"created_at",
								"updated_at",
								"external_id",
								"external_registration_id",
								"full_address",
								"address_line_1",
								"address_line_2",
								"city",
								"state",
								"postal_code",
								"submitted",
								"deliverable"
							)
							.where({ business_entity_verification_id: businessEntityVerification.id }),
						db<IBusinessEntityReviewTask>("integration_data.business_entity_review_task")
							.select(
								"id",
								"business_entity_verification_id",
								"created_at",
								"updated_at",
								"category",
								"key",
								"status",
								"message",
								"label",
								"sublabel",
								"metadata"
							)
							.where({ business_entity_verification_id: businessEntityVerification.id })
					]);

					addressSources = (addressSourcesResult || []) as IBusinessEntityAddressSource[];
					reviewTasks = (reviewTasksResult || []) as IBusinessEntityReviewTask[];
				}
			} catch (err) {
				logger.warn(`Could not fetch addressSources or reviewTasks for trulioo business ${businessID}: ${err instanceof Error ? err.message : String(err)}`);
			}

			// Return response with addressSources and reviewTasks added
			return {
				...(response || {}),
				addressSources: addressSources || [],
				reviewTasks: reviewTasks || []
			};
		}
	} as Omit<FactSource<any>, "name">,

	person: {
		category: "kyb",
		scope: "business",
		platformId: INTEGRATION_ID.TRULIOO,
		weight: 0.8, // High weight for UK/Canada businesses
		getter: async function (businessID: UUID) {
			// Get ALL PSC screening records for this business (one per owner)
			// Accept both request_type values (different code paths save with different types)
			const allRecords = await getAllFromRequestResponse(businessID, {
				platform_id: INTEGRATION_ID.TRULIOO,
				request_type: ["fetch_business_entity_verification_person", "fetch_business_person_verification"]
			});

			// When there are no PSC rows in request_response, load screened persons from business_entity_people
			// so the KYB Watchlists tab still shows hits (e.g. webhook updated people table but not request_response)
			if (!allRecords || allRecords.length === 0) {
				const loadedPersons = await TruliooPersonSourceHelper.loadScreenedPersonsFromPeopleTable(businessID);
				if (loadedPersons) {
					this.confidence = loadedPersons.confidence;
					this.updatedAt = loadedPersons.updatedAt;
					return { screenedPersons: loadedPersons.screenedPersons };
				}
				return;
			}

			// Process all PSC records and transform them
			const { screenedPersons, mostRecentUpdatedAt } = await TruliooPersonSourceHelper.processPSCRecords(
				businessID,
				allRecords
			);

			if (screenedPersons.length === 0) {
				return;
			}

			// Calculate confidence based on screening results
			const confidence = TruliooPersonSourceHelper.calculatePersonScreeningConfidence(screenedPersons);

			this.confidence = confidence;
			this.updatedAt = mostRecentUpdatedAt;

			return {
				screenedPersons
			};
		}
	} as Omit<FactSource<any>, "name">,

	kyx: {
		category: "kyb",
		scope: "business",
		platformId: INTEGRATION_ID.KYX,
		getter: async (businessId: any) => await KYX.getKYXResult({ businessId })
	} as Omit<FactSource<any>, "name">,

	ownerDetails: {
		category: "kyc",
		scope: "business",
		confidence: 1,
		weight: 10,
		platformId: 0,
		getter: async function (businessID: any) {
			// Use internal API to fetch owner data from case-service
			const { getOwnersUnencrypted } = await import("#helpers/api");
			const owners = await getOwnersUnencrypted(businessID);

			if (owners && owners.length > 0) {
				// Use the most recent updated_at from all owners
				const mostRecentUpdate = owners.reduce((latest: Date | null, owner: any) => {
					const ownerUpdated = owner.updated_at ? new Date(owner.updated_at) : null;
					if (!latest) return ownerUpdated;
					if (!ownerUpdated) return latest;
					return ownerUpdated > latest ? ownerUpdated : latest;
				}, null as Date | null);
				this.updatedAt = mostRecentUpdate ?? undefined;
			}
			return owners;
		}
	} as Omit<FactSource<any>, "name">,

	/**
	 * Owner verification data from Plaid IDV
	 * Fetches email report and fraud report data for all owners of a business
	 */
	ownerVerification: {
		category: "kyc",
		scope: "business",
		confidence: 1,
		weight: 10,
		platformId: INTEGRATION_ID.PLAID_IDV,
		getter: async function (businessID: any) {
			const { getOwnersUnencrypted } = await import("#helpers/api");
			const { PlaidIdv } = await import("#lib/plaid/plaidIdv");

			let owners;
			try {
				owners = await getOwnersUnencrypted(businessID);
			} catch (error) {
				logger.warn(`Failed to fetch owners for business ${businessID}: ${(error as Error).message}`);
				return {};
			}

			if (!owners || owners.length === 0) {
				return {};
			}

			const verificationMap: Record<string, any> = {};

			for (const owner of owners) {
				try {
					const verificationRecords = await PlaidIdv.getApplicantVerificationResponse(owner.id);
					if (verificationRecords && verificationRecords.length > 0) {
						const record = verificationRecords[0];
						const riskCheck = record.applicant?.risk_check_result;

						// Return only fields needed for Email Report and Fraud Report
						// Use ?? null to ensure all fields are present even when undefined
						verificationMap[owner.id] = {
							// Email Report fields
							email_report: riskCheck ? {
								name: riskCheck.name ?? null,
								email: owner.email ?? null,
								is_deliverable: riskCheck.email?.is_deliverable ?? null,
								breach_count: riskCheck.email?.breach_count ?? null,
								first_breached_at: riskCheck.email?.first_breached_at ?? (riskCheck.email as any)?.first_breach_date ?? null,
								last_breached_at: riskCheck.email?.last_breached_at ?? (riskCheck.email as any)?.last_breach_date ?? null,
								domain_registered_at: riskCheck.email?.domain_registered_at ?? null,
								domain_is_free_provider: riskCheck.email?.domain_is_free_provider ?? null,
								domain_is_disposable: riskCheck.email?.domain_is_disposable ?? null,
								top_level_domain_is_suspicious: riskCheck.email?.top_level_domain_is_suspicious ?? null,
								ip_spam_list_count: riskCheck.ip_spam_list_count ?? null,
							} : null,
							// Fraud Report fields
							fraud_report: riskCheck ? {
								name: riskCheck.name ?? null,
								user_interactions: riskCheck.user_interactions ?? null,
								fraud_ring_detected: riskCheck.fraud_ring_detected ?? null,
								bot_detected: riskCheck.bot_detected ?? null,
								synthetic_identity_risk_score: riskCheck.synthetic_identity_risk_score ?? null,
								stolen_identity_risk_score: riskCheck.stolen_identity_risk_score ?? null,
							} : null,
						};
					}
				} catch (error) {
					logger.warn(`Failed to fetch verification data for owner ${owner.id}: ${(error as Error).message}`);
				}
			}

			return verificationMap;
		}
	} as Omit<FactSource<any>, "name">,

/**
	 * Category completion history data
	 * Fetches the most recent completion timestamp for each category for a business
	 * Uses GROUP BY with MAX for efficient querying
	 */
	categoryCompletions: {
		category: "business",
		scope: "business",
		confidence: 1,
		weight: 10,
		platformId: 0,
		getter: async function (businessID: string) {
			// Use GROUP BY with MAX to get only the most recent completion per category
			const completions = await db("integration_data.data_category_completions_history")
				.select("category_id")
				.max("created_at as created_at")
				.where({ business_id: businessID })
				.groupBy("category_id");

			if (!completions || completions.length === 0) {
				return null;
			}

			// Build the category map from the already-grouped results
			// Convert Date objects to ISO strings (Knex returns Date objects for timestamps)
			const categoryMap: Record<number, string> = {};
			for (const record of completions) {
				const ts = record.created_at;
				categoryMap[record.category_id] = ts instanceof Date ? ts.toISOString() : ts;
			}

			return categoryMap;
		}
	},

	processingHistory: {
		category: "banking",
		scope: "business",
		confidence: 1,
		weight: 10,
		platformId: 0,
		getter: async function (businessID: any) {
			const record = await db("integration_data.data_processing_history as dph")
				.select("dph.*")
				.join("public.data_cases as dc", "dc.id", "dph.case_id")
				.where("dc.business_id", businessID)
				.orderBy("dph.created_at", "desc")
				.first();

			if (record) {
				this.updatedAt = record.updated_at ?? record.created_at ?? undefined;
			}
			return record;
		}
	} as Omit<FactSource<any>, "name">,

	adverseMediaDetails: {
		category: "kyb",
		scope: "business",
		platformId: INTEGRATION_ID.ADVERSE_MEDIA,
		weight: 1,
		getter: async function (businessID: UUID) {
			const adverseMediaRecords = await db("integration_data.adverse_media")
				.select(
					"id as adverse_media_id",
					"total_risk_count",
					"high_risk_count",
					"medium_risk_count",
					"low_risk_count",
					"average_risk_score",
					"updated_at"
				)
				.where({ business_id: businessID })
				.orderBy("updated_at", "desc");

			if (!adverseMediaRecords?.length) {
				return undefined;
			}

			this.updatedAt = adverseMediaRecords[0]?.updated_at ?? undefined;
			return {
				records: adverseMediaRecords
			};
		}
	} as Omit<FactSource<any>, "name">,

	worthScore: {
		category: "business",
		scope: "business",
		confidence: 1,
		weight: 10,
		platformId: 0,
		getter: async function (businessId: string) {
			const response = await getScoreByBusinessId(businessId);
			return response?.data ?? null;
		}
	} as Omit<FactSource<any>, "name">,

	normalize: {
		// a psuedo source that is used to normalize the calculated value of a fact
	} as FactSource<any>,
	calculated: {} as FactSource<any>,
	dependent: {} as FactSource<any>
} as const satisfies Record<string, Omit<FactSource, "name">>;

export type SourceName = keyof typeof dictionary;

const dictionaryWithNamesInjected = Object.entries(dictionary).reduce(
	(acc, [sourceName, source]) => {
		acc[sourceName as SourceName] = {
			...source,
			name: sourceName
		};
		return acc;
	},
	{} as Record<string, FactSource>
);

// Validate that dictionaryWithNamesInjected is not empty
if (Object.keys(dictionaryWithNamesInjected).length === 0) {
	throw new Error("dictionaryWithNamesInjected is empty - sources dictionary was not properly initialized");
}

/** Turn the raw sources into a Record so we can access the right source with sources.verdata for instance */
export const sources: Record<SourceName, FactSource> = Object.freeze(dictionaryWithNamesInjected) as Record<
	SourceName,
	FactSource
>;

// Validate that sources is properly initialized
if (!sources || Object.keys(sources).length === 0) {
	throw new Error("sources export is empty or undefined - this indicates a module initialization problem");
}
