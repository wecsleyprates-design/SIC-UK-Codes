import { reduceScoreObject } from "#common/common";
import { fetchScoreTriggerID } from "#helpers/api";
import { logger, sqlQuery, sqlTransaction } from "#helpers/index";
import { StatusCodes } from "http-status-codes";
import { ScoreApiError } from "./error";
import { ERROR_CODES } from "#constants/error-codes.constant";
import { isValidConfig } from "#workers/score/score_config_validator";

class Score {
	/**
	 * Fetch score for a business
	 * @param {*} query
	 * @param {*} params
	 * @param {Object} query: URL query
	 * @param {String} params.businessID: Business ID
	 * @returns {object} Detailed score of a Business
	 */
	async getScore(query, params) {
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;

		try {
			let getScoreQuery, values;
			if (Object.hasOwn(query, "score_trigger_id")) {
				getScoreQuery = `WITH score AS (SELECT business_scores.id, business_scores.created_at, business_scores.status, business_scores.weighted_score_100, business_scores.weighted_score_850, score_config, risk_level, score_decision, version, base_score FROM business_scores
			LEFT JOIN score_config_history ON business_scores.score_weightage_config = score_config_history.id
			LEFT JOIN business_score_factors ON business_score_factors.score_id = business_scores.id
			WHERE business_scores.score_trigger_id = $1 AND business_scores.status = 'SUCCESS' ORDER BY business_scores.created_at DESC LIMIT 1),
			factors AS (SELECT json_agg(business_score_factors) factors FROM score
			LEFT JOIN business_score_factors ON business_score_factors.score_id = score.id
			GROUP BY score.id)
			SELECT score.*, factors FROM score, factors`;
				values = [query.score_trigger_id];
			} else {
				getScoreQuery = `
			WITH ranked_dates AS (
    SELECT
        bs.id,
        bs.created_at,
        EXTRACT(YEAR FROM bs.created_at) AS year,
        EXTRACT(MONTH FROM bs.created_at) AS month,
        ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM bs.created_at), EXTRACT(MONTH FROM bs.created_at) ORDER BY bs.created_at DESC) AS rank
    FROM
        business_scores bs
    INNER JOIN
        data_current_scores dcs ON dcs.score_id = bs.id
    WHERE
        dcs.business_id = $1
				${query.customer_id ? ` AND dcs.customer_id = '${query.customer_id}' ` : ``}
		AND bs.status = 'SUCCESS'
),
filtered_dates AS (
    SELECT
        id,
        created_at AS most_recent_created_at,
        year,
        month
    FROM
        ranked_dates
    WHERE
        rank = 1
        AND year = $2
        AND month = $3
)
SELECT
    bs.id,
    fd.month,
    fd.year,
    bs.created_at,
    dcs.business_id,
    dcs.customer_id,
    bs.status,
    bs.score_weightage_config,
    bs.weighted_score_100,
    bs.weighted_score_850,
    bs.risk_level,
    bs.score_decision,
    bsf.base_score,
	bsf.version,
    sch.score_config::text,  -- Cast JSON to text to avoid equality operator issue
    json_agg(bsf.*) AS factors  -- Aggregate factors into a JSON array
FROM
    filtered_dates fd
LEFT JOIN
    business_scores bs ON bs.id = fd.id
INNER JOIN
    data_current_scores dcs ON bs.id = dcs.score_id
LEFT JOIN
    business_score_factors bsf ON bsf.score_id = bs.id
LEFT JOIN
    score_config_history sch ON sch.id = bs.score_weightage_config
GROUP BY
    bs.id, fd.month, fd.year, bs.created_at, dcs.business_id, dcs.customer_id, bs.status,
    bs.score_weightage_config, bs.weighted_score_100, bs.weighted_score_850, bs.risk_level,
    bs.score_decision, bsf.base_score, version,
    sch.score_config::text  -- Ensure JSON is cast to text
ORDER BY
    bs.created_at DESC;`;
				values = [params.businessID, query.year || currentYear, query.month || currentMonth];
			}
			const scoreResult = await sqlQuery({ sql: getScoreQuery, values });
			if (!scoreResult.length) {
				return { is_score_calculated: false, base_score: 0 };
			}

			const score = reduceScoreObject(scoreResult);

			// for old businesses base_score value in db is null
			return {
				...score,
				is_score_calculated: true,
				base_score: scoreResult[0].base_score ? scoreResult[0].base_score : 0,
				version: scoreResult[0].version
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Fetch score dates for a business
	 * @param {*} query
	 * @param {*} params
	 * @param {Object} query: URL query
	 * @param {String} params.businessID: Business ID
	 * @returns {object} Detailed score of a Business
	 */
	async getScoreDate(query, params) {
		let getScoreDateQuery = `
WITH ranked_dates AS (
    SELECT
        bs.id,
		bs.score_trigger_id,
        bs.created_at,
        EXTRACT(YEAR FROM bs.created_at) AS year,
        EXTRACT(MONTH FROM bs.created_at) AS month,
        ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM bs.created_at), EXTRACT(MONTH FROM bs.created_at) ORDER BY bs.created_at DESC) AS rank
    FROM
        business_scores bs
    INNER JOIN
        data_current_scores dcs ON dcs.score_id = bs.id
    WHERE
        dcs.business_id = $1
				${query.customer_id ? ` AND dcs.customer_id = '${query.customer_id}' ` : ``}
        AND bs.status = 'SUCCESS'
),
filtered_dates AS (
    SELECT
        id,
		score_trigger_id,
        created_at AS most_recent_created_at,
        year,
        month
    FROM
        ranked_dates
    	WHERE rank = 1
) select * from filtered_dates order by most_recent_created_at asc
		`;
		if (query.fetch_all_scores) {
			getScoreDateQuery = `SELECT
			bs.id,
			bs.score_trigger_id,
			bs.created_at AS most_recent_created_at,
			EXTRACT(YEAR FROM bs.created_at) AS year,
			EXTRACT(MONTH FROM bs.created_at) AS month
		FROM
			business_scores bs
		INNER JOIN
			data_current_scores dcs ON dcs.score_id = bs.id
		WHERE
			dcs.business_id = $1
					${query.customer_id ? ` AND dcs.customer_id = '${query.customer_id}' ` : ``}
			AND bs.status = 'SUCCESS' order by most_recent_created_at asc`;
		}
		const scoreDateResult = await sqlQuery({ sql: getScoreDateQuery, values: [params.businessID] });

		if (!scoreDateResult.length) {
			return [];
		}

		return scoreDateResult.map(sdr => ({ id: sdr.id, score_trigger_id: sdr.score_trigger_id, year: sdr.year, month: sdr.month, fullDate: sdr.most_recent_created_at }));
	}

	/**
	 * Fetch score for a business
	 * @param {*} params
	 * @param {String} params.caseID: case ID
	 * @returns {object} Detailed score of a case
	 * TODO: checking customer ID is related to case ID
	 */
	async getCaseScore(params, query) {
		try {
			let getScoreQuery, values;

			if (Object.hasOwn(query, "risk") && query.risk) {
				// then fetch the score trigger id from case-svc
				const data = await fetchScoreTriggerID({ case_id: params.caseID });

				if (!data.length) {
					throw new ScoreApiError("No trigger ID found for the given case", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}

				// write query based on the score-trigger-id
				getScoreQuery = `WITH score AS (SELECT business_scores.id, business_scores.created_at, business_scores.status, business_scores.weighted_score_100, business_scores.weighted_score_850, score_config, risk_level, score_decision, version, base_score FROM business_scores
					LEFT JOIN score_config_history ON business_scores.score_weightage_config = score_config_history.id
					LEFT JOIN business_score_factors ON business_score_factors.score_id = business_scores.id
					WHERE business_scores.score_trigger_id = $1 AND business_scores.status = 'SUCCESS' ORDER BY business_scores.created_at DESC LIMIT 1),
					factors AS (SELECT json_agg(business_score_factors) factors FROM score
					LEFT JOIN business_score_factors ON business_score_factors.score_id = score.id
					GROUP BY score.id)
					SELECT score.*, factors FROM score, factors`;

				values = [data[0].score_trigger_id];
			} else {
				getScoreQuery = `WITH score AS (SELECT business_scores.id, business_scores.created_at, data_cases.id as case_id, data_cases.values_generated_at, business_scores.status, business_scores.weighted_score_100, business_scores.weighted_score_850, score_config, risk_level, score_decision, version, base_score FROM business_scores
					LEFT JOIN score_config_history ON business_scores.score_weightage_config = score_config_history.id
					INNER JOIN data_cases on data_cases.score_trigger_id = business_scores.score_trigger_id
					LEFT JOIN business_score_factors ON business_score_factors.score_id = business_scores.id
					WHERE data_cases.id = $1 AND business_scores.status = 'SUCCESS' ORDER BY business_scores.created_at DESC LIMIT 1),
					factors AS (SELECT json_agg(business_score_factors) factors FROM score
					LEFT JOIN business_score_factors ON business_score_factors.score_id = score.id
					GROUP BY score.id)
					SELECT score.*, factors FROM score, factors`;

				values = [params.caseID];
			}

			const scoreResult = await sqlQuery({ sql: getScoreQuery, values });

			if (!scoreResult.length) {
				return { is_score_calculated: false, base_score: 0 };
			}

			const score = reduceScoreObject(scoreResult);

			// values_generated_at: persisted "Generated on" / "Regenerated on" date; set when user clicks Re-verify
			let valuesGeneratedAt = scoreResult[0].values_generated_at ?? null;
			if (valuesGeneratedAt && typeof valuesGeneratedAt === "object" && valuesGeneratedAt.toISOString) {
				valuesGeneratedAt = valuesGeneratedAt.toISOString();
			} else if (valuesGeneratedAt && typeof valuesGeneratedAt !== "string") {
				valuesGeneratedAt = new Date(valuesGeneratedAt).toISOString();
			}
			// Risk branch does not join data_cases; fetch values_generated_at for this case
			if (Object.hasOwn(query, "risk") && query.risk && !valuesGeneratedAt) {
				const caseMeta = await sqlQuery({
					sql: "SELECT values_generated_at FROM data_cases WHERE id = $1",
					values: [params.caseID]
				});
				if (caseMeta.length && caseMeta[0].values_generated_at) {
					const v = caseMeta[0].values_generated_at;
					valuesGeneratedAt = typeof v === "string" ? v : new Date(v).toISOString();
				}
			}

			// for old businesses base_score value in db is null
			const valuesGeneratedAtEntry = valuesGeneratedAt !== null && valuesGeneratedAt !== undefined ?
				{ values_generated_at: valuesGeneratedAt } :
				{};
			return {
				...score,
				...!score.case_id && { case_id: params.caseID },
				is_score_calculated: true,
				base_score: scoreResult[0].base_score ? scoreResult[0].base_score : 0,
				version: scoreResult[0].version,
				...valuesGeneratedAtEntry
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Persist values_generated_at for a case (Re-verify Data Now). Stored in data_cases; returned in GET case score.
	 * @param {*} params
	 * @param {string} params.caseID - case ID
	 * @param {string} body.values_generated_at - ISO8601 timestamp
	 * @returns {object} Full case score response including values_generated_at (same shape as getCaseScore)
	 */
	async updateCaseValuesGeneratedAt(params, body, query) {
		const { caseID } = params;
		const { values_generated_at: valuesGeneratedAt } = body;
		if (!valuesGeneratedAt || typeof valuesGeneratedAt !== "string") {
			throw new ScoreApiError("values_generated_at (ISO8601 string) is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const updateResult = await sqlQuery({
			sql: "UPDATE data_cases SET values_generated_at = $1::timestamptz WHERE id = $2 RETURNING id",
			values: [valuesGeneratedAt, caseID]
		});
		if (!updateResult.length) {
			throw new ScoreApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return this.getCaseScore(params, query || {});
	}

	/* Retrieve entries for score inputs by score ID */
	async getScoreInputs(scoreID) {
		try {
			const getScoreInputsQuery = `SELECT * FROM score_inputs WHERE score_id = $1`;
			const scoreInputs = await sqlQuery({ sql: getScoreInputsQuery, values: [scoreID] });
			return scoreInputs;
		} catch (ex) {
			logger.error({ error: ex }, `scoreID=${scoreID} Error in getScoreInputs`);
		}
		return null;
	}
	/**
	 * Fetch all score data for a business year wise
	 * @param {*} query
	 * @param {*} params
	 * @param {Object} query: (query.customer_id: Customer ID, query.year: Year of score values)
	 * @param {String} params.businessID: Business ID
	 * @returns {object} All score values of a year (Month wise)
	 */
	async getScoreTrendChart(query, params) {
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();

		try {
			const getYearlyScoreQuery = `
			WITH ranked_dates AS (
				SELECT
					bs.id,
					bs.created_at,
					bs.weighted_score_850,
					EXTRACT(YEAR FROM bs.created_at) AS year,
					EXTRACT(MONTH FROM bs.created_at) AS month,
					ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM bs.created_at), EXTRACT(MONTH FROM bs.created_at) ORDER BY bs.created_at DESC) AS rank
				FROM
					business_scores bs
				INNER JOIN
					data_current_scores dcs ON dcs.score_id = bs.id
				WHERE
					dcs.business_id = $1
							${query.customer_id ? ` AND dcs.customer_id = '${query.customer_id}' ` : ``}
					AND bs.status = 'SUCCESS'
			),
			filtered_dates AS (
				SELECT
					id,
					created_at,
					weighted_score_850,
					year,
					month
				FROM
					ranked_dates
				WHERE
					rank = 1
					AND year = $2
			) SELECT * FROM filtered_dates ORDER BY created_at ASC`;
			// fetch score data
			const scoreResult = await sqlQuery({ sql: getYearlyScoreQuery, values: [params.businessID, query.year || currentYear] });
			// check it is empty or not
			if (!scoreResult.length) {
				return { is_score_data_available: false };
			}
			return {
				score_data: scoreResult,
				is_score_data_available: true
			};
		} catch (error) {
			throw error;
		}
	}
	/**
	 * Fetch score config
	 * @param {*} params
	 * @returns {object} Score config
	 */
	async getScoreConfig() {
		try {
			const getScoreConfigQuery = `SELECT * FROM core_configs WHERE code = $1`;
			const scoreConfig = await sqlQuery({ sql: getScoreConfigQuery, values: ["score_config"] });
			if (!scoreConfig.length) {
				return { is_score_config_available: false };
			}
			return {
				is_score_config_available: true,
				...scoreConfig[0]
			};
		} catch (error) {
			throw error;
		}
	}
	/**
	 * Fetch customer score config
	 * @param {*} params
	 * @param {String} params.customerID: Customer ID
	 * @returns {object} Customer score config
	 */
	async getCustomerScoreConfig(params) {
		try {
			const getCustomerScoreConfigQuery = `SELECT data_customer_configs.* FROM data_customer_configs INNER JOIN core_configs ON data_customer_configs.config_id = core_configs.id WHERE data_customer_configs.customer_id = $1 AND core_configs.code = $2`;
			const customerScoreConfig = await sqlQuery({ sql: getCustomerScoreConfigQuery, values: [params.customerID, "score_config"] });
			if (!customerScoreConfig.length) {
				return { is_score_config_available: false };
			}
			return {
				is_score_config_available: true,
				...customerScoreConfig[0]
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Add customer score config
	 * @param {*} params
	 * @param {String} params.customerID: Customer ID
	 * @param {Object} body: Request body
	 */
	async addCustomerScoreConfig(params, body) {
		try {
			const { addExisting, config, isEnabled } = body;
			const getCustomerScoreConfigQuery = `SELECT data_customer_configs.* FROM data_customer_configs INNER JOIN core_configs ON data_customer_configs.config_id = core_configs.id WHERE data_customer_configs.customer_id = $1 AND core_configs.code = $2`;
			const customerScoreConfig = await sqlQuery({ sql: getCustomerScoreConfigQuery, values: [params.customerID, "score_config"] });
			if (customerScoreConfig.length) {
				throw new ScoreApiError("Customer score config already exists", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			if (addExisting) {
				// Insert into data_customer_configs using config_id selected from core_configs in a single query
				const insertCustomerScoreConfigQuery = `
						INSERT INTO data_customer_configs (customer_id, config_id, config, is_enabled)
						SELECT $1, id, config, $2 FROM core_configs WHERE code = $3`;
				await sqlQuery({
					sql: insertCustomerScoreConfigQuery,
					values: [params.customerID, isEnabled, "score_config"]
				});
			} else {
				const { success, errors } = isValidConfig(config);
				if (!success) {
					throw new ScoreApiError(`Invalid config: ${errors}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}

				const insertCustomerScoreConfigQuery = `
						INSERT INTO data_customer_configs (customer_id, config_id, config, is_enabled)
						SELECT $1, id, $2, $3 FROM core_configs WHERE code = $4`;
				await sqlQuery({
					sql: insertCustomerScoreConfigQuery,
					values: [params.customerID, JSON.stringify(config), isEnabled, "score_config"]
				});
			}
		} catch (error) {
			throw error;
		}
	}
	/**
	 * Update customer score config
	 * @param {*} params
	 * @param {String} params.customerID: Customer ID
	 * @param {Object} body: Request body
	 */
	async updateCustomerScoreConfig(params, body) {
		try {
			const { updateExisting, config, isEnabled } = body;
			const getCustomerScoreConfigQuery = `SELECT data_customer_configs.* FROM data_customer_configs INNER JOIN core_configs ON data_customer_configs.config_id = core_configs.id WHERE data_customer_configs.customer_id = $1 AND core_configs.code = $2`;
			const customerScoreConfig = await sqlQuery({ sql: getCustomerScoreConfigQuery, values: [params.customerID, "score_config"] });
			if (!customerScoreConfig.length) {
				throw new ScoreApiError("Customer score config does not exist", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			const queries = [];
			const values = [];
			if (isEnabled !== undefined) {
				const updateCustomerScoreConfigQuery = `UPDATE data_customer_configs SET is_enabled = $1 WHERE customer_id = $2 AND config_id = (SELECT id FROM core_configs WHERE code = $3)`;
				queries.push(updateCustomerScoreConfigQuery);
				values.push([isEnabled, params.customerID, "score_config"]);
			}
			if (config) {
				if (updateExisting) {
					for (const { path, value } of config) {
						const pgPath = `{${path.split(".").join(",")}}`;
						const updateCustomerScoreConfigQuery = `UPDATE data_customer_configs SET config = jsonb_set(config, $1, $2::jsonb, false) WHERE customer_id = $3 AND config_id = (SELECT id FROM core_configs WHERE code = $4)`;
						queries.push(updateCustomerScoreConfigQuery);
						values.push([pgPath, JSON.stringify(value), params.customerID, "score_config"]);
					}
				} else {
					const { success, errors } = isValidConfig(config);
					if (!success) {
						throw new ScoreApiError(`Invalid config: ${errors}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}

					const updateCustomerScoreConfigQuery = `UPDATE data_customer_configs SET config = $1 WHERE customer_id = $2 AND config_id = (SELECT id FROM core_configs WHERE code = $3)`;
					queries.push(updateCustomerScoreConfigQuery);
					values.push([JSON.stringify(config), params.customerID, "score_config"]);
				}
			}
			await sqlTransaction(queries, values);
		} catch (error) {
			throw error;
		}
	}
	// TODO: remove after executing on PROD
	// column base_score is added for v2.1 mapping
	// hence we can conclude that scores before those were of v1.0
	async scoreVersioning() {
		try {
			const updateBusinessScoreQuery = `UPDATE business_score_factors SET version = '2.1'
				WHERE base_score IS NOT NULL`;
			await sqlQuery({ sql: updateBusinessScoreQuery, values: [] });
		} catch (error) {
			throw error;
		}
	}
}

export const score = new Score();
