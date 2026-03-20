import { sqlInsertRows, sqlQuery, sqlTransaction } from "#helpers/database";
import { SCORE_STATUS } from "#constants/index";
import { pick } from "#utils/pick";
import { v4 as uuidv4 } from "uuid";

export const getScoreFactorsConfig = async scoreCategory => {
	const getScoreFactorsConfigQuery = `WITH evaluation_config AS (SELECT config_id, json_agg(score_evaluation_config) config FROM score_evaluation_config GROUP BY config_id),
	factors AS (SELECT score_category_factors.*, rel_score_factor_evaluation_config.default_score, rel_score_factor_evaluation_config.base, evaluation_config.config score_evaluation_config FROM score_category_factors
				INNER JOIN rel_score_factor_evaluation_config ON score_category_factors.id = rel_score_factor_evaluation_config.score_factor_id
				INNER JOIN evaluation_config ON evaluation_config.config_id = rel_score_factor_evaluation_config.id
				WHERE is_deleted = false
				 )
	SELECT to_json(score_categories.*) category, factors.* FROM score_categories
		LEFT JOIN factors ON score_categories.id = factors.category_id
		WHERE score_categories.is_deleted = false AND score_categories.code = $1`;

	let response = await sqlQuery({ sql: getScoreFactorsConfigQuery, values: [scoreCategory] });

	const { category } = response[0];
	category.factors = {};

	response = response.reduce((acc, entry) => {
		const factor = pick(entry, ["id", "code", "label", "category_id", "weightage", "parent_factor_id", "is_deleted"]);

		if (!acc.factors[entry.code]) {
			acc.factors[entry.code] = {
				...factor,
				base: {
					[entry.base]: {
						default_score: entry.default_score,
						score_evaluation_config: entry.score_evaluation_config
					}
				}
			};
		} else {
			acc.factors[entry.code].base[entry.base] = {
				default_score: entry.default_score,
				score_evaluation_config: entry.score_evaluation_config
			};
		}

		return acc;
	}, category);

	response.factors = Object.values(response.factors);
	return response;
};

export const calculateScore = (scoreFactorConfig, calculatedValue, defaultScore) => {
	// // The total range of the score factor distribution should be equal to the base
	// const range = scoreFactorConfig.reduce((acc, entry) => {
	// 	const start = entry.is_start_inclusive ? entry.range_start + 0.01 : entry.range_start;
	// 	const end = entry.is_end_inclusive ? entry.range_end - 0.01 : entry.range_end;

	// 	const differece = end - start;
	// 	acc += differece;
	// 	return acc;
	// }, 0);

	// if (range !== base) {
	// 	throw new Error(`Invalid Score calculation distribution: Score factor distribution range is not equal to the base range: ${range}, base: ${base}`);
	// }

	const score = scoreFactorConfig.reduce((acc, entry) => {
		if (entry.range_start === null) {
			entry.range_start = -Infinity;
		}
		if (entry.range_end === null) {
			entry.range_end = Infinity;
		}
		switch (true) {
			case entry.is_start_inclusive && entry.is_end_inclusive:
				if (calculatedValue >= entry.range_start && calculatedValue <= entry.range_end) {
					acc = entry.score_value;
				}
				break;
			case entry.is_start_inclusive && !entry.is_end_inclusive:
				if (calculatedValue >= entry.range_start && calculatedValue < entry.range_end) {
					acc = entry.score_value;
				}
				break;
			case !entry.is_start_inclusive && entry.is_end_inclusive:
				if (calculatedValue > entry.range_start && calculatedValue <= entry.range_end) {
					acc = entry.score_value;
				}
				break;
			case !entry.is_start_inclusive && !entry.is_end_inclusive:
				if (calculatedValue > entry.range_start && calculatedValue < entry.range_end) {
					acc = entry.score_value;
				}
				break;
			default:
				break;
		}

		return acc;
	}, defaultScore);

	return score;
};

export const insertFailedScoreFactor = async (scoreID, scoreCategory, error, scoreFactor) => {
	const scoreFactorEntry = {
		id: uuidv4(),
		score_id: scoreID,
		category_id: scoreCategory,
		factor_id: scoreFactor.id,
		weightage: scoreFactor.weightage,
		value: null,
		score_100: null,
		weighted_score_100: null,
		score_850: null,
		weighted_score_850: null,
		status: SCORE_STATUS.FAILED,
		log: error.message,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};

	await sqlInsertRows("business_score_factors", scoreFactorEntry);
};

export const getScoreDecison = async (score, customerID) => {
	let customerQuery = "customer_id = $1";
	const values = [customerID];
	if (!customerID) {
		customerQuery = "customer_id IS NULL";
		values.pop();
	}
	const result = await sqlQuery({ sql: `SELECT * FROM score_decision_matrix WHERE ${customerQuery}`, values });

	let riskLevel, decision;

	for (const entry of result) {
		if (score >= entry.range_start && score <= entry.range_end) {
			riskLevel = entry.risk_level;
			decision = entry.decision;
			break;
		}
	}

	if (!riskLevel || !decision) {
		throw new Error(`No decision found for score: ${score}`);
	}
	return { risk_level: riskLevel, decision };
};

export const updateScore = async (scoreID, data) => {
	const keys = Object.keys(data);
	const queryString = keys.reduce((acc, key, index) => {
		acc += `${key} = $${index + 1}`;
		if (index !== keys.length - 1) {
			acc += ", ";
		}
		return acc;
	}, "");

	const updateScoreQuery = `UPDATE business_scores SET ${queryString} WHERE id = '${scoreID}'`;
	const updateScoreHistoryQuery = `UPDATE business_score_history SET status = $1 WHERE score_id = $2`;
	await sqlTransaction([updateScoreQuery, updateScoreHistoryQuery], [Object.values(data), [data.status, scoreID]]);
};

export const saveScoreInputs = async (scoreID, data, raw) => {
	const scoreInputs = {
		score_id: scoreID,
		inputs: JSON.stringify(data),
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		inputs_raw: JSON.stringify(raw)
	};

	await sqlInsertRows("score_inputs", scoreInputs);
};
