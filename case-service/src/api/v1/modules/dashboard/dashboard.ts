import { CASE_STATUS, CASE_STATUS_ENUM, CASE_TYPE, FEATURE_FLAGS } from "#constants";
import { Business } from "#types/business";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { sqlQuery, sqlTransaction, logger, getFlagValue } from "../../../../helpers/index";
import { calculatePercentageChange } from "#utils/math";
import { ApplicationReceivedApprovedStatsItem } from "#types";
import { UUID } from "crypto";

dayjs.extend(utc);
dayjs.extend(timezone);

class Dashboard {
	async getDecisionStats(params: { customerID: string }, query: any) {
		try {
			const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
				key: "customer",
				kind: "customer",
				customer_id: params.customerID
			});
			let caseStatuses = `${CASE_STATUS.AUTO_APPROVED}, ${CASE_STATUS.MANUALLY_APPROVED}, ${CASE_STATUS.AUTO_REJECTED},${CASE_STATUS.MANUALLY_REJECTED}`;

			if (Object.hasOwn(query, "require_in_progress_stats")) {
				if (shouldPauseTransition)
					caseStatuses = `${CASE_STATUS.CREATED}, ${CASE_STATUS.INVITED}, ${CASE_STATUS.ONBOARDING}, ${CASE_STATUS.SUBMITTED}`;
				else
					caseStatuses = `${CASE_STATUS.ONBOARDING}, ${CASE_STATUS.UNDER_MANUAL_REVIEW}, ${CASE_STATUS.PENDING_DECISION}`;
			}

			const getAllCasesQuery = `SELECT data_cases.status FROM data_cases LEFT JOIN data_businesses db ON db.id = data_cases.business_id 
			WHERE data_cases.customer_id = $1 AND db.is_deleted = false AND data_cases.status IN (${caseStatuses})`;
			const allCasesResults = await sqlQuery({ sql: getAllCasesQuery, values: [params.customerID] });

			let response;

			if (!allCasesResults.rowCount) {
				return {};
			}

			if (Object.hasOwn(query, "require_in_progress_stats")) {
				if (shouldPauseTransition) {
					response = {
						decisions: {
							CREATED: {
								percentage: 0,
								count: 0
							},
							INVITED: {
								percentage: 0,
								count: 0
							},
							ONBOARDING: {
								percentage: 0,
								count: 0
							},
							SUBMITTED: {
								percentage: 0,
								count: 0
							}
						},
						total_case_count: allCasesResults.rowCount
					};
				} else
					response = {
						decisions: {
							ONBOARDING: {
								percentage: 0,
								count: 0
							},
							UNDER_MANUAL_REVIEW: {
								percentage: 0,
								count: 0
							},
							PENDING_DECISION: {
								percentage: 0,
								count: 0
							}
						},
						total_case_count: allCasesResults.rowCount
					};
			} else {
				response = {
					decisions: {
						AUTO_APPROVED: {
							percentage: 0,
							count: 0
						},
						MANUALLY_APPROVED: {
							percentage: 0,
							count: 0
						},
						AUTO_REJECTED: {
							percentage: 0,
							count: 0
						},
						MANUALLY_REJECTED: {
							percentage: 0,
							count: 0
						}
					},
					total_case_count: allCasesResults.rowCount
				};
			}

			allCasesResults.rows.forEach(row => {
				switch (row.status) {
					case CASE_STATUS.AUTO_APPROVED:
						response.decisions.AUTO_APPROVED.count = response.decisions.AUTO_APPROVED.count + 1;
						break;
					case CASE_STATUS.MANUALLY_APPROVED:
						response.decisions.MANUALLY_APPROVED.count = response.decisions.MANUALLY_APPROVED.count + 1;
						break;
					case CASE_STATUS.AUTO_REJECTED:
						response.decisions.AUTO_REJECTED.count = response.decisions.AUTO_REJECTED.count + 1;
						break;
					case CASE_STATUS.MANUALLY_REJECTED:
						response.decisions.MANUALLY_REJECTED.count = response.decisions.MANUALLY_REJECTED.count + 1;
						break;
					case CASE_STATUS.ONBOARDING:
						response.decisions.ONBOARDING.count = response.decisions.ONBOARDING.count + 1;
						break;
					case CASE_STATUS.UNDER_MANUAL_REVIEW:
						response.decisions.UNDER_MANUAL_REVIEW.count = response.decisions.UNDER_MANUAL_REVIEW.count + 1;
						break;
					case CASE_STATUS.PENDING_DECISION:
						response.decisions.PENDING_DECISION.count = response.decisions.PENDING_DECISION.count + 1;
						break;
					case CASE_STATUS.CREATED:
						response.decisions.CREATED.count = response.decisions.CREATED.count + 1;
						break;
					case CASE_STATUS.INVITED:
						response.decisions.INVITED.count = response.decisions.INVITED.count + 1;
						break;
					case CASE_STATUS.SUBMITTED:
						response.decisions.SUBMITTED.count = response.decisions.SUBMITTED.count + 1;
						break;
					default:
						break;
				}
			});

			Object.keys(response.decisions).forEach(decision => {
				response.decisions[decision].percentage = allCasesResults.rowCount
					? ((response.decisions[decision].count / allCasesResults.rowCount) * 100).toFixed(2)
					: 0;
			});

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description Get business score range statistics for a given customer
	 * @param params
	 * @param {string} params.customerID: id of a customer
	 * @returns stats for business score ranges
	 */
	async getBusinessScoreRangeStats(params: { customerID: string }) {
		try {
			const scoreRangeQuery = `WITH latest_scores AS (
				SELECT dbs.*, ROW_NUMBER () OVER (PARTITION BY dbs.business_id ORDER BY dbs.created_at DESC) 
				FROM data_business_scores dbs 
				LEFT JOIN data_businesses db ON db.id = dbs.business_id
				WHERE dbs.customer_id = $1 AND db.is_deleted = false
			)
			SELECT 
				CASE
					WHEN dbs.score_850 <= 499 THEN '0-499'
					WHEN dbs.score_850 >= 500 AND dbs.score_850 <= 649 THEN '500-649'
					WHEN dbs.score_850 >= 650 THEN '650-XXX'
					ELSE 'unknown'
				END AS score_range,
				COUNT(*) as count
			FROM data_business_scores dbs
			LEFT JOIN data_businesses db ON db.id = dbs.business_id
			INNER JOIN latest_scores ON latest_scores.score_trigger_id = dbs.score_trigger_id
			WHERE latest_scores.row_number = 1 AND db.is_deleted = false
			GROUP BY score_range`;

			const scoreRangeResult = await sqlQuery({ sql: scoreRangeQuery, values: [params.customerID] });

			if (!scoreRangeResult.rowCount) {
				return {};
			}

			const response = scoreRangeResult.rows.reduce((acc, row) => {
				if (!Object.hasOwn(acc, "score_range")) {
					acc.score_range = {};
				}
				if (row.score_range) {
					acc.score_range[row.score_range] = { count: row.count };
				}
				return acc;
			}, {});

			return response;
		} catch (error) {
			throw error;
		}
	}

	async getCustomerPortfolio(params: { customerID: string }, query) {
		try {
			let year = 0;
			if (!Object.hasOwn(query, "period")) {
				const latestYearResult: Business.LatestYearResult = await sqlQuery({
					sql: ` SELECT EXTRACT(YEAR FROM MAX(rel_business_customer_monitoring.created_at)) AS latest_year
						FROM rel_business_customer_monitoring
						LEFT JOIN data_businesses db on rel_business_customer_monitoring.business_id = db.id 
						WHERE customer_id = $1 AND db.is_deleted = false`,
					values: [params.customerID]
				});
				if (!latestYearResult.rows.length) {
					// no businesses onboarded yet
					return {};
				} else {
					year = latestYearResult.rows[0].latest_year;
				}
			} else {
				year = query.period;
			}
			//get score generated business
			const businessCountResult: Business.BusinessCountResult = await sqlQuery({
				sql: `SELECT DATE_TRUNC('month', db.created_at) AS month_in_tz, to_char(DATE_TRUNC('month', db.created_at), 'Month') AS month, COUNT(DISTINCT db.id) AS total_businesses_count  FROM data_businesses db
					JOIN rel_business_customer_monitoring rbcm ON db.id = rbcm.business_id
					JOIN  LATERAL (select business_id from data_business_scores dbs WHERE db.id=dbs.business_id AND db.is_deleted = false LIMIT 1) AS scores ON true
					WHERE EXTRACT(YEAR FROM db.created_at) = $1 AND rbcm.customer_id = $2 AND db.is_deleted = false					
					GROUP BY month_in_tz
					ORDER BY month_in_tz;`,
				values: [year, params.customerID]
			});
			const months: string[] = [];
			const monthToCountMapping: { [key: string]: number } = {};

			businessCountResult.rows.forEach(row => {
				const trimmedMonth = row.month.trim();
				months.push(trimmedMonth);
				monthToCountMapping[trimmedMonth] = row.total_businesses_count;
			});

			let response: { [key: string]: { month: string; average_score: string; total_businesses_count: Number } } = {};
			if (months.length) {
				// Build the dynamic SQL query and build sample response body
				const queries = months
					.map(month => {
						response[month] = {
							month: month,
							average_score: "0",
							total_businesses_count: monthToCountMapping[month]
						};
						return `
				SELECT 
					'${month}' AS month,
					AVG(score_850) AS average_score
				FROM (
					SELECT DISTINCT ON (business_id) 
					business_id, 
					score_850
					FROM data_business_scores 
					LEFT JOIN data_businesses db ON db.id = data_business_scores.business_id
					WHERE EXTRACT(MONTH FROM data_business_scores.created_at) = EXTRACT(MONTH FROM to_date('${month}', 'month'))
					AND customer_id = $1
					AND db.is_deleted = false
					ORDER BY business_id, data_business_scores.created_at DESC
				) subquery
				`;
					})
					.join(" UNION ALL ");

				const query = `
				SELECT * FROM (
					${queries}
				) AS combined_results;
				`;

				const result = await sqlQuery({ sql: query, values: [params.customerID] });
				result.rows.forEach(row => {
					if (row.average_score) {
						response[row.month].average_score = parseFloat(row.average_score).toFixed(2);
					} else {
						response[row.month].average_score = "0";
					}
				});

				return { monthly_data: Object.values(response), period: year };
			}

			return {};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves the average score statistics for a given customer.
	 * @param params - The parameters for retrieving the average score statistics.
	 * @param params.customerID - The ID of the customer.
	 * @returns The average score statistics for the customer.
	 * @throws If there is an error while retrieving the data.
	 */
	async averageScoreStats(params: { customerID: string }) {
		try {
			const getScoreQuery = `WITH latest_scores AS (
				SELECT dbs.*, ROW_NUMBER () OVER (PARTITION BY dbs.business_id ORDER BY dbs.created_at DESC) 
				FROM data_business_scores dbs 
				LEFT JOIN data_businesses db ON db.id = dbs.business_id
				WHERE dbs.customer_id = $1 AND db.is_deleted = false
			)
			SELECT dbs.risk_level, count(dbs.risk_level), AVG(dbs.score_850) FROM data_business_scores dbs
			INNER JOIN latest_scores on latest_scores.score_trigger_id = dbs.score_trigger_id
			LEFT JOIN data_businesses db ON db.id = dbs.business_id
			WHERE row_number = 1 AND db.is_deleted = false
			GROUP BY ROLLUP(dbs.risk_level)`;

			const scoreDataResult = await sqlQuery({ sql: getScoreQuery, values: [params.customerID] });
			if (!scoreDataResult.rowCount) {
				return {};
			}

			const response = scoreDataResult.rows.reduce((acc, row) => {
				if (!Object.hasOwn(acc, "risk_levels")) {
					acc.risk_levels = {};
				}

				if (row.risk_level) {
					acc.risk_levels[(row.risk_level as string).toLowerCase()] = {
						average: parseFloat(row.avg).toFixed(2),
						count: row.count
					};
				} else {
					acc.total = {
						average: parseFloat(row.avg).toFixed(2),
						count: row.count
					};
				}

				return acc;
			}, {});

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves industry exposure data for a given customer.
	 * @param params - The parameters for the industry exposure query.
	 * @param params.customerID - The ID of the customer.
	 * @returns An array of objects representing the industry exposure data.
	 */
	async industryExposure(params: { customerID: string }) {
		try {
			const getIndustryExposureQuery = `WITH industry_counts AS (SELECT db.industry, COUNT(*) AS count FROM
																		data_businesses db
																		JOIN rel_business_customer_monitoring rbcm ON db.id = rbcm.business_id
																	WHERE rbcm.customer_id = $1 AND db.industry IS NOT NULL
																	GROUP BY db.industry
																	ORDER BY count DESC LIMIT 10)
																SELECT
																	db.industry,
																	cbi.name AS industry_name,
																	db.id AS business_id
																FROM
																	data_businesses db
																	JOIN rel_business_customer_monitoring rbcm ON db.id = rbcm.business_id
																	JOIN core_business_industries cbi ON db.industry = cbi.id
																WHERE
																	rbcm.customer_id = $1
																	AND db.industry IN (SELECT industry FROM industry_counts);`;

			const industryExposureResult = await sqlQuery({ sql: getIndustryExposureQuery, values: [params.customerID] });
			// handling no data
			if (!industryExposureResult.rowCount) {
				return {};
			}

			const industryMap = industryExposureResult.rows.reduce((acc, row) => {
				if (!acc[row.industry]) {
					acc[row.industry] = {
						industryName: row.industry_name,
						count: 0,
						businessIds: [],
						totalScore: 0,
						minScore: null,
						maxScore: null
					};
				}
				acc[row.industry].count++;
				acc[row.industry].businessIds.push(row.business_id);
				return acc;
			}, {});

			for (const industry in industryMap) {
				const { businessIds } = industryMap[industry];
				let totalScore = 0;
				let totalScoreCount = 0;
				let minScore = Number.MAX_VALUE;
				let maxScore = Number.MIN_VALUE;

				for (const businessId of businessIds) {
					const getScoreQuery = `SELECT score_850 FROM data_business_scores
					LEFT JOIN data_businesses db ON db.id = data_business_scores.business_id
					WHERE business_id = $1 AND db.is_deleted = false`;
					const scoreDataResult = await sqlQuery({ sql: getScoreQuery, values: [businessId] });

					if (scoreDataResult.rowCount) {
						scoreDataResult.rows.forEach(item => {
							const score = parseFloat(item.score_850);
							totalScore += score;
							totalScoreCount++;
							if (score < minScore) minScore = score;
							if (score > maxScore) maxScore = score;
						});
					}
				}

				industryMap[industry].averageScore = totalScore / totalScoreCount;
				industryMap[industry].minScore = minScore === Number.MAX_VALUE ? null : minScore;
				industryMap[industry].maxScore = maxScore === Number.MIN_VALUE ? null : maxScore;
			}

			const industryExposure = Object.keys(industryMap).map(industry => ({
				industry: industryMap[industry].industryName,
				count: industryMap[industry].count,
				average_score: parseFloat(String(industryMap[industry].averageScore)).toFixed(2),
				min_score: industryMap[industry].minScore,
				max_score: industryMap[industry].maxScore
			}));

			return industryExposure;
		} catch (error) {
			throw error;
		}
	}

	async getTotalApplications(
		params: { customerID: string },
		query: {
			timezone: string;
			team_performance: boolean;
			filter_date: {
				period: string;
			};
			filter: Record<string, any>;
		}
	) {
		const DURATION = {
			DAY: "DAY",
			WEEK: "WEEK",
			MONTH: "MONTH",
			YEAR: "YEAR"
		};
		// returing dates based on specific timezones
		let timezone = "UTC";
		if (Object.hasOwn(query, "timezone")) {
			timezone = query.timezone;
		}

		try {
			let period: Array<{ start: string; end: string }> = [
				{ start: dayjs().tz(timezone).subtract(1, "week").format(), end: dayjs().tz(timezone).format() },
				{
					start: dayjs().tz(timezone).subtract(2, "week").format(),
					end: dayjs().tz(timezone).subtract(1, "week").format()
				}
			];
			// period calculation based on given duration
			if (Object.hasOwn(query, "filter_date") && Object.hasOwn(query.filter_date, "period"))
				switch (query.filter_date.period) {
					case DURATION.DAY:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "day").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "day").format(),
								end: dayjs().tz(timezone).subtract(1, "day").format()
							}
						];
						break;

					case DURATION.WEEK:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "week").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "week").format(),
								end: dayjs().tz(timezone).subtract(1, "week").format()
							}
						];
						break;

					case DURATION.MONTH:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "month").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "month").format(),
								end: dayjs().tz(timezone).subtract(1, "month").format()
							}
						];
						break;

					case DURATION.YEAR:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "year").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "year").format(),
								end: dayjs().tz(timezone).subtract(1, "year").format()
							}
						];
						break;

					default:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "week").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "week").format(),
								end: dayjs().tz(timezone).subtract(1, "week").format()
							}
						];
				}

			// SQL Query Generation

			let caseStatuses = Object.values(CASE_STATUS);
			let baseQuery = `SELECT dc.status, COUNT(*) as count FROM data_cases dc 
				INNER JOIN data_businesses db ON dc.business_id = db.id 
				WHERE dc.customer_id = $1 AND dc.status = ANY($2) AND dc.created_at 
				BETWEEN $3 AND $4 AND db.is_deleted = false`;

			// filter based on given keys
			let queryParam = "";
			if (Object.hasOwn(query, "filter")) {
				const paramKeys = Object.keys(query.filter ?? {});
				const result = paramKeys.map(currentKey => {
					const queryObject = query.filter[currentKey];
					if (Array.isArray(queryObject)) {
						const obj = queryObject.map(item => `'${item}'`).join(",");
						return `${currentKey} IN (${obj})`;
					} else {
						return "";
					}
				});
				queryParam = result.reduce((res: string, item: any) => {
					res += ` AND ${item ?? ""}`;
					return res;
				}, "");
			}

			const finalQuery = `${baseQuery} ${queryParam} GROUP BY dc.status`;

			const [currentPeriodDataResult, previousPeriodDataResult] = await sqlTransaction(
				[finalQuery, finalQuery],
				[
					[params.customerID, caseStatuses, period[0].start, period[0].end],
					[params.customerID, caseStatuses, period[1].start, period[1].end]
				]
			);

			let caseStatusLabels = Object.values(CASE_STATUS_ENUM).filter(
				item => item !== "INVITED" && item !== "INVITE_EXPIRED"
			);

			if (Object.hasOwn(query, "team_performance") && query.team_performance) {
				caseStatusLabels = caseStatusLabels.filter(
					item =>
						item !== "AUTO_APPROVED" &&
						item !== "MANUALLY_APPROVED" &&
						item !== "MANUALLY_REJECTED" &&
						item !== "AUTO_REJECTED"
				);
			}

			// Null state
			if (currentPeriodDataResult.rowCount === 0 && previousPeriodDataResult.rowCount === 0) {
				return {
					data: {
						application_count: 0,
						percentage_change: 0,
						chart_data: []
					}
				};
			}

			// Data transformation
			const currentApplicationCount = currentPeriodDataResult.rows.reduce((sum, row) => {
				sum += Number(row.count ?? 0);
				return sum;
			}, 0);

			const previousApplicationCount = previousPeriodDataResult.rows.reduce((sum, row) => {
				sum += Number(row.count ?? 0);
				return sum;
			}, 0);

			const response = caseStatusLabels.map(item => {
				const currentStatusPresentIndex = currentPeriodDataResult.rows.findIndex(
					row => row.status === CASE_STATUS[item]
				);
				const previousStatusPresentIndex = previousPeriodDataResult.rows.findIndex(
					row => row.status === CASE_STATUS[item]
				);
				const currentCount =
					currentStatusPresentIndex !== -1
						? Number(currentPeriodDataResult.rows[currentStatusPresentIndex].count ?? 0)
						: 0;
				const previousCount =
					previousStatusPresentIndex !== -1
						? Number(previousPeriodDataResult.rows[previousStatusPresentIndex].count ?? 0)
						: 0;

				return {
					label: item,
					percentage: Number(calculatePercentageChange(currentCount, previousCount).toFixed(2)),
					current: {
						count: currentCount,
						period: period[0].end
					},
					previous: {
						count: previousCount,
						period: period[1].end
					}
				};
			});

			return {
				data: {
					application_count: currentApplicationCount,
					percentage_change: Number(
						calculatePercentageChange(currentApplicationCount, previousApplicationCount).toFixed(2)
					),
					chart_data: response
				}
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves the application received and approved statistics for a given customer.
	 * @param params - The parameters for the application received and approved statistics query.
	 * @param params.customerID - The ID of the customer.
	 * @param query - The query parameters for the application received and approved statistics query.
	 * @param query.filter_date - The filter date parameters for the application received and approved statistics query.
	 * @param query.filter_date.period - The period for the filter date.
	 * @param query.filter_date.last - The last value for the filter date.
	 * @param query.filter - The filter parameters for the application received and approved statistics query.
	 * @param query.filter.db.industry - The industry filter parameter for the application received and approved statistics query.
	 * @param query.filter.dc.assignee - The assignee filter parameter for the application received and approved statistics query.
	 * @returns The application received and approved statistics for the customer.
	 * @throws If there is an error while retrieving the data.
	 */
	async applicationReceivedApprovedStats(
		params: { customerID: string },
		query: {
			filter_date: { period: "DAY" | "WEEK" | "MONTH" | "YEAR"; last?: number; timezone?: string; interval?: number };
			filter: { "db.industry"?: number[]; "dc.assignee"?: string[] };
		}
	): Promise<ApplicationReceivedApprovedStatsItem[] | null> {
		try {
			const { customerID } = params;

			const period = query?.filter_date?.period || "DAY";
			const timezone = query?.filter_date?.timezone || "UTC";
			const last = query?.filter_date?.last || 0;

			let startDate: Dayjs, endDate: Dayjs;
			let labelPlaceholder = "";
			let defaultResult: ApplicationReceivedApprovedStatsItem[] = [];

			switch (period) {
				case "DAY":
					let interval = query?.filter_date?.interval || 3;
					// TODO: Future enhancement. for now just fallback to 3
					if (![1, 2, 3, 4, 6, 8, 12].includes(interval)) {
						interval = 3;
					}
					startDate = dayjs().tz(timezone).subtract(last, "day").startOf("day");
					endDate = dayjs().tz(timezone).subtract(last, "day").endOf("day");
					labelPlaceholder = this._generateDayLabelPlaceholder(startDate, timezone, interval);
					for (let i = interval; i <= 24; i += interval) {
						defaultResult.push({
							label: dayjs(startDate).tz(timezone).set("hour", i).toISOString(),
							received: 0,
							approved: 0,
							trends: { received: 0, approved: 0 }
						});
					}
					break;
				case "WEEK":
					{
						labelPlaceholder = "TO_CHAR(dc.created_at, 'FMDy') AS label";
						startDate = dayjs().tz(timezone).subtract(last, "week").startOf("week");
						endDate = dayjs().tz(timezone).subtract(last, "week").endOf("week");
						defaultResult = [
							{ label: "Mon", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Tue", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Wed", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Thu", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Fri", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Sat", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Sun", received: 0, approved: 0, trends: { received: 0, approved: 0 } }
						];
					}
					break;
				case "MONTH":
					{
						let interval = query?.filter_date?.interval || 5;
						// TODO: Future enhancement. for now just fallback to 5
						if (![1, 2, 3, 5, 6, 10, 15].includes(interval)) {
							interval = 5;
						}
						startDate = dayjs().tz(timezone).endOf("day").subtract(30, "day");
						endDate = dayjs().tz(timezone).endOf("day");

						labelPlaceholder = this._generateMonthLabelPlaceholder(startDate, timezone, interval);

						for (let i = 0; i < 30; i += interval) {
							defaultResult.push({
								label: dayjs(startDate)
									.tz(timezone)
									.add(i + interval, "day")
									.toISOString(),
								received: 0,
								approved: 0,
								trends: { received: 0, approved: 0 }
							});
						}
					}
					break;
				case "YEAR":
					{
						labelPlaceholder = "TO_CHAR(dc.created_at, 'FMMon') AS label";
						startDate = dayjs().tz(timezone).subtract(last, "year").startOf("year");
						endDate = dayjs().tz(timezone).subtract(last, "year").endOf("year");
						defaultResult = [
							{ label: "Jan", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Feb", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Mar", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Apr", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "May", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Jun", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Jul", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Aug", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Sep", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Oct", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Nov", received: 0, approved: 0, trends: { received: 0, approved: 0 } },
							{ label: "Dec", received: 0, approved: 0, trends: { received: 0, approved: 0 } }
						];
					}
					break;

				default:
					return null;
			}

			const receivedStatuses = [
				CASE_STATUS.SUBMITTED,
				CASE_STATUS.MANUALLY_APPROVED,
				CASE_STATUS.AUTO_APPROVED,
				CASE_STATUS.UNDER_MANUAL_REVIEW,
				CASE_STATUS.SCORE_CALCULATED,
				CASE_STATUS.MANUALLY_REJECTED,
				CASE_STATUS.PENDING_DECISION,
				CASE_STATUS.INFORMATION_REQUESTED,
				CASE_STATUS.AUTO_REJECTED,
				CASE_STATUS.ESCALATED
			];
			const approvedStatuses = [CASE_STATUS.AUTO_APPROVED, CASE_STATUS.MANUALLY_APPROVED];
			const allowedCaseTypes = [CASE_TYPE.ONBOARDING, CASE_TYPE.APPLICATION_EDIT];

			const statsQuery = `SELECT
				${labelPlaceholder},
				COUNT(dc.id) AS total_applications
			FROM data_cases dc
			INNER JOIN data_businesses db ON db.id = dc.business_id
			WHERE dc.customer_id = $1 AND dc.status = ANY($2) 
			AND dc.case_type = ANY($3)
			AND dc.created_at BETWEEN $4 AND $5
			AND db.is_deleted = false
			${this._generateFilterPlaceholder(query.filter || {})}
			GROUP BY label`;

			const [receivedStatsResult, approvedStatsResult] = await sqlTransaction(
				[statsQuery, statsQuery.replaceAll("created_at", "updated_at")],
				[
					[customerID, receivedStatuses, allowedCaseTypes, startDate, endDate],
					[customerID, approvedStatuses, allowedCaseTypes, startDate, endDate]
				]
			);

			if (!receivedStatsResult.rowCount && !approvedStatsResult.rowCount) {
				return defaultResult;
			}

			let result = this._updatedApplicationCount(defaultResult, receivedStatsResult, "received");
			result = this._updatedApplicationCount(result, approvedStatsResult, "approved");

			const responseWithTrends = this._calculateTrends(result);

			return responseWithTrends;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves the team performance statistics for a given customer.
	 * @param params - The parameters for the team performance statistics query.
	 * @param params.customerID - The ID of the customer.
	 * @param query - The query parameters for the team performance statistics query.
	 * @param query.filter_date - The filter date parameters for the team performance statistics query.
	 * @param query.filter_date.period - The period for the filter date.
	 * @param query.filter_date.last - The last value for the filter date.
	 * @param query.filter - The filter parameters for the team performance statistics query.
	 * @param query.filter.dc.assignee - The assignee filter parameter for the team performance statistics query.
	 * @returns The team performance statistics for the customer.
	 * @throws If there is an error while retrieving the data.
	 */
	async teamPerformanceStats(
		params: { customerID: string },
		query: {
			filter_date: { period: "DAY" | "WEEK" | "MONTH" | "YEAR"; last?: number; timezone?: string };
			filter: { "dc.assignee"?: string[] };
		}
	) {
		try {
			const { customerID } = params;
			const period = query?.filter_date?.period || "WEEK";
			const timezone = query?.filter_date?.timezone || "UTC";
			const last = query?.filter_date?.last || 0;

			let queriesPeriod: Array<{ start: string; end: string }> = [
				{ start: dayjs().tz(timezone).subtract(1, "week").format(), end: dayjs().tz(timezone).format() },
				{
					start: dayjs().tz(timezone).subtract(2, "week").format(),
					end: dayjs().tz(timezone).subtract(1, "week").format()
				}
			];
			switch (period) {
				case "DAY":
					queriesPeriod = [
						{
							start: dayjs().tz(timezone).subtract(last, "day").startOf("day").format(),
							end: dayjs().tz(timezone).subtract(last, "day").endOf("day").format()
						},
						{
							start: dayjs()
								.tz(timezone)
								.subtract(last + 1, "day")
								.startOf("day")
								.format(),
							end: dayjs()
								.tz(timezone)
								.subtract(last + 1, "day")
								.endOf("day")
								.format()
						}
					];
					break;
				case "WEEK":
					queriesPeriod = [
						{
							start: dayjs().tz(timezone).subtract(last, "week").startOf("week").format(),
							end: dayjs().tz(timezone).subtract(last, "week").endOf("week").format()
						},
						{
							start: dayjs()
								.tz(timezone)
								.subtract(last + 1, "week")
								.startOf("week")
								.format(),
							end: dayjs()
								.tz(timezone)
								.subtract(last + 1, "week")
								.endOf("week")
								.format()
						}
					];
					break;
				case "MONTH":
					queriesPeriod = [
						{
							start: dayjs().tz(timezone).subtract(last, "month").startOf("month").format(),
							end: dayjs().tz(timezone).subtract(last, "month").endOf("month").format()
						},
						{
							start: dayjs()
								.tz(timezone)
								.subtract(last + 1, "month")
								.startOf("month")
								.format(),
							end: dayjs()
								.tz(timezone)
								.subtract(last + 1, "month")
								.endOf("month")
								.format()
						}
					];
					break;
				case "YEAR":
					queriesPeriod = [
						{
							start: dayjs().tz(timezone).subtract(last, "year").startOf("year").format(),
							end: dayjs().tz(timezone).subtract(last, "year").endOf("year").format()
						},
						{
							start: dayjs()
								.tz(timezone)
								.subtract(last + 1, "year")
								.startOf("year")
								.format(),
							end: dayjs()
								.tz(timezone)
								.subtract(last + 1, "year")
								.endOf("year")
								.format()
						}
					];
					break;
				default:
					return null;
			}

			const finalDecisionStatuses = [
				CASE_STATUS.AUTO_APPROVED,
				CASE_STATUS.MANUALLY_APPROVED,
				CASE_STATUS.AUTO_REJECTED,
				CASE_STATUS.MANUALLY_REJECTED
			];
			const allowedCaseTypes = [CASE_TYPE.ONBOARDING, CASE_TYPE.APPLICATION_EDIT];

			const statsQuery = `SELECT
				COUNT(dc.id) AS total_applications,
				AVG(EXTRACT(EPOCH FROM (dc.updated_at - dc.created_at)) / 86400) AS average_turnaround,
				SUM(CASE WHEN dc.status IN (${CASE_STATUS.AUTO_APPROVED}, ${
					CASE_STATUS.MANUALLY_APPROVED
				}) THEN 1 ELSE 0 END) * 100.0 / COUNT(dc.id) AS approval_rate
			FROM data_cases dc
			INNER JOIN data_businesses db ON db.id = dc.business_id
			WHERE dc.customer_id = $1 AND dc.status = ANY($2)
			AND dc.case_type = ANY($3)
			AND dc.updated_at BETWEEN $4 AND $5
			AND db.is_deleted = false
			${this._generateFilterPlaceholder(query.filter || {})}`;

			const [currentStatsResult, previousStatsResult] = await sqlTransaction(
				[statsQuery, statsQuery],
				[
					[customerID, finalDecisionStatuses, allowedCaseTypes, queriesPeriod[0].start, queriesPeriod[0].end],
					[customerID, finalDecisionStatuses, allowedCaseTypes, queriesPeriod[1].start, queriesPeriod[1].end]
				]
			);

			if (!currentStatsResult.rowCount && !previousStatsResult.rowCount) {
				return {
					data: {
						application_count: 0,
						average_turnaround: 0,
						approval_rate: 0,
						application_percentage_change: 0,
						average_turnaround_percentage_change: 0,
						approval_rate_percentage_change: 0
					}
				};
			}

			const applicationPercentageChange = calculatePercentageChange(
				Number(currentStatsResult.rows[0].total_applications ?? 0),
				Number(previousStatsResult.rows[0].total_applications ?? 0)
			);
			const averageTurnaroundPercentageChange = calculatePercentageChange(
				Number(currentStatsResult.rows[0].average_turnaround ?? 0),
				Number(previousStatsResult.rows[0].average_turnaround ?? 0)
			);
			const approvalRatePercentageChange = calculatePercentageChange(
				Number(currentStatsResult.rows[0].approval_rate ?? 0),
				Number(previousStatsResult.rows[0].approval_rate ?? 0)
			);

			return {
				data: {
					application_count: Number(currentStatsResult.rows[0].total_applications ?? 0),
					average_turnaround: parseFloat(Number(currentStatsResult.rows[0].average_turnaround ?? 0).toFixed(2)),
					approval_rate: parseFloat(Number(currentStatsResult.rows[0].approval_rate ?? 0).toFixed(2)),
					application_percentage_change: Number(applicationPercentageChange.toFixed(2)),
					average_turnaround_percentage_change: Number(averageTurnaroundPercentageChange.toFixed(2)),
					approval_rate_percentage_change: Number(approvalRatePercentageChange.toFixed(2))
				}
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves the pipeline statistics for a given customer.
	 * @param params - The parameters for the pipeline statistics query.
	 * @param params.customerID - The ID of the customer.
	 * @param query - The query parameters for the pipeline statistics query.
	 * @param query.filter_date - The filter date parameters for the pipeline statistics query.
	 * @param query.filter_date.period - The period for the filter date.
	 * @param query.filter_date.last - The last value for the filter date.
	 * @param query.filter - The filter parameters for the pipeline statistics query.
	 * @returns The pipeline statistics for the customer.
	 * @throws If there is an error while retrieving the data.
	 */
	async pipelineStats(
		params: { customerID: UUID },
		query: {
			filter_date: { period: "DAY" | "WEEK" | "MONTH" | "YEAR"; last?: number; timezone?: string };
			filter: { "dc.assignee"?: UUID[] };
		}
	) {
		try {
			const { customerID } = params;
			const period = query?.filter_date?.period || "WEEK";
			const timezone = query?.filter_date?.timezone || "UTC";
			const last = query?.filter_date?.last || 0;

			let queriesPeriod: Array<{ start: string; end: string }>;
			switch (period) {
				case "DAY":
					queriesPeriod = this._generatePeriodQueries("day", last, timezone);
					break;
				case "WEEK":
					queriesPeriod = this._generatePeriodQueries("week", last, timezone);
					break;
				case "MONTH":
					queriesPeriod = this._generatePeriodQueries("month", last, timezone);
					break;
				case "YEAR":
					queriesPeriod = this._generatePeriodQueries("year", last, timezone);
					break;
				default:
					return null;
			}

			const allowedCaseTypes = [CASE_TYPE.ONBOARDING, CASE_TYPE.APPLICATION_EDIT];

			const statsQuery = `SELECT
				COUNT(dc.id) AS total_applications,
				SUM(CASE WHEN dc.status = ${CASE_STATUS.AUTO_APPROVED} THEN 1 ELSE 0 END) * 100.0 / COUNT(dc.id) AS auto_approved,
				SUM(CASE WHEN dc.status = ${CASE_STATUS.AUTO_REJECTED} THEN 1 ELSE 0 END) * 100.0 / COUNT(dc.id) AS auto_rejected,
				SUM(CASE WHEN dc.status IN (${CASE_STATUS.AUTO_APPROVED}, ${
					CASE_STATUS.MANUALLY_APPROVED
				}) THEN 1 ELSE 0 END) * 100.0 / COUNT(dc.id) AS completion_rate,
				SUM(CASE WHEN NOT EXISTS (
					SELECT 1
					FROM data_case_status_history dcsh
					WHERE dcsh.case_id = dc.id
					AND dcsh.status = ${CASE_STATUS.SUBMITTED}
				) AND NOW() - dc.created_at > INTERVAL '7 days' THEN 1 ELSE 0 END) * 100.0 / COUNT(dc.id) AS abandonment_rate
			FROM data_cases dc
			INNER JOIN data_businesses db ON db.id = dc.business_id
			WHERE dc.customer_id = $1
			AND dc.case_type = ANY($2)
			AND dc.created_at BETWEEN $3 AND $4
			AND db.is_deleted = false
			${this._generateFilterPlaceholder(query.filter || {})}`;

			const [currentStatsResult, previousStatsResult] = await sqlTransaction(
				[statsQuery, statsQuery],
				[
					[customerID, allowedCaseTypes, queriesPeriod[0].start, queriesPeriod[0].end],
					[customerID, allowedCaseTypes, queriesPeriod[1].start, queriesPeriod[1].end]
				]
			);
			if (!currentStatsResult.rowCount && !previousStatsResult.rowCount) {
				return {
					data: {
						auto_approved: 0,
						auto_rejected: 0,
						completion_rate: 0,
						abandonment_rate: 0,
						auto_approved_change: 0,
						auto_rejected_change: 0,
						completion_rate_change: 0,
						abandonment_rate_change: 0
					}
				};
			}

			const autoApprovedChange = calculatePercentageChange(
				Number(currentStatsResult.rows[0].auto_approved ?? 0),
				Number(previousStatsResult.rows[0].auto_approved ?? 0)
			);
			const autoRejectedChange = calculatePercentageChange(
				Number(currentStatsResult.rows[0].auto_rejected ?? 0),
				Number(previousStatsResult.rows[0].auto_rejected ?? 0)
			);
			const completionRateChange = calculatePercentageChange(
				Number(currentStatsResult.rows[0].completion_rate ?? 0),
				Number(previousStatsResult.rows[0].completion_rate ?? 0)
			);
			const abandonmentRateChange = calculatePercentageChange(
				Number(currentStatsResult.rows[0].abandonment_rate ?? 0),
				Number(previousStatsResult.rows[0].abandonment_rate ?? 0)
			);

			return {
				data: {
					auto_approved: Number(currentStatsResult.rows[0].auto_approved ?? 0),
					auto_rejected: Number(currentStatsResult.rows[0].auto_rejected ?? 0),
					completion_rate: parseFloat(Number(currentStatsResult.rows[0].completion_rate ?? 0).toFixed(2)),
					abandonment_rate: parseFloat(Number(currentStatsResult.rows[0].abandonment_rate ?? 0).toFixed(2)),
					auto_approved_change: Number(autoApprovedChange.toFixed(2)),
					auto_rejected_change: Number(autoRejectedChange.toFixed(2)),
					completion_rate_change: Number(completionRateChange.toFixed(2)),
					abandonment_rate_change: Number(abandonmentRateChange.toFixed(2))
				}
			};
		} catch (error) {
			throw error;
		}
	}

	_generateDayLabelPlaceholder(startDate: Dayjs, timezone: string = "UTC", interval: number = 3) {
		let labelsQueryPlaceholder = `CASE WHEN EXTRACT(HOUR FROM dc.created_at AT TIME ZONE 'UTC' AT TIME ZONE '${timezone}') <= ${interval} THEN '${dayjs(
			startDate
		)
			.tz(timezone)
			.set("hour", interval)
			.toISOString()}'
		`;
		for (let i = interval; i < 24; i += interval) {
			labelsQueryPlaceholder += ` WHEN EXTRACT(HOUR FROM dc.created_at AT TIME ZONE 'UTC' AT TIME ZONE '${timezone}') > ${i} AND EXTRACT(HOUR FROM dc.created_at AT TIME ZONE 'UTC' AT TIME ZONE '${timezone}') <= ${
				i + interval
			} THEN '${dayjs(startDate)
				.tz(timezone)
				.set("hour", i + interval)
				.toISOString()}'`;
		}
		labelsQueryPlaceholder += ` END AS label`;
		return labelsQueryPlaceholder;
	}

	_generateMonthLabelPlaceholder(startDate: Dayjs, timezone: string = "UTC", interval: number = 3) {
		let labelsQueryPlaceholder = `CASE
		`;
		for (let i = 0; i < 30; i += interval) {
			labelsQueryPlaceholder += ` WHEN dc.created_at BETWEEN '${dayjs(startDate)
				.tz(timezone)
				.add(i, "day")
				.toISOString()}' AND '${dayjs(startDate)
				.tz(timezone)
				.add(i + interval, "day")
				.toISOString()}' THEN '${dayjs(startDate)
				.tz(timezone)
				.add(i + interval, "day")
				.toISOString()}'`;
		}
		labelsQueryPlaceholder += ` END AS label`;
		return labelsQueryPlaceholder;
	}

	_generateFilterPlaceholder(filter: { "db.industry"?: number[]; "dc.assignee"?: string[] }) {
		let filterQueryPlaceholder = "";
		if (filter && Object.hasOwn(filter, "db.industry") && filter?.["db.industry"]?.length) {
			filterQueryPlaceholder += ` AND db.industry IN (${filter["db.industry"].join(",")})`;
		}
		if (filter && Object.hasOwn(filter, "dc.assignee") && filter?.["dc.assignee"]?.length) {
			filterQueryPlaceholder += ` AND dc.assignee IN (${filter["dc.assignee"].map(item => `'${item}'`).join(",")})`;
		}
		return filterQueryPlaceholder;
	}

	_updatedApplicationCount(
		defaultResult: ApplicationReceivedApprovedStatsItem[],
		statsResult: { rows: { label: string; total_applications: string }[] },
		keyToReplace: "approved" | "received"
	): ApplicationReceivedApprovedStatsItem[] {
		for (const item of statsResult.rows) {
			const index = defaultResult.findIndex(row => row.label === item.label);
			if (index !== -1) {
				defaultResult[index] = {
					...defaultResult[index],
					[keyToReplace]: parseInt(item.total_applications || "0")
				};
			}
		}

		return defaultResult;
	}

	_calculateTrends(defaultResult: ApplicationReceivedApprovedStatsItem[]) {
		return defaultResult.map((item, index) => {
			if (index === 0) {
				item.trends = {
					received: 0,
					approved: 0
				};
			} else {
				item.trends = {
					received: parseFloat(
						Number(calculatePercentageChange(item.received, defaultResult[index - 1].received)).toFixed(2)
					),
					approved: parseFloat(
						Number(calculatePercentageChange(item.approved, defaultResult[index - 1].approved)).toFixed(2)
					)
				};
			}
			return item;
		});
	}

	/**
	 * Retrieves the time to approval for cases for a given customer.
	 * @param params - The parameters for the case query.
	 * @param params.customerID - The ID of the customer.
	 * @param query - The query parameters for the case query.
	 * @param query.filter_date - The filter date parameters for the case query.
	 * @param query.filter_date.period - The period for the filter date.
	 * @param query.filter_date.last - The last value for the filter date.
	 * @param query.filter - The filter parameters for the case query query.
	 * @param query.filter.dc.assignee - The assignee filter parameter for the case query.
	 * @returns The the time to approve for all the cases based on the selected time filter.
	 * @throws If there is an error while retrieving the data.
	 */

	async timeToApproval(
		params: { customerID: UUID },
		query: {
			filter_date: { period: "DAY" | "WEEK" | "MONTH" | "YEAR"; last?: number; timezone?: string };
			filter: { "dc.assignee"?: string[] };
		}
	) {
		try {
			const DURATION = {
				DAY: "DAY",
				WEEK: "WEEK",
				MONTH: "MONTH",
				YEAR: "YEAR"
			};

			let timezone = query?.filter_date?.timezone ?? "UTC";

			let period: Array<{ start: string; end: string }> = [
				{ start: dayjs().tz(timezone).subtract(1, "week").format(), end: dayjs().tz(timezone).format() },
				{
					start: dayjs().tz(timezone).subtract(2, "week").format(),
					end: dayjs().tz(timezone).subtract(1, "week").format()
				}
			];

			if (query?.filter_date?.period) {
				switch (query.filter_date.period) {
					case DURATION.DAY:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "day").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "day").format(),
								end: dayjs().tz(timezone).subtract(1, "day").format()
							}
						];
						break;
					case DURATION.WEEK:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "week").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "week").format(),
								end: dayjs().tz(timezone).subtract(1, "week").format()
							}
						];
						break;
					case DURATION.MONTH:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "month").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "month").format(),
								end: dayjs().tz(timezone).subtract(1, "month").format()
							}
						];
						break;
					case DURATION.YEAR:
						period = [
							{ start: dayjs().tz(timezone).subtract(1, "year").format(), end: dayjs().tz(timezone).format() },
							{
								start: dayjs().tz(timezone).subtract(2, "year").format(),
								end: dayjs().tz(timezone).subtract(1, "year").format()
							}
						];
						break;
				}
			}

			const finalDecisionStatuses = [CASE_STATUS.AUTO_APPROVED, CASE_STATUS.MANUALLY_APPROVED];

			const caseQuery = `
				WITH transition_data AS (
					SELECT
						dc.id AS case_id,
						dc.customer_id,
						dc.created_at AS onboarding_time,
						dc.updated_at AS approved_time,
						FLOOR(EXTRACT(EPOCH FROM (COALESCE(dc.updated_at, NOW()) - dc.created_at)) / 86400) AS days_taken
					FROM data_cases dc
					INNER JOIN data_businesses db ON db.id = dc.business_id 
					WHERE dc.customer_id = $1
					AND dc.status = ANY($2)
					AND dc.updated_at BETWEEN $3 AND $4
					AND db.is_deleted = false
					${this._generateFilterPlaceholder(query.filter || {})}
				),
				time_ranges AS (
					SELECT '1-2 days' AS label
					UNION ALL SELECT '3-4 days'
					UNION ALL SELECT '5-6 days'
					UNION ALL SELECT '7+ days'
				)
				SELECT 
					tr.label,
					COALESCE(COUNT(td.case_id), 0) AS case_count
				FROM time_ranges tr
				LEFT JOIN transition_data td
				ON (
					(tr.label = '1-2 days' AND td.days_taken >= 0 AND td.days_taken < 3) OR
					(tr.label = '3-4 days' AND td.days_taken >= 3 AND td.days_taken < 5) OR
					(tr.label = '5-6 days' AND td.days_taken >= 5 AND td.days_taken < 7) OR
					(tr.label = '7+ days' AND td.days_taken >= 7)
				)
				GROUP BY tr.label
				ORDER BY 
					CASE 
						WHEN tr.label = '1-2 days' THEN 1
						WHEN tr.label = '3-4 days' THEN 2
						WHEN tr.label = '5-6 days' THEN 3
						ELSE 4
					END;
			`;

			const [currentPeriodDataResult, previousPeriodDataResult] = await sqlTransaction(
				[caseQuery, caseQuery],
				[
					[params.customerID, finalDecisionStatuses, period[0].start, period[0].end],
					[params.customerID, finalDecisionStatuses, period[1].start, period[1].end]
				]
			);

			const formatResponse = (label: string) => {
				const currentData = currentPeriodDataResult.rows.find(row => row.label === label) || { case_count: "0" };
				const previousData = previousPeriodDataResult.rows.find(row => row.label === label) || { case_count: "0" };

				return {
					label: label,
					current: {
						count: parseInt(currentData.case_count, 10),
						period: period[0].start
					},
					previous: {
						count: parseInt(previousData.case_count, 10),
						period: period[1].start
					}
				};
			};

			return {
				data: [
					formatResponse("1-2 days"),
					formatResponse("3-4 days"),
					formatResponse("5-6 days"),
					formatResponse("7+ days")
				]
			};
		} catch (error: any) {
			logger.error({ error }, "Error fetching case approval stats");
			throw Error("Error fetching case approval stats");
		}
	}

	// Helper function to generate period queries
	_generatePeriodQueries = (unit, last, timezone) => {
		return [
			{
				start: dayjs().tz(timezone).subtract(last, unit).startOf(unit).format(),
				end: dayjs().tz(timezone).subtract(last, unit).endOf(unit).format()
			},
			{
				start: dayjs()
					.tz(timezone)
					.subtract(last + 1, unit)
					.startOf(unit)
					.format(),
				end: dayjs()
					.tz(timezone)
					.subtract(last + 1, unit)
					.endOf(unit)
					.format()
			}
		];
	};
}

export const dashboard = new Dashboard();
