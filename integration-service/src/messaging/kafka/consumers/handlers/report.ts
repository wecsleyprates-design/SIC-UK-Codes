import {
	IdvStatus,
	INTEGRATION_ID,
	kafkaEvents,
	kafkaTopics,
	TASK_STATUS,
	TAX_STATUS_FORMS,
	TAX_STATUS_FORMS_TYPE
} from "#constants/index";
import { isMultiIcaMatchResponse, isLegacySingleIcaResponse, MatchProData } from "#lib/match/types";
import { db, getOwners, getCase, logger, producer, sqlQuery, sqlTransaction, internalGetBusinessNamesAndAddresses } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { schema } from "./schema";
import {
	BankAccountBalanceChartData,
	BankAccountReportData,
	DepositsChartData,
	I360Report,
	IncomeVsExpensesChartData,
	ITaxFiling,
	OpenAccounts,
	PublicRecordsResponse,
	SpendingCategory,
	Top10BankAccountOperationByAmount,
	Financials,
	IncomeStatement,
	BalanceSheet,
	ExecutiveSummaryRevenue,
	KeyInsightsResponse
} from "./types";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { getBusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import { Equifax } from "#lib/equifax";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import { UUID } from "crypto";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { INTEGRATION_SETTING_KEYS } from "#constants/customer-integration-settings.constants";
import { publicRecords } from "#api/v1/modules/public-records/public-records";
import { getCachedSignedUrl, s3Utils } from "#utils";
import Fuse, { IFuseOptions } from "fuse.js";
import { AccountingRest } from "#api/v1/modules/accounting/accountingRest";
import { applicants } from "#api/v1/modules/applicants/applicants";
import { banking } from "#api/v1/modules/banking/banking";
import dayjs from "dayjs";
import { FactEngine } from "#lib/facts/factEngine";
import { getWorthWebsiteScanResponse, WorthWebsiteScanning } from "#lib/worthWebsiteScanning/worthWebsiteScanning";
import { envConfig } from "#configs";
import { allFacts } from "#lib/facts";
import type { Fact, FactName } from "#lib/facts/types";
import * as FactRules from "#lib/facts/rules";
import { bjlFacts } from "#lib/facts/bjl";
import { AddressUtil } from "#utils/addressUtil";
import { createWatchlistEntries } from "#helpers/report/createWatchlistEntries";
import { groupWatchlistHitsByEntityName } from "#helpers/report/createWatchlistEntries/groupWatchlistHitsByEntityName";
import { getGoogleProfileMatchResult } from "#api/v1/modules/data-scrape/dataScrape";
import { MatchUtil } from "#lib/match/matchUtil";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { adverseMedia } from "#api/v1/modules/adverse-media/adverse-media";

interface OwnerRiskScore {
	owner_id: string;
	name?: string;
	synthetic_identity_risk_score?: number;
	stolen_identity_risk_score?: number;
	status: IdvStatus;
	identity_verification_attempted: boolean;
	ssn_verification_status?: string | null;
}

class AggregateError extends Error {
	details: { function: string; message: string }[];

	constructor(message: string, details: { function: string; message: string }[]) {
		super(message);
		this.name = "AggregateError";
		this.details = details;
	}
}

class ReportEventsHandler {
	async handleEvent(message: any) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.FETCH_REPORT_DATA:
					validateMessage(schema.fetchReportData, payload);
					await this.fetchReportData(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async fetchReportData(body: I360Report) {
		try {
			const errors = new Map();
			const [
				companyDetailsAndIndustry,
				businessRegistrationData,
				contactInformationData,
				watchlistData,
				websiteData,
				ownerScoreData,
				riskScoreData,
				openAccountsData,
				publicRecordsData,
				taxData,
				financialsData,
				executiveSummaryRevenueData,
				executiveSummaryKeyInsightsData,
				matchProData,
				countryCodeData
			] = await Promise.all([
				this._getCompanyDetailsAndIndustry(body).catch(e => {
					logger.error(`_getCompanyDetailsAndIndustry error: ${e.message}`);
					errors.set("_getCompanyDetailsAndIndustry", e);
				}),
				this._getBusinessRegistrationData(body).catch(e => {
					logger.error(`_getBusinessRegistrationData error: ${e.message}`);
					errors.set("_getBusinessRegistrationData", e);
				}),
				this._getContactInformationData(body).catch(e => {
					logger.error(`_getContactInformationData error: ${e.message}`);
					errors.set("_getContactInformationData", e);
				}),
				this._getWatchlistData(body).catch(e => {
					logger.error(`_getWatchlistData error: ${e.message}`);
					errors.set("_getWatchlistData", e);
				}),
				this._getWebsiteData(body).catch(e => {
					logger.error(`_getWebsiteData error: ${e.message}`);
					errors.set("_getWebsiteData", e);
				}),
				this._getOwnerScoreData(body).catch(e => {
					logger.error(`_getOwnerData error: ${e.message}`);
					errors.set("_getOwnerData", e);
				}),
				this._getRiskScoreData(body).catch(e => {
					logger.error(`_getRiskScoreData error: ${e.message}`);
					errors.set("_getRiskScoreData", e);
				}),
				this._getOpenAccountsData(body).catch(e => {
					logger.error(`_getOpenAccountsData error: ${e.message}`);
				}),
				this._getPublicRecordsData(body).catch(e => {
					logger.error(`_getPublicRecordsData error: ${e.message}`);
				}),
				this._getTaxFilings(body).catch(e => {
					logger.error(`_getTaxFilings error: ${e.message}`);
					errors.set("_getTaxFilings", e);
				}),
				this._getFinancialsData(body).catch(e => {
					logger.error(`_getFinancialsData error: ${e.message}`);
				}),
				this._getExecutiveSummaryRevenue(body).catch(e => {
					logger.error(`_getExecutiveSummaryRevenue error: ${e.message}`);
					errors.set("_getExecutiveSummaryRevenue", e);
				}),
				this._getExecutiveSummaryKeyInsights(body).catch(e => {
					logger.error(`_getExecutiveSummaryKeyInsights error: ${e.message}`);
					errors.set("_getExecutiveSummaryKeyInsights", e);
				}),
				this._getMatchProData(body).catch(e => {
					logger.error(`_getMatchProData error: ${e.message}`);
					errors.set("_getMatchProData", e);
				}),
				this._getCountryCode(body).catch(e => {
					logger.error({ error: e }, "_getCountryCode error");
					errors.set("_getCountryCode", e);
				})
			]);

			const data = {
				company_overview: {
					details_and_industry: companyDetailsAndIndustry,
					website_review: websiteData?.website_review,
					website_pages: websiteData?.website_pages,
					ownership_scores: ownerScoreData,
					risk_scores: riskScoreData,
					country_code: countryCodeData
				},
				kyc_kyb: {
					business_registration: businessRegistrationData,
					contact_information: contactInformationData,
					watchlist: watchlistData,
					match_pro: matchProData
				},
				open_accounts: openAccountsData,
				public_records: publicRecordsData,
				tax_filings: taxData,
				financials: financialsData,
				executive_summary: {
					revenue_expense: executiveSummaryRevenueData,
					key_insights: executiveSummaryKeyInsightsData
				}
			};

			// TODO: In progress functionality
			const message = {
				report_id: body.report_id,
				business_id: body.business_id,
				source: "integration",
				data: data
			};
			const payload = {
				topic: kafkaTopics.REPORTS,
				messages: [
					{
						key: body.report_id || body.business_id, // fallback to business_id because report_id is not always present
						value: {
							event: kafkaEvents.UPDATE_REPORT_DATA,
							...message
						}
					}
				]
			};

			await producer.send(payload);

			// Check if any errors were collected
			if (errors.size > 0) {
				const errorDetails = Array.from(errors.entries()).map(([key, error]) => ({
					function: key,
					message: error.message
				}));
				throw new AggregateError("One or more errors occurred during processing.", errorDetails);
			}
		} catch (error) {
			throw error;
		}
	}

	async _getPublicRecordsData(body: I360Report): Promise<PublicRecordsResponse> {
		try {
			const businessID = body.business_id;

			let response: PublicRecordsResponse = {
				complaints: {
					total_complaints: "N/A",
					cfpb_complaints: "N/A",
					ftc_complaints: "N/A",
					answered_resolved_status: "N/A",
					resolved_resolved_status: "N/A",
					unanswered_resolved_status: "N/A",
					unresolved_resolved_status: "N/A",
					other_resolved_status: "N/A"
				},
				judgements: {
					number_of_judgement_fillings: null,
					most_recent_judgement_filling_date: null,
					most_recent_status: null,
					most_recent_amount: null,
					total_judgement_amount: null
				},
				bankruptcies: {
					number_of_bankruptcies: null,
					most_recent_bankruptcy_filing_date: null,
					most_recent_status: null
				},
				liens: {
					number_of_business_liens: null,
					most_recent_business_lien_filing_date: null,
					most_recent_status: null,
					most_recent_amount: null,
					total_open_lien_amount: null
				},
				platform_reviews: [],
				average_rating: null,
				review_statistics: {
					review_count: 0,
					count_of_total_reviewers_all_time: 0,
					count_of_0_or_1_star_ratings_all_time: 0,
					count_of_2_star_ratings_all_time: 0,
					count_of_3_star_ratings_all_time: 0,
					count_of_4_star_ratings_all_time: 0,
					count_of_5_star_ratings_all_time: 0,
					percentage_of_0_or_1_star_ratings_all_time: 0,
					percentage_of_2_star_ratings_all_time: 0,
					percentage_of_3_star_ratings_all_time: 0,
					percentage_of_4_star_ratings_all_time: 0,
					percentage_of_5_star_ratings_all_time: 0
				},
				most_relevant_reviews: [],
				google_profile: {
					business_name: "N/A",
					address: "N/A",
					phone_number: "N/A",
					website: "N/A",
					rating: null,
					reviews: null,
					thumbnail: "N/A",
					gps_coordinates: "N/A",
					google_search_link: "N/A",
					business_match: "Not Found",
					address_match: "N/A"
				},
				adverse_media: {}
			};

			const publicRecordResponse = await publicRecords.getPublicRecords({ businessID }, {});
			const result = await getGoogleProfileMatchResult(businessID);
			// Get BJL data for the business
			const facts = new FactEngine(bjlFacts, { business: businessID });
			await facts.applyRules(FactRules.factWithHighestConfidence);
			const bjlData = await facts.getResults(["source.confidence", "source.platformId", "source.name"]);

			if (!publicRecordResponse?.data?.public_records) {
				if (bjlData) {
					response = this._transformPublicRecordReportData({
						public_records: { complaint_statistics: null, reviews: [], average_rating: null, review_statistics: null },
						bjl_data: bjlData
					});
				}
				if (result?.google_profile) {
					response.google_profile = {
						...result.google_profile,
						business_match: result.business_match,
						address_match: result.address_match
					};
				}
				logger.warn(`No public records found for businessID: ${businessID}`);
				return response;
			}

			response = this._transformPublicRecordReportData({
				public_records: publicRecordResponse.data.public_records,
				bjl_data: bjlData
			});

			const googleReviews = await publicRecords.getGoogleReviews(
				{ businessID },
				{ pagination: true, page: 1, items_per_page: 2 }
			);

			if (googleReviews?.data?.records.length && googleReviews?.data?.source !== "none") {
				response.most_relevant_reviews = googleReviews.data.records.map((review: any) => ({
					...review,
					source: "Google Review"
				}));
			} else {
				const getSerpReviewsQuery = `
				SELECT integration_data.business_review_synthesis.*,
				       google_maps_serp_queries.raw_business_match->'user_reviews'->>'most_relevant' AS most_relevant_reviews
				FROM integration_data.business_review_synthesis
				LEFT JOIN integration_data.google_maps_serp_queries
				  ON google_maps_serp_queries.id = business_review_synthesis.serp_query_id
				WHERE google_maps_serp_queries.business_id = $1
				ORDER BY business_review_synthesis.created_at DESC
				LIMIT 1
			`;

				const [getSerpReviewsResult] = await sqlTransaction([getSerpReviewsQuery], [[businessID]]);
				if (getSerpReviewsResult.rowCount) {
					const { best_review, worst_review, most_relevant_reviews } = getSerpReviewsResult.rows[0];

					let parsedReviews: any[] = [];
					try {
						if (most_relevant_reviews) {
							parsedReviews = JSON.parse(most_relevant_reviews);
						}
					} catch (err) {
						logger.warn(err, "Failed to parse most_relevant_reviews JSON:");
					}

					const options: IFuseOptions<any> = {
						threshold: 0.3,
						includeMatches: true,
						includeScore: true,
						isCaseSensitive: false
					};

					const fuseBestReview = new Fuse([best_review], options);
					const fuseWorstReview = new Fuse([worst_review], options);

					let bestReviewLink;
					let worstReviewLink;

					for (const review of parsedReviews) {
						if (!review?.description) continue;

						if (fuseBestReview.search(review.description).length) {
							bestReviewLink = {
								description: review.description,
								link: review.link ?? "N/A"
							};
						}

						if (fuseWorstReview.search(review.description).length) {
							worstReviewLink = {
								description: review.description,
								link: review.link ?? "N/A"
							};
						}
					}

					response.most_relevant_reviews = [
						...(best_review
							? [{ star_rating: 5, text: best_review, source: "Google Review", link: bestReviewLink }]
							: []),
						...(worst_review
							? [{ star_rating: 0, text: worst_review, source: "Google Review", link: worstReviewLink }]
							: [])
					];
				}
			}

			if (result?.google_profile) {
				response.google_profile = {
					...result.google_profile,
					business_match: result.business_match,
					address_match: result.address_match
				};
			} else {
				response.google_profile = {
					business_name: "N/A",
					address: "N/A",
					phone_number: "N/A",
					website: "N/A",
					rating: null,
					reviews: null,
					thumbnail: "N/A",
					gps_coordinates: "N/A",
					google_search_link: "N/A",
					business_match: "Not Found",
					address_match: "N/A"
				};
			}

			const adverseMediaData = await this._fetchAdverseMediaData(businessID, body.case_id);
			if (adverseMediaData && Object.keys(adverseMediaData).length > 0) {
				response.adverse_media = adverseMediaData;
			} else {
				response.adverse_media = {};
			}

			return response;
		} catch (error) {
			throw new Error("Failed to retrieve public records data");
		}
	}

	private async _fetchAdverseMediaData(businessId: UUID, caseId?: UUID) {
		try {
			if (caseId) {
				return await adverseMedia.getAdverseMediaDataByCaseId({ caseId }, { sortFields: [] });
			} else {
				const data = await adverseMedia.getAdverseMediaByBusinessId({ businessId }, { sortFields: [] });
				return data;
			}
		} catch (error: any) {
			logger.error({ error }, `Error fetching adverse media data`);
			throw error;
		}
	}

	_transformPublicRecordReportData(input: { public_records: any; bjl_data: any }): PublicRecordsResponse {
		const { public_records, bjl_data } = input;

		return {
			complaints: {
				total_complaints: public_records.complaint_statistics?.count_of_complaints_all_time?.toString() ?? "N/A",
				cfpb_complaints:
					public_records.complaint_statistics?.count_of_consumer_financial_protection_bureau_complaints_all_time?.toString() ??
					"N/A",
				ftc_complaints:
					public_records.complaint_statistics?.count_of_federal_trade_commission_complaints_all_time?.toString() ??
					"N/A",
				answered_resolved_status:
					public_records.complaint_statistics?.count_of_answered_resolved_status_all_time?.toString() ?? "N/A",
				resolved_resolved_status:
					public_records.complaint_statistics?.count_of_resolved_resolved_status_all_time?.toString() ?? "N/A",
				unanswered_resolved_status:
					public_records.complaint_statistics?.count_of_unanswered_resolved_status_all_time?.toString() ?? "N/A",
				unresolved_resolved_status:
					public_records.complaint_statistics?.count_of_unresolved_resolved_status_all_time?.toString() ?? "N/A",
				other_resolved_status:
					public_records.complaint_statistics?.count_of_other_resolved_status_all_time?.toString() ?? "N/A"
			},
			judgements: {
				number_of_judgement_fillings: bjl_data?.judgements?.value?.count ?? null,
				most_recent_judgement_filling_date: bjl_data?.judgements?.value?.most_recent ?? null,
				most_recent_status: bjl_data?.judgements?.value?.most_recent_status ?? null,
				most_recent_amount: bjl_data?.judgements?.value?.most_recent_amount ?? null,
				total_judgement_amount: bjl_data?.judgements?.value?.total_judgement_amount ?? null
			},
			bankruptcies: {
				number_of_bankruptcies: bjl_data?.bankruptcies?.value?.count ?? null,
				most_recent_bankruptcy_filing_date: bjl_data?.bankruptcies?.value?.most_recent ?? null,
				most_recent_status: bjl_data?.bankruptcies?.value?.most_recent_status ?? null
			},
			liens: {
				number_of_business_liens: bjl_data?.liens?.value?.count ?? null,
				most_recent_business_lien_filing_date: bjl_data?.liens?.value?.most_recent ?? null,
				most_recent_status: bjl_data?.liens?.value?.most_recent_status ?? null,
				most_recent_amount: bjl_data?.liens?.value?.most_recent_amount ?? null,
				total_open_lien_amount: bjl_data?.liens?.value?.total_open_lien_amount ?? null
			},
			platform_reviews: public_records.reviews || [],
			average_rating: public_records.average_rating ? parseFloat(public_records.average_rating) : null,
			review_statistics: {
				review_count: public_records.review_statistics?.review_count || 0,
				count_of_total_reviewers_all_time: public_records.review_statistics?.count_of_total_reviewers_all_time || 0,
				count_of_0_or_1_star_ratings_all_time:
					public_records.review_statistics?.count_of_0_or_1_star_ratings_all_time || 0,
				count_of_2_star_ratings_all_time: public_records.review_statistics?.count_of_2_star_ratings_all_time || 0,
				count_of_3_star_ratings_all_time: public_records.review_statistics?.count_of_3_star_ratings_all_time || 0,
				count_of_4_star_ratings_all_time: public_records.review_statistics?.count_of_4_star_ratings_all_time || 0,
				count_of_5_star_ratings_all_time: public_records.review_statistics?.count_of_5_star_ratings_all_time || 0,
				percentage_of_0_or_1_star_ratings_all_time:
					public_records.review_statistics?.percentage_of_0_or_1_star_ratings_all_time || 0,
				percentage_of_2_star_ratings_all_time:
					public_records.review_statistics?.percentage_of_2_star_ratings_all_time || 0,
				percentage_of_3_star_ratings_all_time:
					public_records.review_statistics?.percentage_of_3_star_ratings_all_time || 0,
				percentage_of_4_star_ratings_all_time:
					public_records.review_statistics?.percentage_of_4_star_ratings_all_time || 0,
				percentage_of_5_star_ratings_all_time:
					public_records.review_statistics?.percentage_of_5_star_ratings_all_time || 0
			},
			most_relevant_reviews: [],
			google_profile: {
				business_name: "N/A",
				address: "N/A",
				phone_number: "N/A",
				website: "N/A",
				rating: null,
				reviews: null,
				thumbnail: "N/A",
				gps_coordinates: "N/A",
				google_search_link: "N/A",
				business_match: "Not Found",
				address_match: "N/A"
			},
			adverse_media: {}
		};
	}
	async _getCompanyDetailsAndIndustry(body: I360Report) {
		const businessID = body.business_id;
		try {
			const factsToFetch: FactName[] = [
				"business_name",
				"legal_name",
				"dba",
				"primary_address",
				"primary_address_string",
				"mailing_address",
				"formation_date",
				"year_established",
				"business_phone",
				"num_employees",
				"minority_owned",
				"woman_owned",
				"veteran_owned",
				"tin",
				"industry",
				"naics_code",
				"naics_description",
				"mcc_code_found",
				"mcc_code_from_naics",
				"mcc_code",
				"mcc_description"
			];
			const filteredFacts: Fact[] = allFacts.filter(fact => factsToFetch.includes(fact.name));
			const factEngine = new FactEngine(filteredFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const {
				business_name,
				legal_name,
				dba,
				primary_address_string,
				mailing_address,
				formation_date,
				year_established,
				business_phone,
				num_employees,
				minority_owned,
				woman_owned,
				veteran_owned,
				tin,
				industry,
				naics_code,
				naics_description,
				mcc_code,
				mcc_description
			} = await factEngine.getResults();

			let businessAge: number | null = null;
			if (formation_date?.value) {
				const formationDate = new Date(formation_date.value);
				const currentDate = new Date();
				businessAge = currentDate.getFullYear() - formationDate.getFullYear();
				const isBeforeAnniversary =
					currentDate.getMonth() < formationDate.getMonth() ||
					(currentDate.getMonth() === formationDate.getMonth() && currentDate.getDate() < formationDate.getDate());
				if (isBeforeAnniversary) {
					businessAge--;
				}
			} else if (year_established?.value) {
				// fallback to year_established if formation_date is not available
				businessAge = new Date().getFullYear() - year_established.value;
			}

			return {
				company_details: {
					business_name: business_name?.value ?? null,
					legal_business_name: legal_name?.value ?? null,
					dba_names: dba?.value ?? null,
					business_address: primary_address_string?.value ?? null,
					mailing_address: mailing_address?.value ?? null,
					business_age: businessAge ?? null,
					number_of_employees: num_employees?.value ?? null,
					business_phone: business_phone?.value ?? null,
					// TODO: business_email is not available in the fact engine yet
					// business_email: businessEmail?.value ?? "N/A",
					minority_owned: minority_owned?.value ?? null,
					woman_owned: woman_owned?.value ?? null,
					veteran_owned: veteran_owned?.value ?? null,
					tin: tin?.value ?? null
				},
				industry: {
					industry_name: industry?.value?.name ?? null,
					naics_code: naics_code?.value ?? null,
					naics_description: naics_description?.value ?? null,
					mcc_code: mcc_code?.value ?? null,
					mcc_description: mcc_description?.value ?? null
				}
			};
		} catch (error) {
			throw error;
		}
	}

	async _getContactInformationData(body: I360Report) {
		const businessID = body.business_id;
		try {
			const factsToFetch: FactName[] = [
				// submitted addresses
				"business_addresses_submitted",
				"business_addresses_submitted_strings",
				// reported addresses
				"addresses",
				"addresses_deliverable",
				"address_verification",
				// submitted/reported names
				"names_submitted",
				"names_found",
				"name_match",
				"name_match_boolean"
			];
			const filteredFacts: Fact[] = allFacts.filter(fact => factsToFetch.includes(fact.name));
			const factEngine = new FactEngine(filteredFacts, { business: businessID });
			factEngine.addRuleOverride(
				["addresses", "addresses_deliverable", "names_found", "names_submitted"],
				FactRules.combineFacts
			);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const {
				addresses,
				addresses_deliverable,
				address_verification,
				business_addresses_submitted_strings,
				names_found,
				names_submitted,
				name_match_boolean
			} = await factEngine.getResults();

			const serpResult = await getGoogleProfileMatchResult(businessID);

			// The google profile address_match status is calculated using the primary submitted address.
			// The google profile business_match status is calculated using the submitted business name.
			// If business_match is "Match Found" and address_match is "Match", we assume the primary submitted address is verified
			const googleProfileMatchBoolean =
				serpResult?.business_match?.toLowerCase() === "match found" &&
				serpResult?.address_match?.toLowerCase() === "match";

			// addresses_deliverable and address_verification addresses have been normalized to the same format
			// normalize submitted addresses to same format before comparing, but still return raw submitted addresses
			//
			// For registration_verified, we use normalizeForComparison() instead of normalizeString()
			// to equate secondary unit designators (Suite, Unit, Apt, etc.) that different data sources
			// may report differently for the same physical address (e.g., Trulioo "Unit 201" vs Google "Suite 201").
			//
			// Additionally, we use normalizeToBaseAddress() as a fallback to handle cases where one data source
			// omits the unit number entirely (e.g., Google returns "171 E Liberty St, NT, M6K 3P6" while Trulioo
			// returns "171 E Liberty St, Unit 201, NT, M6K 3P6"). If the base addresses match, the registration
			// is considered verified.
			const normalizedVerificationAddresses =
				address_verification?.value?.addresses?.map(a => AddressUtil.normalizeForComparison(a)) ?? [];
			const baseVerificationAddresses =
				address_verification?.value?.addresses?.map(a => AddressUtil.normalizeToBaseAddress(a)) ?? [];

			const submittedAddresses =
				business_addresses_submitted_strings?.value?.map(submittedAddress => {
					const normalizedAddress = AddressUtil.normalizeString(submittedAddress?.address);
					const normalizedForComparison = AddressUtil.normalizeForComparison(submittedAddress?.address);
					const baseAddress = AddressUtil.normalizeToBaseAddress(submittedAddress?.address);
					const isRegistrationVerified =
						(normalizedVerificationAddresses.includes(normalizedForComparison) ||
							baseVerificationAddresses.includes(baseAddress)) &&
						address_verification?.value?.status === "success";
					return {
						type: "submitted",
						address: submittedAddress?.address,
						deliverable: addresses_deliverable?.value?.includes(normalizedAddress) ?? false,
						registration_verified: isRegistrationVerified ?? false,
						google_profile_verified: googleProfileMatchBoolean && submittedAddress?.is_primary,
						is_primary: submittedAddress?.is_primary
					};
				}) ?? [];

			// normalize reported addresses to same format before comparing here too
			const reportedAddresses =
				addresses?.value?.map((address: any) => {
					const normalizedAddress = AddressUtil.normalizeString(address);
					const normalizedForComparison = AddressUtil.normalizeForComparison(address);
					const baseAddress = AddressUtil.normalizeToBaseAddress(address);
					const isRegistrationVerified =
						(normalizedVerificationAddresses.includes(normalizedForComparison) ||
							baseVerificationAddresses.includes(baseAddress)) &&
						address_verification?.value?.status === "success";
					return {
						type: "reported",
						address: address,
						deliverable: addresses_deliverable?.value?.includes(normalizedAddress) ?? false,
						registration_verified: isRegistrationVerified ?? false,
						// google profile address verification for reported addresses is not available yet
						// the google profile badge will be hidden on the report page for now
						google_profile_verified: false,
						is_primary: false
					};
				}) ?? [];

			const allAddresses = [...submittedAddresses, ...reportedAddresses];

			const submittedNames = names_submitted?.value?.filter(n => n.submitted)?.map(n => n.name) ?? [];
			const reportedNames = names_found?.value ?? [];

			return {
				known_addresses: allAddresses,
				business_names: {
					name_match_boolean: name_match_boolean?.value ?? false,
					submitted_names: submittedNames,
					reported_names: reportedNames
				}
			};
		} catch (error) {
			throw error;
		}
	}

	async _getBusinessRegistrationData(body: I360Report) {
		const businessID = body.business_id;
		try {
			// "people" is included here because it is a dependency of sos_filings to populate officers
			// TODO: clean this up after https://worth-ai.atlassian.net/browse/BEST-79 is implemented
			const factsToFetch: FactName[] = [
				"legal_name",
				"name_match",
				"name_match_boolean",
				"tin",
				"tin_match",
				"tin_match_boolean",
				"sos_filings",
				"sos_match",
				"sos_match_boolean",
				"people"
			];
			const filteredFacts: Fact[] = allFacts.filter(fact => factsToFetch.includes(fact.name));
			const factEngine = new FactEngine(filteredFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const { legal_name, name_match_boolean, tin, tin_match_boolean, sos_filings, sos_match } =
				await factEngine.getResults();

			const sortedSosFilings = sos_filings?.value?.sort(
				(a: any, b: any) => new Date(a.registration_date).getTime() - new Date(b.registration_date).getTime()
			);

			return {
				tin: tin?.value ?? null,
				tin_match_boolean: tin_match_boolean?.value ?? false,
				legal_name: legal_name?.value ?? null,
				name_match_boolean: name_match_boolean?.value ?? false,
				secretary_of_state: {
					sos_filings: sortedSosFilings ?? null,
					sos_match: sos_match?.value ?? null
				}
			};
		} catch (error) {
			throw error;
		}
	}

	async _getWebsiteData(body: I360Report) {
		try {
			const { business_id: businessID } = body;
			let responseBusinessWebsiteDetails: any;

			const inhouseWebsiteScanEnabled: boolean = await WorthWebsiteScanning.isEnabled(businessID);
			if (inhouseWebsiteScanEnabled) {
				responseBusinessWebsiteDetails = await getWorthWebsiteScanResponse(businessID);
			} else {
				const service = await getBusinessEntityVerificationService(businessID);
				responseBusinessWebsiteDetails = await service.getBusinessWebsiteDetails({ businessID }, {});
			}

			const website = responseBusinessWebsiteDetails?.data;

			const websitePages = await Promise.all(
				website?.pages?.map(async pageInfo => {
					let screenshotUrl = pageInfo.screenshot_url ?? null;
					if (screenshotUrl) {
						if (s3Utils.isS3Url(screenshotUrl)) {
							const signedUrlResponse = await getCachedSignedUrl(
								s3Utils.extractS3Key(screenshotUrl),
								"",
								envConfig.AWS_WEBSITE_SCREENSHOT_BUCKET
							);
							screenshotUrl = signedUrlResponse.signedRequest;
						}
					}
					return {
						page_url: pageInfo.url ?? null,
						page_category: pageInfo.category ?? null,
						page_screenshot_url: screenshotUrl,
						page_description: pageInfo.text ?? null
					};
				}) ?? null
			);

			return {
				website_review: {
					website_details: {
						website: website?.url ?? null,
						status: website?.status ?? null,
						creation_date: website?.domain?.creation_date ?? null,
						expiration_date: website?.domain?.expiration_date ?? null,
						parked_domain: website?.parked ?? false,
						business_name_match: website?.business_name_match ?? false
					}
				},
				website_pages: websitePages
			};
		} catch (error) {
			throw error;
		}
	}

	async _getWatchlistData(body: I360Report) {
		try {
			const businessID = body.business_id;

			const factsToFetch: FactName[] = [
				"watchlist_raw",
				"watchlist",
				"names_submitted",
				"people",
				"screened_people",
				"legal_name"
			];
			const filteredFacts: Fact[] = allFacts.filter(fact => factsToFetch.includes(fact.name));
			const factEngine = new FactEngine(filteredFacts, { business: businessID });
			factEngine.addRuleOverride("watchlist_raw", FactRules.combineWatchlistMetadata);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const { watchlist, names_submitted, people, legal_name } =
				await factEngine.getResults(["source.platformId"]);

			const hits = watchlist?.value?.metadata ?? [];
			const watchlistEntries = createWatchlistEntries(watchlist, names_submitted, people, legal_name);
			const watchlistHitsCount = watchlistEntries.reduce((acc, entry) => acc + entry.hits.length, 0);

			const groupedHitsByEntity = groupWatchlistHitsByEntityName(hits);

			const peopleWatchlist = Object.keys(groupedHitsByEntity).map(entityName => ({
				id: groupedHitsByEntity[entityName][0]?.id || "",
				name: entityName,
				titles: [],
				watchlist_results: groupedHitsByEntity[entityName]
			}));

			return {
				watchlist_hits: hits.length > 0 ? hits : null,
				watchlist_hits_count: watchlistHitsCount,
				people_watchlist: peopleWatchlist,
				watchlist_entries: watchlistEntries
			};
		} catch (error) {
			throw error;
		}
	}

	async _getOwnerScoreData(body: I360Report) {
		try {
			const businessID = body.business_id;
			if (businessID) {
				const { customer_id } = body;

				if (customer_id) {
					try {
						const isEquifaxEnabled = await customerIntegrationSettings.isCustomerIntegrationSettingEnabled(
							customer_id,
							INTEGRATION_SETTING_KEYS.EQUIFAX
						);
						if (!isEquifaxEnabled) {
							return null;
						}
					} catch (error) {
						logger.error({ error, customer_id }, `Could not resolve integration setting for customer:`);
					}
				}

				const owners = await getOwners(businessID);

				if (customer_id && !body.case_id) {
					let query = db("integrations.business_score_triggers")
						.select(db.raw("public.data_cases.id as case_id"))
						.where("business_score_triggers.business_id", businessID)
						.andWhere("business_score_triggers.customer_id", customer_id)
						.orderBy("business_score_triggers.created_at", "desc")
						.join("public.data_cases", "public.data_cases.score_trigger_id", "integrations.business_score_triggers.id")
						.first();
					const latestCase = await query;
					body.case_id = latestCase?.case_id;
				}

				const equifax = await strategyPlatformFactory<Equifax>({
					businessID: businessID as UUID,
					platformID: INTEGRATION_ID.EQUIFAX,
					customerID: customer_id
				});
				const ownerScores = await equifax.getOwnerScores({ case_id: body.case_id });
				const response = Object.fromEntries(
					Object.entries(ownerScores as any[]).filter(([ownerId]) => owners.some(owner => owner.id === ownerId))
				);
				return response;
			}
		} catch (error) {
			throw error;
		}
	}

	async _getRiskScoreData(body: I360Report) {
		try {
			// fetch the owners associated with the business
			const owners = await getOwners(body.business_id);

			// for each owner id, fetch the Risk scores from Plaid
			const ownerRiskScores: OwnerRiskScore[] = [];
			if (owners.length > 0) {
				for (const owner of owners) {
					const response = await PlaidIdv.getApplicantVerificationResponse(owner.id);
					const idvResponse = response[0];
					if (!idvResponse) {
						logger.warn(
							{ owner_id: owner.id, business_id: body.business_id },
							"_getRiskScoreData: No identity_verification record for owner, using defaults"
						);
						ownerRiskScores.push({
							owner_id: owner.id,
							identity_verification_attempted: false,
							status: "PENDING" as IdvStatus
						});
						continue;
					}
					const identity_verification_attempted = idvResponse.applicant.status !== null;

					const riskScores: OwnerRiskScore = {
						owner_id: owner.id,
						name: idvResponse.applicant.risk_check_result.name,
						synthetic_identity_risk_score: idvResponse.applicant.risk_check_result.synthetic_identity_risk_score,
						stolen_identity_risk_score: idvResponse.applicant.risk_check_result.stolen_identity_risk_score,
						status: idvResponse.applicant.status,
						identity_verification_attempted,
						ssn_verification_status: idvResponse.applicant.risk_check_result.ssn
					};

					ownerRiskScores.push(riskScores);
				}

				return ownerRiskScores;
			}

			logger.info(`No owners found for the business. Skipping risk score calculation.`);
		} catch (error) {
			throw error;
		}
	}

	async _getOpenAccountsData(body: I360Report): Promise<OpenAccounts | null> {
		try {
			const data = await Promise.all([
				this._getTop10TransactionsByAmount(body),
				this._getTop10RefundByAmount(body),
				this._getSpendingByCategory(body),
				this._getBankAccountBalanceChartData(body),
				this._getIncomeVsExpensesData(body),
				this._getDepositsChartData(body),
				this._getBankingInformation(body, false),
				this._getBankingInformation(body, true)
			]);

			const [
				top10TransactionsByAmount,
				top10RefundByAmount,
				spendingByCategory,
				bankAccountBalanceChartData,
				incomeVsExpensesChartData,
				depositsChartData,
				bankAccounts,
				creditCards
			] = data;

			return {
				top10RefundByAmount,
				top10TransactionsByAmount,
				spendingByCategory,
				bankAccountBalanceChartData,
				incomeVsExpensesChartData,
				depositsChartData,
				bankAccounts,
				creditCards
			};
		} catch (error) {
			logger.error({ error }, `Error _getOpenAccountsData report id: ${body.report_id}`);
			return null;
		}
	}

	async _getTop10TransactionsByAmount(body: I360Report): Promise<Top10BankAccountOperationByAmount[]> {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;
			if (businessID) {
				let mainDate = "CURRENT_DATE";
				if (caseID) {
					const caseObject = await getCase(caseID).catch(() => {
						logger.error(`Could not get case created_at for caseID=${caseID}`);
						return undefined;
					});
					if (caseObject?.created_at) {
						mainDate = `'${dayjs.utc(caseObject.created_at).toISOString()}'::timestamp`;
					} else {
						return [];
					}
				}
				const query = `
				select TO_CHAR(bat.date, 'MM/DD/YYYY') as date, bat.description, to_char(bat.amount, 'FM$9,999,999.00') as amount from integration_data.bank_account_transactions bat
				inner join integrations.data_business_integrations_tasks dbit on dbit.id = bat.business_integration_task_id
							inner join integrations.business_score_triggers bst on bst.id = dbit.business_score_trigger_id
							LEFT JOIN public.data_cases c on c.score_trigger_id = bst.id
				where
						bst.business_id = $1
				and
						bat.date >= (${mainDate} - INTERVAL '90 days')
						${mainDate !== "CURRENT_DATE" ? ` and bat.date <= ${mainDate}` : ""}
				and
						bat.amount >= 0
				order by bat.amount desc LIMIT 10`;

				const queryResponse = await sqlQuery({ sql: query, values: [businessID] });

				return queryResponse.rows as Top10BankAccountOperationByAmount[];
			}
			return [];
		} catch (error) {
			throw error;
		}
	}

	async _getTop10RefundByAmount(body: I360Report): Promise<Top10BankAccountOperationByAmount[]> {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;
			if (businessID) {
				let mainDate = "CURRENT_DATE";

				if (caseID) {
					const caseObject = await getCase(caseID).catch(() => {
						logger.error(`Could not get case created_at for caseID=${caseID}`);
						return undefined;
					});
					if (caseObject?.created_at) {
						mainDate = `'${dayjs.utc(caseObject.created_at).toISOString()}'::timestamp`;
					} else {
						return [];
					}
				}

				const query = `
				select TO_CHAR(bat.date, 'MM/DD/YYYY') as date, bat.description, to_char(abs(bat.amount), 'FM"-$"9,999,999.00') as amount from integration_data.bank_account_transactions bat
				inner join integrations.data_business_integrations_tasks dbit on dbit.id = bat.business_integration_task_id
							inner join integrations.business_score_triggers bst on bst.id = dbit.business_score_trigger_id
							LEFT JOIN public.data_cases c on c.score_trigger_id = bst.id
				where
						bst.business_id = $1
				and
						bat.date >= (${mainDate} - INTERVAL '90 days')
						${mainDate !== "CURRENT_DATE" ? ` and bat.date <= ${mainDate}` : ""}
				and
						bat.amount < 0
				order by bat.amount asc LIMIT 10`;

				const queryResponse = await sqlQuery({ sql: query, values: [businessID] });

				return queryResponse.rows as Top10BankAccountOperationByAmount[];
			}
			return [];
		} catch (error) {
			throw error;
		}
	}

	async _getSpendingByCategory(body: I360Report): Promise<SpendingCategory[]> {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;
			if (businessID) {
				let mainDate = "CURRENT_DATE";
				if (caseID) {
					const caseObject = await getCase(caseID).catch(() => {
						logger.error(`Could not get case created_at for caseID=${caseID}`);
						return undefined;
					});
					if (caseObject?.created_at) {
						mainDate = `'${dayjs.utc(caseObject.created_at).toISOString()}'::timestamp`;
					} else {
						return [];
					}
				}
				const query = `
				select bat.category, to_char(max(bat.amount), 'FM$9,999,999.00') as amount from integration_data.bank_account_transactions bat
				inner join integrations.data_business_integrations_tasks dbit on dbit.id = bat.business_integration_task_id
							inner join integrations.business_score_triggers bst on bst.id = dbit.business_score_trigger_id
							LEFT JOIN public.data_cases c on c.score_trigger_id = bst.id
				where
						bst.business_id = $1
				and
						bat.date >= (${mainDate} - INTERVAL '30 days')
						${mainDate !== "CURRENT_DATE" ? ` and bat.date <= ${mainDate}` : ""}
				and
						bat.amount >= 0
				group by bat.category
				order by max(bat.amount) desc LIMIT 5`;

				const queryResponse = await sqlQuery({ sql: query, values: [businessID] });

				return queryResponse.rows as SpendingCategory[];
			}
			return [];
		} catch (error) {
			throw error;
		}
	}

	async _getIncomeVsExpensesData(body: I360Report): Promise<IncomeVsExpensesChartData | null> {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;
			if (businessID) {
				let caseDate;
				if (caseID) {
					const caseObject = await getCase(caseID).catch(() => {
						logger.error(`Could not get case created_at for caseID=${caseID}`);
						return undefined;
					});
					if (caseObject?.created_at) {
						caseDate = `'${dayjs.utc(caseObject.created_at).toISOString()}'::timestamp`;
					} else {
						return null;
					}
				}
				const query = `WITH last_12_months AS (
SELECT to_char(date_trunc('month', date_trunc('year', current_date) + interval '1 month' * i), 'Mon''YY') AS month_year
FROM generate_series(0, 11) AS s(i)
ORDER BY i
), income_expenses_12_months as (
    SELECT TO_CHAR(date, 'Mon''YY') AS month,
       SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS total_deposits,
       SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS total_spendings
FROM integration_data.bank_account_transactions
JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bank_account_transactions.business_integration_task_id
JOIN integrations.data_connections dc ON dbit.connection_id = dc.id
LEFT JOIN integrations.business_score_triggers bst on dbit.business_score_trigger_id = bst.id
LEFT JOIN public.data_cases c on c.score_trigger_id = bst.id
WHERE
          dc.business_id = $1
      AND dc.platform_id = 1
      AND dc.connection_status = 'SUCCESS'
      AND date_part('year', date) = date_part('year', ${caseDate ?? "CURRENT_DATE"})
	  -- Exclude Transfers
	  AND NOT 'transfer' = ANY(string_to_array(lower(coalesce(bank_account_transactions.category,'')),','))
GROUP BY TO_CHAR(date, 'Mon''YY')
)
SELECT l.month_year, i.total_deposits as income, i.total_spendings as expense from last_12_months l
inner join income_expenses_12_months i on   i.month = l.month_year
`;

				const queryResponse = await sqlQuery({ sql: query, values: [businessID] });

				if (!queryResponse.rowCount) {
					return null;
				}

				return queryResponse.rows.reduce(
					(acc, r) => {
						acc.month_year = r.month_year;
						acc.incomes.push(r.income);
						acc.expenses.push(r.expense);
						return acc;
					},
					{ incomes: [], expenses: [] }
				);
			}
			return null;
		} catch (error) {
			throw error;
		}
	}

	_transformBalancesOldCode(data) {
		if (!data?.average_balances?.monthly_balances || data?.average_balances?.monthly_balances?.length === 0) {
			return null;
		}

		const monthlyBalances = data?.average_balances?.monthly_balances || [];
		const latestBalance = data?.average_balances?.latest_balance?.balance ?? 0;

		// Format labels and data, handling cases where values may be missing
		const labels = monthlyBalances.map(balance => {
			const month = balance?.month?.substring(0, 3) || "N/A";
			const year = balance?.year?.toString().slice(-2) || "00";
			return `${month}'${year}`;
		});

		const dataValues = monthlyBalances.map(balance => (balance?.balance ?? 0).toFixed(2));

		// Format current balance, defaulting to 0 if latestBalance is missing
		const currentBalance = `$${latestBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

		// Return the transformed object
		return {
			labels: labels,
			data: dataValues,
			currentBalance: currentBalance
		};
	}

	_transformBalances(data) {
		if (!data?.length) {
			return null;
		}

		const latestBalance = data[data.length - 1]?.average_balance ?? 0;

		// Format labels and data, handling cases where values may be missing
		const labels = data.map(balance => {
			const month = balance?.period?.substring(0, 3) || "N/A";
			const year = balance?.period?.slice(-2) || "00";
			return `${month}'${year}`;
		});

		const dataValues = data.map(balance => balance?.average_balance ?? 0);

		// Format current balance, defaulting to 0 if latestBalance is missing
		const currentBalance = `$${latestBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

		// Return the transformed object
		return {
			labels: labels,
			data: dataValues,
			currentBalance: currentBalance
		};
	}

	async _getBankAccountBalanceChartDataOldCode(body: I360Report): Promise<BankAccountBalanceChartData | null> {
		try {
			const caseID = body.case_id;
			const query: any = {
				default_duration: "year"
			};
			if (caseID) {
				const caseObject = await getCase(caseID).catch(() => {
					logger.error(`Could not get case created_at for caseID=${caseID}`);
					return undefined;
				});
				if (caseObject?.created_at) {
					const latestBalance = dayjs.utc(caseObject.created_at).toDate();
					const startOfTheYear = dayjs(latestBalance).startOf("year");
					query.filter_date = {
						"banking_balances.date": [startOfTheYear.toISOString(), latestBalance.toISOString()].join(",")
					};
				} else {
					return null;
				}
			}

			const data = await applicants.getBalancesStats({ businessID: body.business_id }, query, null, {
				authorization: null,
				shouldAssertCanSeeBusiness: false
			});
			const response = this._transformBalances(data);
			return response;
		} catch (error) {
			throw error;
		}
	}

	async _getBankAccountBalanceChartData(body: I360Report): Promise<BankAccountBalanceChartData | null> {
		try {
			const caseID = body.case_id;
			const businessID = body.business_id;

			// Check if there are any connected bank accounts
			const accountExistsQuery = `
				SELECT EXISTS (
					SELECT 1
					FROM integration_data.bank_accounts ba
					INNER JOIN integrations.data_business_integrations_tasks AS dbit ON dbit.id = ba.business_integration_task_id
					INNER JOIN integrations.data_connections AS dc ON dc.id = dbit.connection_id
					INNER JOIN integrations.business_score_triggers AS bst ON bst.id = dbit.business_score_trigger_id
					WHERE bst.business_id = $1 AND dc.connection_status = 'SUCCESS'
				) as has_accounts
			`;

			const accountCheck = await sqlQuery({ sql: accountExistsQuery, values: [businessID] });
			const hasAccounts = accountCheck.rows[0]?.has_accounts;

			// If no accounts, return null
			if (!hasAccounts) {
				return null;
			}

			let startDate, endDate;
			if (caseID) {
				const caseObject = await getCase(caseID).catch(() => {
					logger.error(`Could not get case created_at for caseID=${caseID}`);
					return undefined;
				});
				if (caseObject?.created_at) {
					endDate = dayjs.utc(caseObject.created_at).format("YYYY-MM-DD");
					startDate = dayjs(endDate).subtract(11, "months").startOf("month").format("YYYY-MM-DD");
				} else {
					return null;
				}
			} else {
				endDate = dayjs().endOf("month").format("YYYY-MM-DD");
				startDate = dayjs(endDate).subtract(11, "months").startOf("month").format("YYYY-MM-DD");
			}

			const query = `WITH months AS (
			SELECT
				generate_series(
					CAST($1 AS DATE),
					CAST($2 AS DATE),
					INTERVAL '1 month'
				) AS month_start
			),
			filtered_accounts AS (
				SELECT
					ba.id AS bank_account_id
				FROM integration_data.bank_accounts ba
				INNER JOIN integrations.data_business_integrations_tasks AS dbit ON dbit.id = ba.business_integration_task_id
				INNER JOIN integrations.data_connections AS dc ON dc.id = dbit.connection_id
				INNER JOIN integrations.business_score_triggers AS bst ON bst.id = dbit.business_score_trigger_id
				LEFT JOIN public.data_cases c ON c.score_trigger_id = bst.id
				WHERE
					bst.business_id = $3
					AND dc.connection_status = 'SUCCESS'
			),
			balances_with_defaults AS (
				SELECT
					TO_CHAR(m.month_start, 'Mon YY') AS period,
					COALESCE(SUM(bb.balance), 0) AS average_balance
				FROM months m
				LEFT JOIN integration_data.banking_balances bb
					ON DATE_TRUNC('month', make_date(bb.year, bb.month, 1)) = m.month_start
					AND bb.bank_account_id IN (SELECT bank_account_id FROM filtered_accounts)
				GROUP BY m.month_start
				ORDER BY m.month_start
			)
			SELECT * FROM balances_with_defaults`;
			const data = await sqlQuery({ sql: query, values: [startDate, endDate, businessID] });
			const response = this._transformBalances(data.rows);
			return response;
		} catch (error) {
			throw error;
		}
	}

	async _getCurrentBalanceAllAccounts(body: I360Report): Promise<string> {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;
			if (businessID) {
				let caseDate;
				if (caseID) {
					const caseObject = await getCase(caseID).catch(() => {
						logger.error(`Could not get case created_at for caseID=${caseID}`);
						return undefined;
					});
					if (caseObject?.created_at) {
						caseDate = `'${dayjs.utc(caseObject.created_at).toISOString()}'::timestamp`;
					} else {
						return "$0.00";
					}
				}
				const query = `
							SELECT
					ranked_data.business_id,
					to_char(sum(ranked_data.current), 'FM$9,999,990,00') as all_accounts_current_balance
			FROM (
					SELECT
							bst.business_id,
							ba.id,
							bbd.current,
							bbd.date,
							ROW_NUMBER() OVER (PARTITION BY ba.id ORDER BY bbd.date DESC) AS rn
					FROM
							integration_data.banking_balances_daily AS bbd
					INNER JOIN
							integration_data.bank_accounts AS ba ON ba.id = bbd.bank_account_id
					INNER JOIN
							integrations.data_business_integrations_tasks AS dbit ON dbit.id = ba.business_integration_task_id
					INNER JOIN
							integrations.business_score_triggers AS bst ON bst.id = dbit.business_score_trigger_id
					LEFT JOIN
							public.data_cases c on bst.id = c.score_trigger_id
					WHERE
							bst.business_id = $1
					and DATE_TRUNC('minute',bst.created_at) <= DATE_TRUNC('minute',${caseDate})
			) AS ranked_data
			WHERE
					rn = 1
			group by ranked_data.business_id
`;

				const queryResponse = await sqlQuery({ sql: query, values: [businessID] });

				if (!queryResponse.rowCount) {
					return "$0.00";
				}

				return queryResponse.rows[0].all_accounts_current_balance;
			}
			return "$0.00";
		} catch (error) {
			throw error;
		}
	}

	_convertTransactionStats(transactionStats) {
		return (
			transactionStats?.deposits?.categories?.map((category, index) => ({
				period: transactionStats?.deposits?.period,
				category: category.category,
				deposits: category.amount,
				index
			})) ?? []
		);
	}

	async _getDepositsChartData(body: I360Report): Promise<DepositsChartData[]> {
		try {
			const caseID = body.case_id;
			const query: any = {};
			if (caseID) {
				const caseObject = await getCase(caseID).catch(() => {
					logger.error(`Could not get case created_at for caseID=${caseID}`);
					return undefined;
				});
				if (caseObject?.created_at) {
					const latestBalance = dayjs.utc(caseObject.created_at).toDate().toISOString();
					const startOfTheYear = dayjs(latestBalance).startOf("year").toISOString();
					query.filter_date = {
						"deposits.bank_account_transactions.date": [startOfTheYear, latestBalance].join(","),
						"spendings.bank_account_transactions.date": [startOfTheYear, latestBalance].join(","),
						"average_transactions.bank_account_transactions.date": [startOfTheYear, latestBalance].join(","),
						"sum_transactions.bank_account_transactions.date": [startOfTheYear, latestBalance].join(",")
					};
				} else {
					return [];
				}
			}
			const businessID = body.business_id;
			if (businessID) {
				const data = await applicants.getTransactionsStats({ businessID }, query, null, {
					authorization: null,
					shouldAssertCanSeeBusiness: false
				});
				return this._convertTransactionStats(data);
			}
			return [];
		} catch (error) {
			throw error;
		}
	}

	async _getBankingInformation(
		{ business_id: businessID, case_id: caseID }: I360Report,
		isCredit: boolean = false
	): Promise<BankAccountReportData[]> {
		const bankingData = await banking.getBankingInformation({ businessID, caseID }, { caseID });
		let response = [] as any[];
		const filteredAccountsByType = bankingData?.data?.filter((account: any) =>
			isCredit ? account.type === "credit" : account.type !== "credit"
		);

		if (filteredAccountsByType?.length) {
			response = Object.values(filteredAccountsByType);
		}
		return response;
	}

	async _getTaxFilings(
		body: I360Report
	): Promise<{ annual_tax_filing: ITaxFiling[]; quarter_tax_filing: ITaxFiling[] } | {}> {
		try {
			const periodPlaceholder = "periodPlaceholder";
			const taxFormPlaceholder = "taxFormPlaceholder";
			const finalFormType = "finalFormType";
			let taxFilingQuery = `WITH latest_tax_filings AS (
									SELECT
										tf.*,
										ROW_NUMBER() OVER (PARTITION BY tf.period, tf.tax_period_ending_date ORDER BY tf.version DESC) AS rn
									FROM integration_data.tax_filings tf
									INNER JOIN integrations.data_business_integrations_tasks dbit
										ON dbit.id = tf.business_integration_task_id
									INNER JOIN integrations.business_score_triggers bst
										ON bst.id = dbit.business_score_trigger_id
									LEFT JOIN data_cases dc
										ON dc.score_trigger_id = dbit.business_score_trigger_id
									WHERE
										bst.business_id = $1
										${finalFormType}
										${taxFormPlaceholder}`;

			const taxFilingQueryValues = [body.business_id];

			if (body.case_id) {
				taxFilingQuery += " AND dc.id = $2 ";
				taxFilingQueryValues.push(body.case_id);
			} else if (body.score_trigger_id) {
				taxFilingQuery += " AND bst.id = $2 ";
				taxFilingQueryValues.push(body.score_trigger_id);
			}
			taxFilingQuery += `)
								SELECT
									${periodPlaceholder}
									MIN(tf.interest_date) AS interest_date,
									MIN(tf.penalty_date) AS penalty_date,
									SUM(tf.total_sales) AS total_sales,
									SUM(tf.total_compensation) AS total_compensation,
									SUM(tf.total_wages) AS total_wages,
									SUM(tf.cost_of_goods_sold) AS cost_of_goods_sold,
									SUM(tf.irs_balance) AS total_irs_balance,
									SUM(tf.lien_balance) AS total_lien_balance,
									SUM(tf.amount_filed) AS total_amount_filed,
									SUM(tf.penalty) AS total_penalty,
									SUM(tf.interest) AS total_interest,
									tf.tax_period_ending_date,
									tf.filed_date
								FROM latest_tax_filings tf
								WHERE tf.rn = 1`;

			const groupByPlaceholder = "groupByPlaceholder";

			taxFilingQuery += ` GROUP BY year ${groupByPlaceholder}, tf.tax_period_ending_date,
			tf.filed_date ORDER BY year DESC`;

			const quarterlyTaxFilingQuery = (query: string) => {
				const quarterlyPlaceholder = `LEFT(tf.period, 4) AS year, RIGHT(tf.period, 2) as month,`;
				query = query.replace(periodPlaceholder, quarterlyPlaceholder);
				query = query.replace(groupByPlaceholder, ", month");
				query = query.replace(finalFormType, "");
				query = query.replace(taxFormPlaceholder, ` AND form = '${TAX_STATUS_FORMS.QUARTERLY}'`);

				query += `, month DESC`;

				return query;
			};

			const yearlyTaxFilingQuery = (query: string) => {
				const quarterlyPlaceholder = ` LEFT(tf.period, 4) AS year,`;
				query = query.replace(periodPlaceholder, quarterlyPlaceholder);
				query = query.replace(groupByPlaceholder, "");
				query = query.replace(finalFormType, ` AND form_type = '${TAX_STATUS_FORMS_TYPE.RETR}'`);
				query = query.replace(taxFormPlaceholder, ` AND form = '${TAX_STATUS_FORMS.ANNUALLY}'`);

				return query;
			};

			const [yearlyTaxFilingResult, quarterlyTaxFilingResult] = await sqlTransaction(
				[yearlyTaxFilingQuery(taxFilingQuery), quarterlyTaxFilingQuery(taxFilingQuery)],
				[taxFilingQueryValues, taxFilingQueryValues]
			);

			if (!yearlyTaxFilingResult.rowCount && !quarterlyTaxFilingResult.rowCount) {
				return {};
			}

			const annuallyTaxFilling: ITaxFiling[] = yearlyTaxFilingResult.rows.map(row => {
				return {
					...row,
					tax_period_ending_date: row.tax_period_ending_date
						? new Date(row.tax_period_ending_date).toISOString()
						: new Date(`${row.year}-12-31`).toISOString()
				};
			});

			return { annual_tax_filing: annuallyTaxFilling, quarter_tax_filing: quarterlyTaxFilingResult.rows };
		} catch (error) {
			throw error;
		}
	}

	async _getFinancialsData(body: I360Report): Promise<Financials> {
		try {
			const [incomeStatement, balanceSheet] = await Promise.all([
				this._getIncomeStatement(body),
				this._getBalanceSheet(body)
			]);
			return { incomeStatement, balanceSheet };
		} catch (error) {
			throw error;
		}
	}

	async _getTaskWithCaseByCaseId(caseID: string): Promise<any[]> {
		const sql = `SELECT dbit.id as task_id, c.created_at as case_date from public.data_cases c
INNER JOIN integrations.data_business_integrations_tasks dbit on dbit.business_score_trigger_id = c.score_trigger_id
		 INNER JOIN integrations.data_connections dc on dbit.connection_id = dc.id
		 INNER JOIN integrations.rel_tasks_integrations rti on dbit.integration_task_id = rti.id
		 INNER JOIN integrations.core_tasks ct on rti.task_category_id = ct.id
WHERE c.id = $1
AND dbit.task_status = 'SUCCESS'
AND ct.code = 'fetch_profit_and_loss_statement'`;
		const sqlResponse = await sqlQuery({ sql, values: [caseID] });
		if (!sqlResponse.rowCount) {
			logger.info(`Case not found for _getIncomeStatement caseID:: ${caseID}`);
			return [];
		}
		return sqlResponse.rows;
	}

	async _getIncomeStatement(body: I360Report): Promise<IncomeStatement[]> {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;
			if (businessID) {
				let caseDate: string = "CURRENT_DATE";
				if (caseID) {
					const response = await this._getTaskWithCaseByCaseId(caseID);
					if (!response.length) {
						return [];
					}
					const [taskIdAndCaseDate] = response;
					const auxDate = taskIdAndCaseDate.case_date;
					caseDate = `'${auxDate.toISOString()}'::timestamp`;
				}
				const taskId = await this._getAccountingTaskId(businessID, "fetch_profit_and_loss_statement");

				const query = `
				SELECT EXTRACT(YEAR FROM start_date)::text AS year,
				SUM(total_revenue) AS total_revenue,
				SUM(net_income) AS net_income,
				SUM(total_expenses) AS total_expenses,
				COALESCE(SUM(total_depreciation),0) AS total_depreciation,
				COALESCE(SUM(total_cost_of_goods_sold),0) AS total_cost_of_goods_sold
				FROM integration_data.accounting_incomestatement
				INNER JOIN integrations.data_business_integrations_tasks ON data_business_integrations_tasks.id = accounting_incomestatement.business_integration_task_id
				INNER JOIN integration_data.accounting_incomestatement_tasks ON accounting_incomestatement_tasks.id = accounting_incomestatement.id and accounting_incomestatement_tasks.task_id = data_business_integrations_tasks.id
				WHERE accounting_incomestatement.business_id = $1
				AND accounting_incomestatement_tasks.task_id = $2
				AND start_date > DATE_TRUNC('year', ${caseDate}) - INTERVAL '1 years' + INTERVAL '1 day' - INTERVAL '1 year'
				GROUP BY EXTRACT(YEAR FROM start_date), accounting_incomestatement.platform_id
				ORDER BY 1 ASC LIMIT 20`;

				const queryResponse = await sqlQuery({ sql: query, values: [businessID, taskId] });

				// if revenue is 0 then find for different sources
				const revenue = await AccountingRest.revenueFallback(businessID);
				if (queryResponse && queryResponse.rows.length) {
					for (let i = 0; i < queryResponse.rows.length; i++) {
						if (parseFloat(queryResponse.rows[i].total_revenue) === 0) {
							// check for fallback
							queryResponse.rows[i].total_revenue = revenue;
						}
					}
				}

				return queryResponse.rows as IncomeStatement[];
			}
			return [];
		} catch (error) {
			throw error;
		}
	}
	async _getExecutiveSummaryRevenue(body: I360Report): Promise<ExecutiveSummaryRevenue[]> {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;
			if (businessID) {
				let caseDate;
				if (caseID) {
					const caseObject = await getCase(caseID).catch(() => {
						logger.error(`Could not get case created_at for caseID=${caseID}`);
						return undefined;
					});
					if (caseObject?.created_at) {
						caseDate = `'${dayjs.utc(caseObject.created_at).toISOString()}'::timestamp`;
					} else {
						return [];
					}
				}
				const query = `
SELECT EXTRACT(YEAR FROM start_date)::text    AS year,
	   EXTRACT(QUARTER FROM start_date)::text AS quarter,
	   SUM(total_revenue)                     AS total_revenue,
	   SUM(total_expenses)                    AS total_expenses
FROM integration_data.accounting_incomestatement
		 INNER JOIN
	 integrations.data_business_integrations_tasks
	 ON data_business_integrations_tasks.id = accounting_incomestatement.business_integration_task_id
		 INNER JOIN
	 integration_data.accounting_incomestatement_tasks
	 ON accounting_incomestatement_tasks.id = accounting_incomestatement.id
		 AND accounting_incomestatement_tasks.task_id = data_business_integrations_tasks.id
		 LEFT JOIN
	 integrations.business_score_triggers
	 ON business_score_triggers.id = data_business_integrations_tasks.business_score_trigger_id
		 LEFT JOIN
	 public.data_cases
	 ON business_score_triggers.id = data_cases.score_trigger_id
WHERE accounting_incomestatement.business_id = $1
  AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM ${caseDate ?? "CURRENT_DATE"})
GROUP BY EXTRACT(YEAR FROM start_date),
		 EXTRACT(QUARTER FROM start_date),
		 accounting_incomestatement.platform_id
ORDER BY year ASC,
		 quarter ASC
LIMIT 20
				`;

				const queryResponse = await sqlQuery({ sql: query, values: [businessID] });

				return queryResponse.rows as ExecutiveSummaryRevenue[];
			}
			return [];
		} catch (error) {
			throw error;
		}
	}

	async _getBalanceSheet(body: I360Report): Promise<BalanceSheet[]> {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;
			if (businessID) {
				let caseDate = "CURRENT_DATE";
				if (caseID) {
					const response = await this._getTaskWithCaseByCaseId(caseID);
					if (!response.length) {
						return [];
					}
					const [taskIdAndCaseDate] = response;
					const auxDate = taskIdAndCaseDate.case_date;
					caseDate = `'${auxDate.toISOString()}'::timestamp`;
				}
				const taskId = await this._getAccountingTaskId(businessID, "fetch_profit_and_loss_statement");

				const query = `
				SELECT EXTRACT(YEAR FROM accounting_balancesheet.end_date) as year,
				accounting_balancesheet.total_assets AS total_assets,
				accounting_balancesheet.total_equity AS total_equity,
				accounting_balancesheet.total_liabilities AS total_liabilities,
				CASE
			WHEN accounting_balancesheet.total_assets = 0 THEN '$0.00'
			ELSE TO_CHAR(accounting_balancesheet.total_assets, 'FM$9,999,999.00')
			END AS total_assets_formatted,
				CASE
			WHEN accounting_balancesheet.total_equity = 0 THEN '$0.00'
			ELSE TO_CHAR(accounting_balancesheet.total_equity, 'FM$9,999,999.00')
			END AS total_equity_formatted,
				CASE
			WHEN accounting_balancesheet.total_liabilities = 0 THEN '$0.00'
			ELSE TO_CHAR(accounting_balancesheet.total_liabilities, 'FM$9,999,999.00')
			END AS total_liabilities_formatted,
				TO_CHAR(accounting_balancesheet.end_date, 'MM/DD/YYYY') AS end_date
				FROM integration_data.accounting_balancesheet
				INNER JOIN integrations.data_business_integrations_tasks ON data_business_integrations_tasks.id = accounting_balancesheet.business_integration_task_id
				INNER JOIN integration_data.accounting_balancesheet_tasks ON accounting_balancesheet_tasks.id = accounting_balancesheet.id
				AND accounting_balancesheet_tasks.task_id = data_business_integrations_tasks.id
				WHERE accounting_balancesheet.business_id = $1
				AND accounting_balancesheet_tasks.task_id = $2
				AND EXTRACT(YEAR FROM accounting_balancesheet.end_date) = EXTRACT(YEAR FROM ${caseDate})
				ORDER BY accounting_balancesheet.end_date ASC`;

				const queryResponse = await sqlQuery({ sql: query, values: [businessID, taskId] });

				return queryResponse.rows as BalanceSheet[];
			}
			return [];
		} catch (error) {
			throw error;
		}
	}

	async _getAccountingTaskId(businessID, taskCode) {
		const mostRecentTask = await TaskManager.findOneTask({
			business_id: businessID,
			query: {
				task_status: TASK_STATUS.SUCCESS,
				task_code: taskCode
			}
		});
		return mostRecentTask?.id ?? undefined;
	}

	async _getExecutiveSummaryKeyInsights(body: I360Report): Promise<any> {
		const businessID = body.business_id;
		let caseID = body.case_id ?? null;
		const data = {
			reportBreakDown: {
				impactOfCompanyProfileScore: "",
				actionItemsForCompanyProfile: [],
				impactOfFinancialTrendsScore: "",
				actionItemsForFinancialTrends: [],
				impactOfLiquidityScore: "",
				actionItemsForWorth: []
			},
			summary: "",
			suggestedQuestions: []
		};

		if (!caseID) {
			const getCaseForBusinessQuery = `SELECT * FROM public.data_cases WHERE business_id = $1 ORDER BY created_at ASC`;
			const getCaseForBusinessResult = await sqlQuery({ sql: getCaseForBusinessQuery, values: [businessID] });
			if (getCaseForBusinessResult.rowCount) {
				caseID = getCaseForBusinessResult.rows[getCaseForBusinessResult.rows.length - 1].id;
			}
		}

		const getMostRecentInsightsQuery = `SELECT * FROM integration_data.insights_report WHERE external_id = $1 ORDER BY created_at DESC LIMIT 1`;
		const getMostRecentInsightsResult = await sqlQuery({ sql: getMostRecentInsightsQuery, values: [caseID] });
		if (getMostRecentInsightsResult.rowCount) {
			const mostRecentReport = getMostRecentInsightsResult.rows[0] as unknown as {
				report_data: KeyInsightsResponse;
				created_at: string;
			};
			return mostRecentReport.report_data;
		}
		return data;
	}


	async _getMatchProData(body: I360Report): Promise<MatchProData | {}> {
		const { business_id: businessID } = body;

		if (!businessID) {
			return {};
		}

		try {
			const response = await MatchUtil.getMatchBusinessResult({
				businessID
			});

			if (!response || Object.keys(response).length === 0) {
				return {};
			}

			// Multi-ICA aggregated response — extract default ICA only
			if (isMultiIcaMatchResponse(response)) {
				// Validate results structure up-front before any indexing
				if (typeof response.results !== "object" || Array.isArray(response.results) || response.results === null) {
					logger.warn("Invalid results structure in multi-ICA response");
					return {};
				}

				// Determine the default ICA: from the icas array if present, otherwise use first key in results
				let defaultIca: string | undefined;
				let defaultIcaEntry: { ica: string; isDefault: boolean } | undefined;

				if (Array.isArray(response.icas)) {
					defaultIcaEntry = response.icas.find((i: any) => i.isDefault);
					defaultIca = defaultIcaEntry?.ica;
				}

				// Fallback: if no icas array or no default found, use the first ICA key from results
				if (!defaultIca) {
					defaultIca = Object.keys(response.results)[0];
					if (defaultIca) {
						defaultIcaEntry = { ica: defaultIca, isDefault: true };
					}
				}

				if (!defaultIca || !defaultIcaEntry) {
					logger.warn("No ICA found in multi-ICA response");
					return {};
				}

				const defaultResult = response.results[defaultIca];
				if (!defaultResult) {
					logger.warn({ defaultIca }, "No result found for default ICA");
					return {};
				}

				// Detect errors: handle aggregated failure shape ({ error: string })
				// and normalized error shape ({ errors: { error: [...] } }) from normalizeMatchErrors()
				const hasErrors =
					(typeof defaultResult.error === "string" && defaultResult.error.length > 0) ||
					(Array.isArray(defaultResult.errors?.error) && defaultResult.errors.error.length > 0);

				return {
					icas: [defaultIcaEntry],
					results: { [defaultIca]: defaultResult },
					execution_metadata: response.execution_metadata?.[defaultIca]
						? { [defaultIca]: response.execution_metadata[defaultIca] }
						: undefined,
					summary: {
						total: 1,
						failed: hasErrors ? 1 : 0,
						success: hasErrors ? 0 : 1
					},
					// We normalize to single-ICA shape for downstream consumers
					// even though the source record was an aggregated multi-ICA response.
					multi_ica: false,
					timestamp: response.timestamp
				};
			}

			// Legacy single-ICA response — normalize into new shape
			if (!isLegacySingleIcaResponse(response)) {
				return {};
			}

			if (response.Errors || response.errors) {
				return {};
			}

			const legacyIca = response.terminationInquiryRequest?.acquirerId ?? "unknown";
			return {
				icas: [{ ica: legacyIca, isDefault: true }],
				results: {
					[legacyIca]: {
						terminationInquiryRequest: response.terminationInquiryRequest,
						terminationInquiryResponse: response.terminationInquiryResponse
					}
				},
				multi_ica: false,
				timestamp: response.timestamp
			};
		} catch (error) {
			logger.error(error, "Error fetching MatchPro data:");
			return {};
		}
	}

	async _getCountryCode(body: I360Report): Promise<string | null> {
		const businessData = await internalGetBusinessNamesAndAddresses(body.business_id);
		const primaryAddress = businessData.addresses.find(a => a.is_primary) ?? businessData.addresses[0];
		return primaryAddress?.country ?? null;
	}
}

export const reportEventsHandler = new ReportEventsHandler();
