import { logger, sqlQuery, oauthClient, sqlTransaction, getCustomerBusinesses, getFlagValue, getBusinessFacts } from "#helpers/index";
import { convertToPercentage, roundNum } from "#utils/math";
import { PublicRecordsApiError } from "./error";
import { buildInsertQuery } from "#utils/queryBuilder";
import { v4 as uuid } from "uuid";
import { CONNECTION_STATUS, ERROR_CODES, INTEGRATION_ID, ROLES, TASK_STATUS, FEATURE_FLAGS } from "#constants";
import { StatusCodes } from "http-status-codes";
import { paginate } from "#utils/paginate";
import { deleteKeysFromObject, getGoogleRatingMapping, isEmpty, pick } from "#utils";
import { getBusinessReviews } from "#common/common";
import type * as Verdata from "#lib/verdata/types";
import { TaskManager } from "../tasks/taskManager";
import { UUID } from "crypto";
import { IBusinessIntegrationTaskEnriched, IRequestResponse } from "#types/db";
import { parse } from "json2csv";
import { FactEngine } from "#lib/facts/factEngine";
// Lazy import to avoid circular dependency: sources.ts -> public-records.ts -> reviews/index.ts -> sources.ts
import * as FactRules from "#lib/facts/rules";

class PublicRecords {
	/**
	 * @description This api is used to fetch public records for a case or business
	 * @param {uuid} params.caseID : Id of a case which is used to fetch public records
	 * @param {uuid} params.businessID : Id of a business which is used to fetch public records
	 * @returns
	 */
	async getPublicRecords(params: { businessID: UUID }, body: { case_id?: UUID; score_trigger_id?: UUID }) {
		try {
			// TODO: Handle check for customerID in token === customerID of the case
			const { businessID } = params;
			let verdatatask: IBusinessIntegrationTaskEnriched, equifaxTask: IBusinessIntegrationTaskEnriched;

			// Need to get tasks from verdata and equifax for non-review public records data (liens, bankruptcies, corporate filings, etc.)
			// Note: Review data is fetched via Fact Engine, which handles its own data fetching
			if (Object.hasOwn(body, "case_id")) {
				verdatatask = await TaskManager.getLatestTaskForBusiness(businessID, INTEGRATION_ID.VERDATA, "fetch_public_records", true, "", body.case_id);
				equifaxTask = await TaskManager.getLatestTaskForBusiness(businessID, INTEGRATION_ID.EQUIFAX, "fetch_public_records", false, "integration_data.request_response.response", body.case_id);
			} else if (Object.hasOwn(body, "score_trigger_id")) {
				verdatatask = await TaskManager.getTaskForBusiness(businessID, INTEGRATION_ID.VERDATA, "fetch_public_records", true, "", body.score_trigger_id);
				equifaxTask = await TaskManager.getTaskForBusiness(businessID, INTEGRATION_ID.EQUIFAX, "fetch_public_records", false, "integration_data.request_response.response", body.score_trigger_id);
			} else {
				verdatatask = await TaskManager.getLatestTaskForBusiness(businessID, INTEGRATION_ID.VERDATA, "fetch_public_records");
				equifaxTask = await TaskManager.getLatestTaskForBusiness(businessID, INTEGRATION_ID.EQUIFAX, "fetch_public_records", false, "integration_data.request_response.response");
			}

			// Get non-review public records data (liens, bankruptcies, corporate filings, etc.)
			let { verdata_public_records, equifax_additional_records } = await this.getPublicRecordsRows(verdatatask, equifaxTask, null);

			// fallback to request-response table if data not found in original tables
			verdata_public_records = await this.fetchDataIfEmpty(verdata_public_records, verdatatask);
			equifax_additional_records = await this.fetchDataIfEmpty(equifax_additional_records, equifaxTask);

			// Get all review data from Fact Engine (leverages highest confidence source between SERP and Verdata)
			// This can work independently of Verdata, so we fetch it even if Verdata isn't available
			let reviewDataFromFacts: any = {};
			try {
				// Lazy import to avoid circular dependency
				const { reviewFacts } = await import("#lib/facts/reviews");
				const facts = new FactEngine(reviewFacts, { business: businessID });
				await facts.applyRules(FactRules.factWithHighestConfidence);
				const factResults = await facts.getResults(["source.confidence", "source.platformId", "source.name"]);
				
				// Extract review data from fact results
				if (factResults) {
					reviewDataFromFacts = {
						average_rating: factResults.review_rating?.value,
						google_review_count: factResults.google_review_count?.value,
						yelp_review_count: factResults.yelp_review_count?.value,
						angi_review_count: factResults.angi_review_count?.value,
						bbb_review_count: factResults.bbb_review_count?.value,
						healthgrades_review_count: factResults.healthgrades_review_count?.value,
						vitals_review_count: factResults.vitals_review_count?.value,
						webmd_review_count: factResults.webmd_review_count?.value,
						review_count: factResults.review_count?.value,
						count_of_total_reviewers_all_time: factResults.count_of_total_reviewers_all_time?.value,
						min_rating_all_time: factResults.min_rating_allsources?.value,
						median_rating_all_time: factResults.median_rating_allsources?.value,
						max_rating_all_time: factResults.max_rating_allsources?.value,
						count_of_complaints_all_time: factResults.count_of_complaints_all_time?.value,
						count_of_complaints_alert_words_all_time: factResults.count_of_complaints_alert_words_all_time?.value,
						count_of_answers_resolved_all_time: factResults.count_of_answers_resolved_all_time?.value,
						count_of_resolved_resolved_all_time: factResults.count_of_resolved_resolved_all_time?.value,
						count_of_unresolved_resolved_all_time: factResults.count_of_unresolved_resolved_all_time?.value,
						count_of_other_resolved_all_time: factResults.count_of_other_resolved_all_time?.value
					};
				}
			} catch (error) {
				logger.warn(error, `Failed to fetch review data from facts for business ${businessID}`);
			}

			// Build reviews array from Fact Engine data
			const reviewsFromFacts = this._buildReviewsFromFacts(reviewDataFromFacts);

			// Build review_statistics from Fact Engine data
			const reviewStatisticsFromFacts = this._buildReviewStatisticsFromFacts(reviewDataFromFacts);

			// If no Verdata records, we can still return review data from Fact Engine
			if (!verdata_public_records.length) {
				// Build complaint_statistics from Fact Engine data when available (no Verdata fallback)
				const complaintStatisticsFromFacts = this._buildComplaintStatisticsFromFacts(reviewDataFromFacts);
				
				// Return review data from Fact Engine even without Verdata
				return {
					data: {
						public_records: {
							average_rating: this._floatItOrNull(reviewDataFromFacts.average_rating),
							monthly_rating: null, // Not available without Verdata
							reviews: reviewsFromFacts,
							review_statistics: reviewStatisticsFromFacts,
							complaint_statistics: complaintStatisticsFromFacts
						}
					},
					message: "Review data available from Fact Engine, but Verdata public records are not fetched yet."
				};
			}

			const verdataResponse = verdata_public_records[0];

			// Extract complaint statistics from feature_store (not review data, so keeping old method)
			const complaintDetails: any = {};
			const complaintKeysToFind = [
				"compl_a_0014",
				"compl_a_0112",
				"compl_a_0119",
				"compl_a_0126",
				"compl_a_0217",
				"compl_a_0224",
				"compl_a_0245",
				"compl_a_0252",
				"compl_a_0259",
				"compl_a_0266",
				"compl_a_0273",
				"compl_a_0280",
				"compl_a_0287",
				"compl_a_0294"
			];

			verdataResponse?.additional_response?.feature_store?.forEach(element => {
				complaintKeysToFind.forEach(key => {
					if (Object.hasOwn(element, key)) {
						complaintDetails[key] = element[key];
					}
				});
			});

			// Build complaint_statistics from Fact Engine data with Verdata fallback
			const complaintStatisticsFromFacts = this._buildComplaintStatisticsFromFacts(reviewDataFromFacts, complaintDetails);

			let response = {
				public_records: {
					...verdataResponse,
					average_rating: this._floatItOrNull(reviewDataFromFacts.average_rating),
					monthly_rating: verdataResponse.monthly_rating ?? null, // Not available in facts yet, using verdataResponse as fallback
					reviews: reviewsFromFacts,
					review_statistics: reviewStatisticsFromFacts,
					complaint_statistics: complaintStatisticsFromFacts,
					// Additional records comes from equifax and the only values that returnes AS of NOW are "Y" for true and "null", for null we will take is as "N/A"
					additional_records: {
						minority_owned_enterprise:
							equifax_additional_records[0]?.response?.additional_fields?.minority_business_enterprise === "Y"
								? true
								: equifax_additional_records[0]?.response?.additional_fields?.minority_business_enterprise === "N"
									? false
									: "N/A",
						woman_owned_enterprise:
							equifax_additional_records[0]?.response?.additional_fields?.woman_owned_enterprise === "Y"
								? true
								: equifax_additional_records[0]?.response?.additional_fields?.woman_owned_enterprise === "N"
									? false
									: "N/A",
						veteran_owned_enterprise:
							equifax_additional_records[0]?.response?.additional_fields?.veteran_owned_enterprise === "Y"
								? true
								: equifax_additional_records[0]?.response?.additional_fields?.veteran_owned_enterprise === "N"
									? false
									: "N/A",
						number_of_employees: equifax_additional_records[0]?.response?.additional_fields?.number_of_employees ?? "N/A"
					}
				}
			};


			const keysToDelete = [
				"angi_review_count",
				"bbb_review_count",
				"google_review_count",
				"healthgrades_review_count",
				"vitals_review_count",
				"webmd_review_count",
				"yelp_review_count",
				"angi_review_percentage",
				"bbb_review_percentage",
				"google_review_percentage",
				"yelp_review_percentage",
				"healthgrades_review_percentage",
				"vitals_review_percentage",
				"webmd_review_percentage",
				"additional_response",
				"request_id"
			];

			deleteKeysFromObject(response.public_records, keysToDelete);

			response = this._fallbackToEquifaxFoBJL(response, equifax_additional_records[0]?.response);

			return { data: response, message: "Success" };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Build reviews array from Fact Engine data
	 * Uses review counts from facts (which already leverage highest confidence source)
	 */
	private _buildReviewsFromFacts(reviewDataFromFacts: any) {
		const reviewSources = [
			{ source: "Angi", count: reviewDataFromFacts.angi_review_count },
			{ source: "BBB", count: reviewDataFromFacts.bbb_review_count },
			{ source: "Google", count: reviewDataFromFacts.google_review_count },
			{ source: "HealthGrades", count: reviewDataFromFacts.healthgrades_review_count },
			{ source: "Vitals", count: reviewDataFromFacts.vitals_review_count },
			{ source: "WebMD", count: reviewDataFromFacts.webmd_review_count },
			{ source: "Yelp", count: reviewDataFromFacts.yelp_review_count }
		];

		//TODO: This is a temporary solution to get the total reviews from the facts. We need to remove this once we have the total reviews from the facts.
		// Calculate total reviews as the sum of all individual source counts
		const totalReviews = reviewSources.reduce((sum, source) => sum + (source.count ?? 0), 0);

		return reviewSources
			.map(source => {
				const count = source.count ?? 0;
				const percentage = totalReviews > 0 ? (count / totalReviews) : 0;

				return count
					? {
							source: source.source,
							count,
							percentage: convertToPercentage(percentage, 0)
						}
					: null;
			})
			.filter(Boolean);
	}

	/**
	 * Helper method to format numbers to 2 decimal places
	 */
	private _floatIt(key: number | null | undefined): number {
		if (key === null || key === undefined) return 0;
		return parseFloat(key.toFixed(2));
	}

	/**
	 * Helper method to format numbers to 2 decimal places or return null
	 */
	private _floatItOrNull(key: number | null | undefined): number | null {
		if (key === null || key === undefined) return null;
		return parseFloat(key.toFixed(2));
	}

	/**
	 * Build review_statistics object from Fact Engine data
	 * Fields not available in facts are set to 0
	 * TODO: Remove this note and the fallback to 0 once we have all data coming from facts
	 */
	private _buildReviewStatisticsFromFacts(reviewDataFromFacts: any) {
		//TODO: This is a temporary solution to get the total reviews from the facts. We need to remove this once we have the total reviews from the facts.
		// Calculate total reviews as the sum of all individual source counts
		const reviewCounts = [
			reviewDataFromFacts.angi_review_count,
			reviewDataFromFacts.bbb_review_count,
			reviewDataFromFacts.google_review_count,
			reviewDataFromFacts.healthgrades_review_count,
			reviewDataFromFacts.vitals_review_count,
			reviewDataFromFacts.webmd_review_count,
			reviewDataFromFacts.yelp_review_count
		];
		const totalReviews = reviewCounts.reduce((sum, count) => sum + (count ?? 0), 0);

		return {
			review_count: this._floatIt(totalReviews),
			count_of_total_reviewers_all_time: this._floatIt(reviewDataFromFacts.count_of_total_reviewers_all_time ?? 0),
			count_of_duplicate_reviewers_all_time: 0, // Not available in facts yet
			min_rating_all_time: this._floatItOrNull(reviewDataFromFacts.min_rating_all_time),
			median_rating_all_time: this._floatItOrNull(reviewDataFromFacts.median_rating_all_time),
			max_rating_all_time: this._floatItOrNull(reviewDataFromFacts.max_rating_all_time),
			standard_deviation_of_rating_all_time: 0, // Not available in facts yet
			variance_of_rating_all_time: 0, // Not available in facts yet
			count_of_0_or_1_star_ratings_all_time: 0, // Not available in facts yet
			count_of_2_star_ratings_all_time: 0, // Not available in facts yet
			count_of_3_star_ratings_all_time: 0, // Not available in facts yet
			count_of_4_star_ratings_all_time: 0, // Not available in facts yet
			count_of_5_star_ratings_all_time: 0, // Not available in facts yet
			percentage_of_0_or_1_star_ratings_all_time: 0, // Not available in facts yet
			percentage_of_2_star_ratings_all_time: 0, // Not available in facts yet
			percentage_of_3_star_ratings_all_time: 0, // Not available in facts yet
			percentage_of_4_star_ratings_all_time: 0, // Not available in facts yet
			percentage_of_5_star_ratings_all_time: 0, // Not available in facts yet
			count_of_reviews_containing_alert_words_all_time: 0, // Not available in facts yet
			percentage_of_reviews_containing_alert_words_all_time: 0 // Not available in facts yet
		};
	}

	/**
	 * Build complaint_statistics object from Fact Engine data
	 * Uses facts when available, falls back to complaintDetails (from feature_store) if provided
	 * Note: currently we are hiding this data on the frontend until we have all data coming from facts, but returning it for now
	 * TODO: Remove this note and the fallback to feature_store once we have all data coming from facts
	 */
	private _buildComplaintStatisticsFromFacts(reviewDataFromFacts: any, complaintDetails?: any) {
		return {
			// Use facts when available, fallback to feature_store extraction
			// Total Reviewers, Answers Resolved, and Complaints All Time come from facts engine
			count_of_total_reviewers_all_time: this._floatItOrNull(reviewDataFromFacts.count_of_total_reviewers_all_time),
			count_of_complaints_all_time: this._floatItOrNull(reviewDataFromFacts.count_of_complaints_all_time),
			count_of_answered_resolved_status_all_time: this._floatItOrNull(reviewDataFromFacts.count_of_answers_resolved_all_time),
			count_of_consumer_financial_protection_bureau_complaints_all_time: complaintDetails?.compl_a_0112 ? this._floatIt(complaintDetails.compl_a_0112) : null,
			percentage_of_complaints_containing_alert_words_all_time: complaintDetails?.compl_a_0119 ? this._floatIt(complaintDetails.compl_a_0119) : null,
			count_of_federal_trade_commission_complaints_all_time: complaintDetails?.compl_a_0126 ? this._floatIt(complaintDetails.compl_a_0126) : null,
			percentage_of_answered_resolved_status_all_time: complaintDetails?.compl_a_0224 ? this._floatIt(complaintDetails.compl_a_0224) : null,
			count_of_resolved_resolved_status_all_time: this._floatItOrNull(reviewDataFromFacts.count_of_resolved_resolved_all_time),
			percentage_of_resolved_resolved_status_all_time: complaintDetails?.compl_a_0252 ? this._floatIt(complaintDetails.compl_a_0252) : null,
			count_of_unanswered_resolved_status_all_time: complaintDetails?.compl_a_0259 ? this._floatIt(complaintDetails.compl_a_0259) : null,
			percentage_of_unanswered_resolved_status_all_time: complaintDetails?.compl_a_0266 ? this._floatIt(complaintDetails.compl_a_0266) : null,
			count_of_unresolved_resolved_status_all_time: this._floatItOrNull(reviewDataFromFacts.count_of_unresolved_resolved_all_time),
			percentage_of_unresolved_resolved_status_all_time: complaintDetails?.compl_a_0280 ? this._floatIt(complaintDetails.compl_a_0280) : null,
			count_of_other_resolved_status_all_time: this._floatItOrNull(reviewDataFromFacts.count_of_other_resolved_all_time),
			percentage_of_other_resolved_status_all_time: complaintDetails?.compl_a_0294 ? this._floatIt(complaintDetails.compl_a_0294) : null
		};
	}

	_fallbackToEquifaxFoBJL(response: { public_records: Verdata.PublicRecord }, equifaxData: { lien_count: number; bankruptcy_count: number; judgment_count: number }) {
		if (!equifaxData) {
			return response;
		}

		const keysToFind = ["lien_count", "bankruptcy_count", "judgement_count"];
		const data = pick(equifaxData || {}, keysToFind);

		const lien_count = !!Number(response.public_records.number_of_business_liens) ? Number(response.public_records.number_of_business_liens) : data?.lien_count || null;
		const bankruptcy_count = !!Number(response.public_records.number_of_bankruptcies) ? Number(response.public_records.number_of_bankruptcies) : data?.bankruptcy_count || null;
		const judgment_count = !!Number(response.public_records.number_of_judgement_fillings) ? Number(response.public_records.number_of_judgement_fillings) : data?.judgment_count || null;

		response.public_records.number_of_business_liens = lien_count;
		response.public_records.number_of_bankruptcies = bankruptcy_count;
		response.public_records.number_of_judgement_fillings = judgment_count;

		return response;
	}

	calculateStarRatings(data) {
		const initialState = {
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
		};

		if (!data?.length) {
			return initialState;
		}

		// Initialize counts
		const counts = {
			count_of_0_or_1_star_ratings_all_time: 0,
			count_of_2_star_ratings_all_time: 0,
			count_of_3_star_ratings_all_time: 0,
			count_of_4_star_ratings_all_time: 0,
			count_of_5_star_ratings_all_time: 0
		};

		// Calculate counts based on input data
		data.forEach(rating => {
			const { stars, amount } = rating;

			if (stars === 0 || stars === 1) {
				counts.count_of_0_or_1_star_ratings_all_time += amount;
			} else if (stars === 2) {
				counts.count_of_2_star_ratings_all_time += amount;
			} else if (stars === 3) {
				counts.count_of_3_star_ratings_all_time += amount;
			} else if (stars === 4) {
				counts.count_of_4_star_ratings_all_time += amount;
			} else if (stars === 5) {
				counts.count_of_5_star_ratings_all_time += amount;
			}
		});

		// Calculate total ratings
		const totalRatings =
			counts.count_of_0_or_1_star_ratings_all_time +
			counts.count_of_2_star_ratings_all_time +
			counts.count_of_3_star_ratings_all_time +
			counts.count_of_4_star_ratings_all_time +
			counts.count_of_5_star_ratings_all_time;

		if (totalRatings === 0) {
			return initialState;
		}

		// Calculate percentages
		const percentages = {
			percentage_of_0_or_1_star_ratings_all_time: counts.count_of_0_or_1_star_ratings_all_time / totalRatings,
			percentage_of_2_star_ratings_all_time: counts.count_of_2_star_ratings_all_time / totalRatings,
			percentage_of_3_star_ratings_all_time: counts.count_of_3_star_ratings_all_time / totalRatings,
			percentage_of_4_star_ratings_all_time: counts.count_of_4_star_ratings_all_time / totalRatings,
			percentage_of_5_star_ratings_all_time: counts.count_of_5_star_ratings_all_time / totalRatings
		};

		return { ...counts, ...percentages };
	}

	async getPublicRecordsRows(verdataTask: IBusinessIntegrationTaskEnriched, equifaxTask: IBusinessIntegrationTaskEnriched, serpTask: IBusinessIntegrationTaskEnriched | null) {
		try {
			const queries: string[] = [];
			const values: string[][] = [];
			const taskPositionArr: string[] = [];
			const VERDATA_TASK = "VERDATA_TASK";
			const EQUIFAX_TASK = "EQUIFAX_TASK";
			const SERP_TASK = "SERP_TASK";

			if (verdataTask) {
				const getPublicRecordsQuery: string = `SELECT integration_data.public_records.*,
				integration_data.request_response.request_id,
				integration_data.request_response.response as additional_response
				FROM integration_data.public_records
				LEFT JOIN integration_data.request_response ON integration_data.request_response.request_id = integration_data.public_records.business_integration_task_id
				WHERE integration_data.public_records.business_integration_task_id = '${verdataTask.id}'`;
				queries.push(getPublicRecordsQuery);
				values.push([]);
				taskPositionArr.push(VERDATA_TASK);
			}

			if (equifaxTask) {
				// NOTE : We are fetching the additional records from equifax only if the score is more than or equal to 45
				// This query performs better than join with the data_business_integrations_tasks table to get the score
				const getAdditionalEfxRecord: string = `SELECT request_id, response FROM integration_data.request_response
				WHERE integration_data.request_response.request_id = $1
				AND (
					SELECT (dbit.metadata ->'result'->'matches'->>'score')::numeric as score FROM integrations.data_business_integrations_tasks dbit
					WHERE dbit.id = $1
				) >= 45`;
				queries.push(getAdditionalEfxRecord);
				values.push([equifaxTask.id]);
				taskPositionArr.push(EQUIFAX_TASK);
			}

			if (serpTask) {
				const getSerpRecordsQuery: string = `SELECT integration_data.public_records.*
				FROM integration_data.public_records
				WHERE integration_data.public_records.business_integration_task_id = '${serpTask.id}'`;
				queries.push(getSerpRecordsQuery);
				values.push([]);
				taskPositionArr.push(SERP_TASK);
			}

			let publicRecords;
			let efxAdditionalRecords;
			let serpRecords;
			let position;
			const responses = await sqlTransaction(queries, values);
			if ((position = taskPositionArr.indexOf(VERDATA_TASK)) !== -1) {
				publicRecords = responses[position];
			}

			if ((position = taskPositionArr.indexOf(EQUIFAX_TASK)) !== -1) {
				efxAdditionalRecords = responses[position];
			}

			if (serpTask && (position = taskPositionArr.indexOf(SERP_TASK)) !== -1) {
				serpRecords = responses[position];
			}

			return {
				verdata_public_records: publicRecords ? publicRecords.rows : [],
				equifax_additional_records: efxAdditionalRecords ? efxAdditionalRecords.rows : [],
				serp_records: serpRecords ? serpRecords.rows : []
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This api is used to fetch google reviews for a case
	 * @param {uuid} param.businessID : Id of a business
	 * @returns
	 */
	async getGoogleReviews(params, query) {
		try {
			const { businessID } = params;
			const getConnectionQuery = `SELECT integrations.data_connections.connection_status
										FROM   integrations.data_connections
											LEFT JOIN data_cases
													ON data_cases.business_id =
														integrations.data_connections.business_id
										WHERE  integrations.data_connections.business_id = $1
											AND platform_id = (SELECT id
																FROM   integrations.core_integrations_platforms
																WHERE  code = $2) `;

			const getTaskIdQuery = `SELECT integrations.data_business_integrations_tasks.id
									FROM   integrations.data_business_integrations_tasks
										LEFT JOIN data_cases
												ON data_cases.score_trigger_id =
										integrations.data_business_integrations_tasks.business_score_trigger_id
									WHERE  data_cases.business_id = $1
										AND integrations.data_business_integrations_tasks.integration_task_id = (
											SELECT id
											FROM
												integrations.rel_tasks_integrations
											WHERE
												platform_id = (SELECT id
																FROM   integrations.core_integrations_platforms
																WHERE  code = $2)) `;

			const [getPlacesConnectionResult, getPlacesTaskIdResult] = await sqlTransaction(
				[getConnectionQuery, getTaskIdQuery],
				[
					[businessID, "google_places_reviews"],
					[businessID, "google_places_reviews"]
				]
			);

			const [getBusinessConnectionResult, getBusinessTaskIdResult] = await sqlTransaction(
				[getConnectionQuery, getTaskIdQuery],
				[
					[businessID, "google_business_reviews"],
					[businessID, "google_business_reviews"]
				]
			);

			if (!getBusinessTaskIdResult.rowCount && !getPlacesTaskIdResult.rowCount) {
				// tasks to pull the google reviews was not found
				return {
					data: {
						records: [],
						google_avg_rating: null,
						is_google_business_api_connected: false,
						source: "none"
					},
					message: "No google reviews records found."
				};
			}

			let pagination = true;

			if (Object.hasOwn(query, "pagination")) {
				pagination = JSON.parse(query.pagination);
			}

			let queryParams = "";
			let itemsPerPage = 0;
			let page = 0;
			if (pagination) {
				itemsPerPage = 20;
				if (query.items_per_page) {
					itemsPerPage = query.items_per_page;
				}

				page = 1;
				if (query.page) {
					page = query.page;
				}
			}

			const allowedSortParams = ["reviews.review_datetime", "reviews.review_rating", "reviews.created_at"];
			let sortParam = "reviews.review_datetime";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				queryParams += paginationQuery;
			}

			const sort = `ORDER BY ${sortParam} ${sortParamValue}`;

			let integrationTaskIDs: any[] = [];
			let source = "google_places_api";
			if (getBusinessConnectionResult && getBusinessConnectionResult.rows[0] && getBusinessConnectionResult.rows[0].connection_status === CONNECTION_STATUS.SUCCESS) {
				integrationTaskIDs = getBusinessTaskIdResult.rows.map(row => row.id);
				source = "google_business_api";
			} else if (getPlacesConnectionResult && getPlacesConnectionResult.rows[0] && getPlacesConnectionResult.rows[0].connection_status === CONNECTION_STATUS.SUCCESS) {
				integrationTaskIDs = getPlacesTaskIdResult.rows.map(row => row.id);
				source = "google_places_api";
			} else {
				return {
					data: {
						records: [],
						google_avg_rating: null,
						is_google_business_api_connected: false,
						source: "none"
					},
					message: "No google reviews records found."
				};
			}

			const getReviewsCountQuery = `SELECT count(*) AS totalcount, avg(star_rating) AS google_avg_rating FROM integration_data.reviews WHERE integration_data.reviews.business_integration_task_id IN ('${integrationTaskIDs.join(
				"','"
			)}')`;
			const getReviewsQuery = `SELECT * FROM integration_data.reviews WHERE integration_data.reviews.business_integration_task_id IN ('${integrationTaskIDs.join("','")}') ${sort} ${queryParams}`;
			let reviewsResult: any[] = [];
			let reviewsCount: string;
			let googleAvgRating = 0;
			const [getReviewCountResult, getReviewsResult] = await sqlTransaction([getReviewsCountQuery, getReviewsQuery], [[], []]);
			reviewsResult = getReviewsResult.rows;
			reviewsCount = getReviewCountResult.rows[0].totalcount;
			googleAvgRating = getReviewCountResult.rows[0].google_avg_rating;

			// google business review connection is successful but no reviews found then send google places reviews
			if (reviewsResult.length === 0 && source === "google_business_api") {
				if (getPlacesConnectionResult && getPlacesConnectionResult.rows[0] && getPlacesConnectionResult.rows[0].connection_status === CONNECTION_STATUS.SUCCESS) {
					integrationTaskIDs = getPlacesTaskIdResult.rows.map(row => row.id);
					const getNewReviewsCountQuery = `SELECT count(*) AS totalcount, avg(star_rating) AS google_avg_rating FROM integration_data.reviews WHERE integration_data.reviews.business_integration_task_id IN ('${integrationTaskIDs.join(
						"','"
					)}')`;
					const getNewReviewsQuery = `SELECT * FROM integration_data.reviews WHERE integration_data.reviews.business_integration_task_id IN ('${integrationTaskIDs.join(
						"','"
					)}') ${sort} ${queryParams}`;
					const [getNewReviewCountResult, getNewReviewsResult] = await sqlTransaction([getNewReviewsCountQuery, getNewReviewsQuery], [[], []]);
					reviewsResult = getNewReviewsResult.rows;
					reviewsCount = getNewReviewCountResult.rows[0].totalcount;
					googleAvgRating = getNewReviewCountResult.rows[0].google_avg_rating;
					source = "google_places_api";
				} else {
					source = "none";
				}
			}
			const totalcount: number = parseInt(reviewsCount);
			if (!pagination) {
				itemsPerPage = totalcount;
			}

			const paginationDetails = paginate(totalcount, itemsPerPage);

			let isGoogleBussinessConnected = getBusinessConnectionResult.rows[0]?.connection_status === CONNECTION_STATUS.SUCCESS;
			// check if google business api is connected in past and also check if it is revoked in past after successful connection
			if (!isGoogleBussinessConnected && !(getBusinessConnectionResult.rows[0]?.connection_status === CONNECTION_STATUS.REVOKED) && getBusinessConnectionResult.rowCount) {
				// check if google business api is connected in history
				const getGoogleBusinessConnectionHistoryQuery = `SELECT  connection_status FROM integrations.data_connections_history WHERE connection_id = $1 AND connection_status IN($2, $3) ORDER BY created_at desc`;
				const getGoogleBusinessConnectionHistoryResult = await sqlQuery({
					sql: getGoogleBusinessConnectionHistoryQuery,
					values: [getPlacesConnectionResult.rows[0].id, CONNECTION_STATUS.SUCCESS, CONNECTION_STATUS.REVOKED]
				});

				if (getGoogleBusinessConnectionHistoryResult.rowCount) {
					isGoogleBussinessConnected = getGoogleBusinessConnectionHistoryResult.rows[0].connection_status === CONNECTION_STATUS.SUCCESS;
				}
			}

			if (reviewsResult.length === 0) {
				const request_responses = await this.fetchSerpDataFallBack(businessID);
				const publicRecords = await this.fetchSerpDataFallBackPublicRecords(businessID);
				if (request_responses.length > 0 && publicRecords.length > 0) {
					const publicRecord = publicRecords[0];
					const request_response = request_responses[0];
					const reviews = this.mapSerpRawDataToReviews(publicRecord.task_id, request_response.response);
					const size = itemsPerPage > reviews.length ? reviews.length : itemsPerPage;
					const paginateData = paginate(reviews.length, itemsPerPage);
					reviews.slice(page - 1 * size, page * size);

					return {
						data: {
							records: reviews,
							google_avg_rating: Number(publicRecord.average_rating),
							is_google_business_api_connected: isGoogleBussinessConnected, // true or false
							source: "serp_api",
							total_pages: paginateData.totalPages,
							total_items: paginateData.totalItems
						},
						message: "Google reviews fetched successfully."
					};
				}
			}
			return {
				data: {
					records: reviewsResult,
					google_avg_rating: roundNum(googleAvgRating, 2),
					is_google_business_api_connected: isGoogleBussinessConnected, // true or false
					source, // "google_places_api" or "google_business_api"
					total_pages: paginationDetails.totalPages,
					total_items: paginationDetails.totalItems
				},
				message: "Google reviews fetched successfully."
			};
		} catch (error) {
			throw error;
		}
	}

	async getBusinessRatings(params, query) {
		try {
			// Fetch connections for verdata & google business reviews
			// verdata will be at the top and google business reviews will be at 2nd due to sorting on code
			const getConnectionQuery = `SELECT integrations.data_connections.*, integrations.core_integrations_platforms.code FROM integrations.data_connections
			LEFT JOIN integrations.core_integrations_platforms ON integrations.core_integrations_platforms.id = integrations.data_connections.platform_id
			WHERE business_id = $1 AND integrations.core_integrations_platforms.code IN ($2, $3) ORDER BY integrations.core_integrations_platforms.code DESC`;

			const [getConnectionResult] = await sqlTransaction([getConnectionQuery], [[params.businessID, "verdata", "google_business_reviews"]]);

			// check the status of the connections
			if (!getConnectionResult.rowCount) {
				throw new PublicRecordsApiError("No connections found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// if verdata connection is successful then fetch the ratings from the database table public_records
			if (getConnectionResult.rows[0].connection_status === CONNECTION_STATUS.SUCCESS) {
				const result = await this.getVerdataBusinessRatings(params, query);
				if (result.records.length > 0) {
					return result;
				}
			}

			// if verdata connection is failed then check for google business reviews connection
			// if verdata doesn't have any data then fetch the ratings from the database table reviews
			// if google business reviews connection is successful then fetch the ratings from the database table reviews
			// It can happen that there is no connection for google business reviews as it comes after ONBOARDING
			if (getConnectionResult.rows.length > 1 && getConnectionResult.rows[1].connection_status === CONNECTION_STATUS.SUCCESS) {
				const result = await this.getGoogleBusinessRatings(params, query);
				if (result.records.length > 0) {
					return result;
				}
			}

			// Default response if no data is found
			const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

			const records = monthNames.map(month => {
				return {
					month,
					avg_rating: 0
				};
			});

			const response = {
				records,
				avg_rating: 0,
				source: "none"
			};

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This api is used to fetch verdata business ratings for a business
	 * @param {*} params.businessID : id of the business
	 * @param {*} query.year : year for which the ratings are to be fetched
	 * @returns
	 */
	async getVerdataBusinessRatings(params, query) {
		try {
			const { businessID } = params;
			// fetch integration task ids for verdata
			const getTaskIdQuery = `SELECT integrations.data_business_integrations_tasks.id
									FROM   integrations.data_business_integrations_tasks
										LEFT JOIN data_cases
												ON data_cases.score_trigger_id =
										integrations.data_business_integrations_tasks.business_score_trigger_id
									WHERE  data_cases.business_id = $1
										AND integrations.data_business_integrations_tasks.task_status = '${TASK_STATUS.SUCCESS}'
										AND integrations.data_business_integrations_tasks.integration_task_id = (
											SELECT id
											FROM
												integrations.rel_tasks_integrations
											WHERE
												platform_id = (SELECT id
																FROM   integrations.core_integrations_platforms
																WHERE  code = $2)) `;
			const getTaskIdResult = await sqlQuery({ sql: getTaskIdQuery, values: [businessID, "verdata"] });

			if (!getTaskIdResult.rowCount) {
				throw new PublicRecordsApiError("No task found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			const integrationTaskIDs = getTaskIdResult.rows.map(row => row.id);

			// fetch the ratings from the database table public_records
			const getRatingsQuery = `SELECT average_rating, updated_at
			FROM integration_data.public_records
			WHERE integration_data.public_records.business_integration_task_id IN ('${integrationTaskIDs.join("','")}')
			AND updated_at IS NOT NULL
			AND EXTRACT(YEAR FROM updated_at) = $1 ORDER BY updated_at DESC`;
			const getRatingsResult = await sqlQuery({ sql: getRatingsQuery, values: [query.year] });

			if (!getRatingsResult.rowCount) {
				return { records: [], avg_rating: 0, source: "verdata" };
			}

			let overallAvgRating = 0;
			let uniqueMonths = 0;
			// clean the data
			let records = getRatingsResult.rows.reduce((acc, row) => {
				const date = row.updated_at;
				// Get the long month name using toLocaleDateString()
				const month = date.toLocaleDateString("en-US", { month: "long" });

				const rating = row.average_rating && !isNaN(row.average_rating) ? parseFloat(row.average_rating) : 0;

				if (!acc[month]) {
					acc[month] = { month, avg_rating: row.average_rating ? row.average_rating : 0 };
					overallAvgRating = parseFloat(`${overallAvgRating}`) + parseFloat(`${rating}`);
					uniqueMonths++;
				}
				return acc;
			}, {});

			// calculate the average rating for 12 months
			overallAvgRating /= uniqueMonths;

			// add missing months
			records = this._addMissingMonths(records);

			return { records: Object.values(records), avg_rating: roundNum(overallAvgRating, 2), source: "verdata" };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This api is used to fetch google business ratings for a business
	 * @param {uuid} params.businessID: id of the business
	 * @param {number} query.year: year for which the ratings are to be fetched
	 * @returns
	 */
	async getGoogleBusinessRatings(params, query) {
		try {
			const { businessID } = params;

			// fetch integration task ids for google business reviews
			const getTaskIdQuery = `SELECT integrations.data_business_integrations_tasks.id
									FROM   integrations.data_business_integrations_tasks
										LEFT JOIN data_cases
												ON data_cases.score_trigger_id =
										integrations.data_business_integrations_tasks.business_score_trigger_id
									WHERE  data_cases.business_id = $1
										AND integrations.data_business_integrations_tasks.integration_task_id = (
											SELECT id
											FROM
												integrations.rel_tasks_integrations
											WHERE
												platform_id = (SELECT id
																FROM   integrations.core_integrations_platforms
																WHERE  code = $2)) `;
			const getTaskIdResult = await sqlQuery({ sql: getTaskIdQuery, values: [businessID, "google_business_reviews"] });

			if (!getTaskIdResult.rowCount) {
				throw new PublicRecordsApiError("No task found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const integrationTaskIDs = getTaskIdResult.rows.map(row => row.id);

			const getRatingsQuery = `SELECT average_rating, created_at
			FROM integration_data.business_ratings
			WHERE integration_data.business_ratings.business_integration_task_id IN ('${integrationTaskIDs.join("','")}')
			AND created_at IS NOT NULL
			AND EXTRACT(YEAR FROM created_at) = $1
			ORDER BY created_at DESC`;

			const getRatingsResult = await sqlQuery({ sql: getRatingsQuery, values: [query.year] });

			if (!getRatingsResult.rowCount) {
				return { records: [], avg_rating: 0, source: "google_business_reviews" };
			}

			let overallAvgRating = 0;
			let uniqueMonths = 0;

			let records = getRatingsResult.rows.reduce((acc, row) => {
				const date = row.created_at;
				const month = date.toLocaleDateString("en-US", { month: "long" });

				const rating = row.average_rating && !isNaN(row.average_rating) ? parseFloat(row.average_rating) : 0;

				if (!acc[month]) {
					acc[month] = { month, avg_rating: row.average_rating ? row.average_rating : 0 };
					overallAvgRating = parseFloat(`${overallAvgRating}`) + parseFloat(`${rating}`);
					uniqueMonths++;
				}
				return acc;
			}, {});

			overallAvgRating /= uniqueMonths;

			records = this._addMissingMonths(records);

			return { records: Object.values(records), avg_rating: roundNum(overallAvgRating, 2), source: "google_business_reviews" };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This internal api is used to fetch google business ratings for a business using reviews table
	 * @param {*} params.businessID: id of the business
	 * @param {*} query.year: year for which the ratings are to be fetched
	 * @returns
	 */
	async _getGoogleBusinessRatingsFromReviews(params, query) {
		try {
			const { businessID } = params;

			// fetch integration task ids for google business reviews
			const getTaskIdQuery = `SELECT integrations.data_business_integrations_tasks.id
									FROM   integrations.data_business_integrations_tasks
										LEFT JOIN data_cases
												ON data_cases.score_trigger_id =
										integrations.data_business_integrations_tasks.business_score_trigger_id
									WHERE  data_cases.business_id = $1
										AND integrations.data_business_integrations_tasks.integration_task_id = (
											SELECT id
											FROM
												integrations.rel_tasks_integrations
											WHERE
												platform_id = (SELECT id
																FROM   integrations.core_integrations_platforms
																WHERE  code = $2)) `;
			const getTaskIdResult = await sqlQuery({ sql: getTaskIdQuery, values: [businessID, "google_business_reviews"] });

			if (!getTaskIdResult.rowCount) {
				throw new PublicRecordsApiError("No task found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const integrationTaskIDs = getTaskIdResult.rows.map(row => row.id);

			// fetch the ratings from the database table reviews
			const getRatingsQuery = `SELECT AVG(star_rating) AS avg_rating, EXTRACT(YEAR FROM review_datetime) AS year, TO_CHAR(review_datetime, 'Month') AS month
			FROM integration_data.reviews
			WHERE integration_data.reviews.business_integration_task_id IN ('${integrationTaskIDs.join("','")}') AND year = $1
			GROUP BY EXTRACT(YEAR FROM review_datetime), TO_CHAR(review_datetime, 'Month') ORDER BY EXTRACT(YEAR FROM review_datetime) ASC, TO_CHAR(review_datetime, 'Month') ASC`;

			const getRatingsResult = await sqlQuery({ sql: getRatingsQuery, values: [query.year] });

			if (!getRatingsResult.rowCount) {
				return { records: [], avg_rating: 0, source: "google_business_reviews" };
			}

			// calculate the average rating from data we fetched
			const overallAvgRating = getRatingsResult.rows.reduce((acc, row) => acc + row.avg_rating, 0) / getRatingsResult.rowCount;

			let records = getRatingsResult.rows.reduce((acc, row) => {
				acc[row.month] = { month: row.month, avg_rating: row.avg_rating };
				return acc;
			}, {});

			// add missing months
			records = this._addMissingMonths(records);

			return {
				records: Object.values(records),
				avg_rating: roundNum(overallAvgRating, 2),
				source: "google_business_reviews"
			};
		} catch (error) {
			throw error;
		}
	}

	_addMissingMonths(records) {
		const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

		const result = monthNames.reduce((acc, month) => {
			if (records[month]) {
				acc[month] = records[month];
			} else {
				acc[month] = { month, avg_rating: 0 };
			}
			return acc;
		}, {});

		return result;
	}

	/**
	 * @description This api is used to generate the google business api consent url and mark the connection as initialized
	 * @returns {string} : redirect_url to google business api consent
	 */
	async businessAPIConsentInit(body, params) {
		try {
			const { businessID } = params;
			const reAuthenticateFlow = body.re_authenticate || false;
			const now = new Date().toISOString();

			const getConnectionQuery = "SELECT * FROM integrations.data_connections WHERE business_id = $1 AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = $2)";
			const getConnectionResult = await sqlQuery({ sql: getConnectionQuery, values: [businessID, "google_business_reviews"] });

			if (!reAuthenticateFlow && getConnectionResult.rows[0]?.connection_status === CONNECTION_STATUS.SUCCESS) {
				throw new PublicRecordsApiError(`Google Business API is already connected for business`, StatusCodes.BAD_REQUEST, ERROR_CODES.NOT_ALLOWED);
			}

			if (!getConnectionResult.rowCount) {
				const insertConnectionQuery = `INSERT INTO integrations.data_connections (id, business_id, platform_id, configuration, connection_status, created_at, updated_at) VALUES ($1, $2, (SELECT id FROM integrations.core_integrations_platforms WHERE code = $3), $4, $5, $6, $7)`;
				const insertConnectionHistoryQuery = `INSERT INTO integrations.data_connections_history (id, connection_id, connection_status, created_at) VALUES ($1, $2, $3, $4)`;

				const connectionID = uuid();
				const insertConnectionValues = [connectionID, businessID, "google_business_reviews", null, CONNECTION_STATUS.CREATED, now, now];
				const insertConnectionHistoryValues = [uuid(), connectionID, CONNECTION_STATUS.INITIALIZED, now];

				await sqlTransaction([insertConnectionQuery, insertConnectionHistoryQuery], [insertConnectionValues, insertConnectionHistoryValues]);
			} else if (reAuthenticateFlow) {
				const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1 WHERE business_id = $2 AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = $3)`;
				const insertConnectionHistoryQuery = `INSERT INTO integrations.data_connections_history (id, connection_id, connection_status, created_at) VALUES ($1, $2, $3, $4)`;
				const updateConnectionValues = [CONNECTION_STATUS.INITIALIZED, businessID, "google_business_reviews"];
				const insertConnectionHistoryValues = [uuid(), getConnectionResult.rows[0].id, CONNECTION_STATUS.INITIALIZED, now];

				await sqlTransaction([updateConnectionQuery, insertConnectionHistoryQuery], [updateConnectionValues, insertConnectionHistoryValues]);
			}

			const authorizationUrl = oauthClient.generateBusinessConsentUrl();

			return { redirect_url: authorizationUrl };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This api is used to fetch google business reviews
	 * @param {string} body.code : code from the google business api consent
	 * @param {string} body.refresh_token : refresh token from the google business api consent
	 * @returns
	 */
	async fetchGoogleBusinessReviews(body, params) {
		try {
			const { businessID, caseID } = params;

			const tokenResponse = await oauthClient.getOAuthTokens(body.code);

			const getConnectionQuery = "SELECT * FROM integrations.data_connections WHERE business_id = $1 AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = $2)";
			// Get task id of the task that is required to fetch verdata public records
			const getGoogleReviewsTaskIDQuery = `SELECT id, task_status FROM integrations.data_business_integrations_tasks
			WHERE business_score_trigger_id = (SELECT integrations.business_score_triggers.id FROM integrations.business_score_triggers LEFT JOIN data_cases ON data_cases.score_trigger_id = integrations.business_score_triggers.id WHERE data_cases.business_id = $1 AND integrations.business_score_triggers.trigger_type = $2 AND data_cases.id = $3)
			AND integration_task_id = (SELECT id FROM integrations.rel_tasks_integrations WHERE task_category_id = (SELECT id FROM integrations.core_tasks WHERE code = $4) AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = $5))`;

			let [getConnectionResult, getGoogleReviewsTaskIDResult] = await sqlTransaction(
				[getConnectionQuery, getGoogleReviewsTaskIDQuery],
				[
					[businessID, "google_business_reviews"],
					[businessID, "ONBOARDING_INVITE", caseID, "fetch_google_reviews", "google_business_reviews"]
				]
			);

			if (!getConnectionResult.rowCount) {
				throw new PublicRecordsApiError("No connection found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const now = new Date().toISOString();

			// If connection is initialized then update the connection status to created
			// If connection is created then create a new task for fetching google reviews if it is not already created and status is not success
			if (getConnectionResult.rows[0].connection_status === CONNECTION_STATUS.INITIALIZED) {
				const getBusinessScoreTriggerIDQuery = `SELECT score_trigger_id FROM data_cases WHERE id = $1`;
				const getIntegrationsTaskIDQuery = `SELECT id, platform_id FROM integrations.rel_tasks_integrations WHERE task_category_id = (SELECT id FROM integrations.core_tasks WHERE code = $1) AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = $2)`;
				const [getBusinessScoreTriggerIDResult, getIntegrationsTaskIDResult] = await sqlTransaction(
					[getBusinessScoreTriggerIDQuery, getIntegrationsTaskIDQuery],
					[[caseID], ["fetch_google_reviews", "google_business_reviews"]]
				);

				if (!getBusinessScoreTriggerIDResult.rowCount) {
					// if case is present in data_cases then we could have found one business_score_trigger_id
					throw new PublicRecordsApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}

				const queries: string[] = [];
				const values: any[] = [];

				const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1, configuration = $2 WHERE business_id = $3 AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = $4)`;
				const updateConnectionValues = [CONNECTION_STATUS.CREATED, { tokens: tokenResponse.tokens }, businessID, "google_business_reviews"];

				queries.push(updateConnectionQuery);
				values.push(updateConnectionValues);

				queries.push(getConnectionQuery);
				values.push([businessID, "google_business_reviews"]);

				// create a new task for fetching google reviews if task was successful or not found
				if (!getGoogleReviewsTaskIDResult.rowCount || getGoogleReviewsTaskIDResult.rows[0].task_status === TASK_STATUS.SUCCESS) {
					const insertBusinessIntegrationTaskQuery = `INSERT INTO integrations.data_business_integrations_tasks (id, connection_id, integration_task_id, business_score_trigger_id, task_status, reference_id, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
					const insertBusinessIntegrationTaskValues = [
						uuid(),
						getConnectionResult.rows[0].id,
						getIntegrationsTaskIDResult.rows[0].id,
						getBusinessScoreTriggerIDResult.rows[0].score_trigger_id,
						TASK_STATUS.CREATED,
						null,
						null,
						now,
						now
					];
					queries.push(insertBusinessIntegrationTaskQuery);
					values.push(insertBusinessIntegrationTaskValues);
				} else {
					queries.push(getGoogleReviewsTaskIDQuery);
					values.push([businessID, "ONBOARDING_INVITE", caseID, "fetch_google_reviews", "google_business_reviews"]);
				}

				const insertConnectionHistoryQuery = `INSERT INTO integrations.data_connections_history (id, connection_id, connection_status, created_at) VALUES ($1, $2, $3, $4)`;
				const insertConnectionHistoryValues = [uuid(), getConnectionResult.rows[0].id, CONNECTION_STATUS.CREATED, now];

				queries.push(insertConnectionHistoryQuery);
				values.push(insertConnectionHistoryValues);

				[, getConnectionResult, getGoogleReviewsTaskIDResult] = await sqlTransaction(queries, values);
			}

			const businessTaskID = getGoogleReviewsTaskIDResult.rows[0].id;
			const businessTaskStatus = getGoogleReviewsTaskIDResult.rows[0].task_status;
			const businessTaskEventID = uuid();
			const connectionID = getConnectionResult.rows[0].id;

			const queries: string[] = [];
			const values: any[] = [];

			if (businessTaskStatus === "SUCCESS") {
				return { message: "Your Google Business reviews have been already fetched!" };
			}

			let connectionStatus: (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS] = CONNECTION_STATUS.SUCCESS;
			let taskStatus: (typeof TASK_STATUS)[keyof typeof TASK_STATUS] = TASK_STATUS.SUCCESS;
			let log = "";
			let errorValue: any = "";

			const businessAndTaskDetails = {
				business_id: businessID,
				connection_id: connectionID,
				business_integration_task_id: businessTaskID
			};

			let reviewsResponse = {
				all_reviews: [] as any,
				average_rating: 0,
				total_review_count: 0
			};

			try {
				reviewsResponse = await getBusinessReviews(tokenResponse, businessAndTaskDetails);
			} catch (err) {
				logger.info(`GOOGLE BUSINESS REVIEWS: Error in fetching google reviews for business ${businessID}`);
				errorValue = err;
				logger.error(JSON.stringify(errorValue));
				connectionStatus = CONNECTION_STATUS.FAILED;
				taskStatus = TASK_STATUS.FAILED;
				log = "Google business reviews fetching failed";
			}

			const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1, configuration = $2 WHERE
	business_id = $3 AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = $4)`;
			const updateConnectionQueryValues = [connectionStatus, { tokens: tokenResponse.tokens }, businessID, "google_business_reviews"];

			const insertConnectionHistory = `INSERT INTO integrations.data_connections_history (id, connection_id, log, connection_status, created_at) VALUES ($1, $2, $3, $4, $5)`;
			const insertConnectionHistoryValues = [uuid(), connectionID, log ? log : errorValue, connectionStatus, now];

			const updateTaskStatusQuery = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1 WHERE id = $2`;
			const updateTaskStatusQueryValues = [taskStatus, businessTaskID];

			const insertBusinessTaskEvent = `INSERT INTO integrations.business_integration_tasks_events (id, business_integration_task_id, task_status) VALUES ($1, $2, $3)`;
			const insertBusinessTaskEventValues = [businessTaskEventID, businessTaskID, taskStatus];

			queries.push(...[updateConnectionQuery, insertConnectionHistory, updateTaskStatusQuery, insertBusinessTaskEvent]);
			values.push(...[updateConnectionQueryValues, insertConnectionHistoryValues, updateTaskStatusQueryValues, insertBusinessTaskEventValues]);

			// save reviews to the database
			if (reviewsResponse.all_reviews.length !== 0) {
				const reviews = reviewsResponse.all_reviews.map(review => {
					return [businessTaskID, review.reviewId, getGoogleRatingMapping(review.starRating), review.comment, new Date(review.createTime).toUTCString()];
				});

				const columns = ["business_integration_task_id", "review_id", "star_rating", "text", "review_datetime"];

				const insertGoogleReviewsQuery = buildInsertQuery("integration_data.reviews", columns, reviews);
				queries.push(insertGoogleReviewsQuery);
				values.push(reviews.flat());
			}

			// NOTE: Considering we will be fetching the reviews for one location only. which is not the case for now
			const insertGoogleRatingsQuery = `INSERT INTO integration_data.business_ratings (business_integration_task_id, average_rating, total_reviews) VALUES ($1, $2, $3)`;
			const insertGoogleRatingsValues = [businessTaskID, reviewsResponse.average_rating, reviewsResponse.total_review_count];

			queries.push(insertGoogleRatingsQuery);
			values.push(insertGoogleRatingsValues);

			await sqlTransaction(queries, values);

			if (errorValue) {
				throw new PublicRecordsApiError("Error in fetching google reviews", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
			}

			const reviewsFetchedMessage = "Your Google Business reviews have been successfully fetched";
			const noReviewsMessage = "No reviews found for this Google Business Account";

			return { message: reviewsResponse.all_reviews.length ? reviewsFetchedMessage : noReviewsMessage };
		} catch (error) {
			throw error;
		}
	}
	async updatePublicRecordsPercentage() {
		try {
			const updatePercentageQuery = `UPDATE integration_data.public_records
		SET
			angi_review_percentage = CASE WHEN angi_review_percentage > 1 THEN angi_review_percentage / 100 ELSE angi_review_percentage END,
			bbb_review_percentage = CASE WHEN bbb_review_percentage > 1 THEN bbb_review_percentage / 100 ELSE bbb_review_percentage END,
			google_review_percentage = CASE WHEN google_review_percentage > 1 THEN google_review_percentage / 100 ELSE google_review_percentage END,
			yelp_review_percentage = CASE WHEN yelp_review_percentage > 1 THEN yelp_review_percentage / 100 ELSE yelp_review_percentage END,
			healthgrades_review_percentage = CASE WHEN healthgrades_review_percentage > 1 THEN healthgrades_review_percentage / 100 ELSE healthgrades_review_percentage END,
			vitals_review_percentage = CASE WHEN vitals_review_percentage > 1 THEN vitals_review_percentage / 100 ELSE vitals_review_percentage END,
			webmd_review_percentage = CASE WHEN webmd_review_percentage > 1 THEN webmd_review_percentage / 100 ELSE webmd_review_percentage END
		WHERE
			angi_review_percentage > 1
			OR bbb_review_percentage > 1
			OR google_review_percentage > 1
			OR yelp_review_percentage > 1
			OR healthgrades_review_percentage > 1
			OR vitals_review_percentage > 1
			OR webmd_review_percentage > 1`;
			await sqlQuery({ sql: updatePercentageQuery, values: [] });
			return;
		} catch (error) {
			throw error;
		}
	}

	async getRequestResponseData(requestId: string): Promise<IRequestResponse> {
		const getRequestResponseQuery = `SELECT * FROM integration_data.request_response WHERE request_id = $1`;
		const getRequestResponseResult = await sqlQuery({ sql: getRequestResponseQuery, values: [requestId] });

		return getRequestResponseResult.rows[0];
	}

	async fetchDataIfEmpty(records: any[], task: IBusinessIntegrationTaskEnriched): Promise<any[]> {
		if (!records?.length && task?.id) {
			const responseData = await this.getRequestResponseData(task.id);
			return responseData?.response ? [responseData] : [];
		}
		return records;
	}

	/**
	 * Fetches fallback public records data for a given business ID.
	 *
	 * @param {string} businessId - The ID of the business for which to fetch public records.
	 * @param {boolean} [successfulTaskOnly=false] - If true, only fetches records where the task status is 'SUCCESS'.
	 * @param {boolean} [isNullScoreID=true] - If true, only fetches records where the business score trigger ID is null.
	 * @returns {Promise<any[]>} - A promise that resolves to an array of public records data.
	 */
	async fetchSerpDataFallBackPublicRecords(businessId: string, successfulTaskOnly: boolean = false, isNullScoreID: boolean = true): Promise<any[]> {
		let query = `
			select dbit.id as task_id, dbit.created_at as created_at ,pr.*
			from integrations.data_connections dc
							join integrations.data_business_integrations_tasks dbit on dc.id = dbit.connection_id
					join integration_data.public_records pr on pr.business_integration_task_id = dbit.id
			where dc.business_id = $1
				and integration_task_id = (select r.id
																	from integrations.rel_tasks_integrations r
																	where r.platform_id = (select p.id
																													from integrations.core_integrations_platforms p
																													where p.code = 'serp_scrape')
																		and r.task_category_id = (select c.id
																															from integrations.core_tasks c
																															where c.code = 'fetch_business_entity_website_details'))`;
		if (isNullScoreID) {
			query += ` and business_score_trigger_id is null`;
		}
		if (successfulTaskOnly) {
			query += ` and task_status = 'SUCCESS'`;
		}
		query += ` order by dbit.created_at desc limit 1`;
		const sqlResponse = await sqlQuery({ sql: query, values: [businessId] });
		return sqlResponse.rowCount === 1 ? sqlResponse.rows : [];
	}

	async fetchSerpDataFallBack(businessId: string): Promise<any[]> {
		const query = `
			select r.*
			from integrations.data_connections dc
							join integrations.data_business_integrations_tasks dbit on dc.id = dbit.connection_id
					join integration_data.request_response r on r.request_id = dbit.id
			where dc.business_id = $1
				and business_score_trigger_id is null
				and integration_task_id = (select r.id
																	from integrations.rel_tasks_integrations r
																	where r.platform_id = (select p.id
																													from integrations.core_integrations_platforms p
																													where p.code = 'serp_scrape')
																		and r.task_category_id = (select c.id
																															from integrations.core_tasks c
																															where c.code = 'fetch_business_entity_website_details'))
			order by dbit.created_at desc
			limit 1
		`;
		const sqlResponse = await sqlQuery({ sql: query, values: [businessId] });
		const responseData = sqlResponse.rows[0];
		return responseData?.response ? [responseData] : [];
	}

	mapSerpRawDataToReviews(taskId: string, serpRawData: any) {
		return (
			serpRawData?.topGoogleReviews.map((review: any) => ({
				business_integration_task_id: taskId,
				review_id: review.review_id,
				star_rating: review.rating,
				text: review.snippet,
				review_datetime: review.iso_date,
				created_at: null,
				updated_at: null,
				id: review.review_id,
				metadata: review
			})) ?? []
		);
	}

	async getBusinessesData(params: { customerID: UUID }, userInfo: { role: { code: string } }, authorization: string) {
		let getBusinessesDataFlag: boolean = false;
		if (userInfo.role.code === ROLES.ADMIN) {
			getBusinessesDataFlag = true;
		} else {
			getBusinessesDataFlag = await getFlagValue(FEATURE_FLAGS.PAT_123_GET_BUSINESS_DATA, { key: "customer", kind: "customer", customer_id: params.customerID }, false);
		}

		if (!getBusinessesDataFlag) {
			logger.error(`Feature not enabled for customer ${params.customerID}`);
			throw new PublicRecordsApiError(`Feature not enabled for customer ${params.customerID}`, StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
		}

		const customerBusinesses = await getCustomerBusinesses(params.customerID, authorization);
		if (!customerBusinesses.length) {
			throw new PublicRecordsApiError("No business found for this customer", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		//comma separated string of business ids
		const businessIdsArray = customerBusinesses.map(business => business.id);

		const allBusinessesfacts: any = [];
		for (let i = 0; i < businessIdsArray.length; i++) {
			let tempFacts = await getBusinessFacts(businessIdsArray[i]);
			tempFacts.push({ name: "business_id", value: { value: businessIdsArray[i] } });
			allBusinessesfacts.push(tempFacts);
		}

		let filteredList: {}[] = [];

		allBusinessesfacts.forEach(facts => {
			const tempFacts = {};
			facts.forEach((fact: any) => {
				tempFacts[fact.name] = fact.value.value;
			});
			filteredList.push(tempFacts);
		});

		try {
			// Convert JSON to CSV
			const csvData = parse(filteredList);
			return csvData;
		} catch (err: any) {
			logger.error(`getBusinessesData: Error generating CSV for ${params.customerID} : ${err.message}`);
			throw err;
		}
	}
}

export const publicRecords = new PublicRecords();
