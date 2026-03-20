import { pick } from "#utils/pick";

/**
 * @param {*} scoreResult response of the getScoreQuery
 * @returns {object} reduced object of score
 */
export const reduceScoreObject = scoreResult => {
	let { factors, score_config: scoreConfig, ...score } = scoreResult[0];

	factors = factors.reduce((acc, scoreFactor) => {
		scoreFactor = pick(scoreFactor, ["category_id", "factor_id", "weightage", "value", "score_100", "weighted_score_100", "score_850", "weighted_score_850", "status", "log"]);
		acc[scoreFactor.factor_id] = scoreFactor;
		return acc;
	}, {});

	scoreConfig = typeof scoreConfig === "string" ? JSON.parse(scoreConfig) : scoreConfig;

	scoreConfig = scoreConfig.map(scoreCategory => {
		let categoryScore100 = 0;
		let categoryScore850 = 0;

		scoreCategory.factors = scoreCategory.factors.map(factor => {
			factor = { ...factor, ...factors[factor.id] };
			categoryScore100 += factor.weighted_score_100;
			categoryScore850 += factor.weighted_score_850;
			return factor;
		});

		scoreCategory.score = categoryScore100.toFixed(2); // TODO: Remove this line once the frontend is updated
		scoreCategory.score_100 = categoryScore100.toFixed(2);
		scoreCategory.score_850 = categoryScore850.toFixed(2);
		return scoreCategory;
	});

	score = { ...score, score_distribution: scoreConfig };
	return score;
};
