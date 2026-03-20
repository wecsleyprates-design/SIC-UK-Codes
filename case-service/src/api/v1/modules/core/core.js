import { ADMIN_UUID, ERROR_CODES } from "#constants";
import { StatusCodes } from "http-status-codes";
import { refreshSubscriptionScores } from "../../../../cron/jobs/business-score-refresh";
import { sqlQuery, sqlTransaction } from "../../../../helpers/index";
import { CoreApiError } from "./error";
import { envConfig } from "#configs";

class Core {
	/**
	 * Updates core config for score refresh
	 * @param {body}
	 * @returns {}
	 */
	async updateDataRefreshConfig(body) {
		try {
			let refreshCycleInDays, refreshType;
			if (body.MONITORING_REFRESH_CONFIG_IN_DAYS) {
				refreshCycleInDays = body.MONITORING_REFRESH_CONFIG_IN_DAYS;
				refreshType = `MONITORING_REFRESH`;
			} else {
				refreshCycleInDays = body.SUBSCRIPTION_REFRESH_CONFIG_IN_DAYS;
				refreshType = `SUBSCRIPTION_REFRESH`;
			}
			await sqlQuery({
				sql: `UPDATE core_score_refresh_config SET config = jsonb_build_object('refresh_value', $1, 'unit', 'days') WHERE refresh_type = $2`,
				values: [refreshCycleInDays, refreshType]
			});
		} catch (error) {
			throw error;
		}
	}

	async getBusinessIndustries() {
		try {
			const getBusinessIndustriesQuery = "SELECT * FROM core_business_industries";
			const businessIndustries = await sqlQuery({ sql: getBusinessIndustriesQuery });
			return {
				records: businessIndustries.rows
			};
		} catch (error) {
			throw error;
		}
	}
	async getIndustriesBySector({ sector }) {
		const binds = [];
		let query = `SELECT
id,name,
  sector_code_generated::text AS sector_code
FROM
  core_business_industries,
  LATERAL generate_series(
    CASE
      WHEN sector_code LIKE '%-%' THEN CAST(split_part(sector_code, '-', 1) AS INTEGER)
      ELSE CAST(sector_code AS INTEGER)
    END,
    CASE
      WHEN sector_code LIKE '%-%' THEN CAST(split_part(sector_code, '-', 2) AS INTEGER)
      ELSE CAST(sector_code AS INTEGER)
    END
  ) AS sector_code_generated`;
		if (sector) {
			binds.push(sector);
			query += ` WHERE sector_code_generated = $1`;
		}

		const industries = await sqlQuery({ sql: query, values: binds });
		return industries.rows;
	}
	// remove after dev testing
	async tempRefreshSubscriptionScores() {
		try {
			await refreshSubscriptionScores();
		} catch (error) {
			throw error;
		}
	}

	async addCronConfig(body) {
		try {
			const insertCronConfigQuery = `INSERT INTO core_cron_config (job_type, config) VALUES ($1, $2)`;
			await sqlQuery({ sql: insertCronConfigQuery, values: [body.job_type, JSON.stringify(body.config)] });
		} catch (error) {
			throw error;
		}
	}

	async updateCronConfig(body) {
		try {
			const updateCronConfigQuery = `UPDATE core_cron_config SET config = $1 WHERE job_type = $2`;
			await sqlQuery({ sql: updateCronConfigQuery, values: [JSON.stringify(body.config), body.job_type] });
		} catch (error) {
			throw error;
		}
	}

	async getCronConfig(query) {
		try {
			const allowedSortParams = ["core_cron_config.created_at"];
			let sortParam = "core_cron_config.created_at";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			const allowedFilterParams = ["core_cron_config.job_type"];
			let existingFilterParamsValues = [];
			if (query.filter) {
				existingFilterParamsValues = Object.keys(query.filter).reduce((acc, field) => {
					if (allowedFilterParams.includes(field)) {
						let value;
						// parse string to boolean
						if (query.filter[field] === "true" || query.filter[field] === "false") {
							value = JSON.parse(query.filter[field]);
						}

						// reduce an array into a comma separated string
						if (Array.isArray(query.filter[field])) {
							value = query.filter[field].reduce((str, item) => {
								if (typeof item === "string") {
									str = str.concat(`'${item}'`, ",");
								} else {
									str = str.concat(`${item}`, ",");
								}
								return str;
							}, "");
							value = value.slice(0, -1); // remove the last comma
						} else if (typeof query.filter[field] === "string") {
							value = `'${query.filter[field]}'`;
						} else {
							value = query.filter[field].toString();
						}

						const filter = {
							column: field,
							value
						};
						acc.push(filter);
						return acc;
					}
					return acc;
				}, []);
			}

			let queryParams = "";

			if (existingFilterParamsValues.length) {
				queryParams = " WHERE ";
				let filter = " AND ";
				filter += existingFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [])
					.join(" AND ");
				queryParams += filter;
			}

			const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			queryParams += sort;

			const cronConfigQuery = `SELECT * FROM core_cron_config ${queryParams}`;
			const cronConfig = await sqlQuery({ sql: cronConfigQuery });

			return cronConfig.rows;
		} catch (error) {
			throw error;
		}
	}

	async getOnboardingStages() {
		try {
			const getQuery = `SELECT * FROM onboarding_schema.core_onboarding_stages`;
			const result = await sqlQuery({ sql: getQuery });

			return result.rows;
		} catch (error) {
			throw error;
		}
	}

	async updateOnboardingStage(body, params) {
		try {
			const updateQuery = `UPDATE onboarding_schema.core_onboarding_stages SET is_skippable = $1 WHERE id = $2`;
			await sqlQuery({ sql: updateQuery, values: [body.is_skippable, params.stageID] });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Updates the order of onboarding stages by removing the previous onboarding stages and adding the same onboarding stages but in new order.
	 *
	 * @param {Object} body - The request body containing the updated stages.
	 * @throws {CoreApiError} If the completion weightage does not sum up to 100.
	 * @throws {CoreApiError} If a new onboarding stage is added.
	 * @throws {Error} If any onboarding stage has been removed from the order.
	 */
	async updateOnboardingStagesOrder(body) {
		try {
			const getStagesQuery = `SELECT stage FROM onboarding_schema.core_onboarding_stages`;
			const getStagesResult = await sqlQuery({ sql: getStagesQuery });

			const existingStages = getStagesResult.rows.map(row => row.stage);

			const bodyStages = [];
			let completionWeightage = 0;
			body.stages.forEach(item => {
				bodyStages.push(item.stage);

				if (item.priority_order === 1) {
					item.prev_stage = null;
					item.next_stage = 2;
				} else if (item.priority_order < existingStages.length) {
					item.prev_stage = item.priority_order - 1;
					item.next_stage = item.priority_order + 1;
				} else if (item.priority_order === existingStages.length) {
					item.prev_stage = item.priority_order - 1;
					item.next_stage = null;
				}

				completionWeightage += item.completion_weightage;
			});

			if (completionWeightage !== 100) {
				throw new CoreApiError(
					`Completion weightage should sum upto exactly 100, provided completion weightage sums up to ${completionWeightage} `,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			// Remove the bottom 2 checks if there ever comes the requirement to add or remove onboarding stages on the go

			// Check if new onboarding stage was added
			bodyStages.forEach(stage => {
				if (!existingStages.includes(stage)) {
					throw new CoreApiError("Cannot add new onboarding stage", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}
			});

			// Check if any onboarding stage has been removed from the order
			const allStagesExist = existingStages.every(stage => bodyStages.includes(stage));
			if (!allStagesExist) {
				throw new Error("Provide order and details for all of the onboarding stages");
			}

			const deleteQuery = `DELETE FROM onboarding_schema.core_onboarding_stages`;
			const insertQuery = `INSERT INTO onboarding_schema.core_onboarding_stages (id, stage, priority_order, completion_weightage, allow_back_nav, is_skippable, is_enabled, next_stage, prev_stage) VALUES `;
			const values = body.stages
				.map(
					stage =>
						`(${stage.id}, '${stage.stage}', ${stage.priority_order} , ${stage.completion_weightage}, ${stage.allow_back_nav}, ${stage.is_skippable}, ${stage.is_enabled}, ${stage.next_stage}, ${stage.prev_stage})`
				)
				.join(", ");
			const finalQuery = insertQuery + values;

			await sqlTransaction([deleteQuery, finalQuery], [[], []]);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Resets the business details by setting the name, tin, and status to null for businesses that have a tin but have missing address information.
	 * @throws {Error} If there is an error while executing the SQL query.
	 */
	async resetBusinessDetails() {
		try {
			const updateQuery = `UPDATE public.data_businesses SET name = NULL, tin = NULL, status = 'UNVERIFIED', updated_by = $1 
			WHERE tin IS NOT NULL AND is_deleted = false AND ( name IS NULL OR address_line_1 IS NULL OR address_state IS NULL OR address_city IS NULL OR address_postal_code IS NULL)`;
			await sqlQuery({ sql: updateQuery, values: [ADMIN_UUID] });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Resets the business details by its ID by setting the name, tin, and status to null
	 * @throws {Error} If there is an error while executing the SQL query.
	 */
	async resetBusinessDetailsByBusinessID({ businessID }, userInfo) {
		try {
			const updateQuery = `UPDATE public.data_businesses SET name = NULL, tin = NULL, status = 'UNVERIFIED', updated_by = $1 WHERE id = $2 AND is_deleted = false`;
			await sqlQuery({ sql: updateQuery, values: [userInfo.user_id, businessID] });
		} catch (error) {
			throw error;
		}
	}

	async getNaicsCodes({ naicsCode: code }) {
		try {
			const binds = [];
			let getNaicsCodesQuery = `SELECT 
n.id as naics_id, n.code as naics_code, n.label as naics_label,
m.id as mcc_id, m.code as mcc_code, m.label as mcc_label
FROM core_naics_code n left join rel_naics_mcc r on r.naics_id = n.id left join core_mcc_code m on m.id = r.mcc_id`;
			if (code) {
				getNaicsCodesQuery += ` WHERE n.code = $1`;
				binds.push(parseInt(code));
			}
			const naicsCodes = await sqlQuery({ sql: getNaicsCodesQuery, values: binds });
			return naicsCodes.rows;
		} catch (error) {
			throw error;
		}
	}

	async getMccCodes({ mccCode: code }) {
		try {
			const binds = [];
			let getMccCodesQuery = `SELECT 
m.id as mcc_id, m.code as mcc_code, m.label as mcc_label,
n.id as naics_id, n.code as naics_code, n.label as naics_label
FROM core_mcc_code m left join rel_naics_mcc r on r.mcc_id = m.id left join core_naics_code n on n.id = r.naics_id`;
			if (code) {
				getMccCodesQuery += ` WHERE m.code = $1`;
				binds.push(parseInt(code));
			}
			const mccCodes = await sqlQuery({ sql: getMccCodesQuery, values: binds });
			return mccCodes.rows;
		} catch (error) {
			throw error;
		}
	}

	async prefillCustomerInitiatedCases() {
		try {
			const updateQuery = `UPDATE data_cases SET customer_initiated=true WHERE applicant_id=$1`;
			await sqlQuery({ sql: updateQuery, values: [envConfig.ENTERPRISE_APPLICANT_ID] });
		} catch (error) {
			throw error;
		}
	}
}

export const core = new Core();
