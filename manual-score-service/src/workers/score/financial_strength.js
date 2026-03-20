// import { integrationData } from "#lib/index";
import { roundNum, convertToObject } from "#utils/index";
import { SCORE_CATEGORIES, SCORE_STATUS } from "#constants/index";
import { getScoreFactorsConfig, calculateScore, insertFailedScoreFactor } from "./common";
import { sqlInsertRows } from "#helpers/index";
import { v4 as uuidv4 } from "uuid";

export const calculateFinancialScore = async (scoreTriggerID, scoreID) => {
	try {
		// TODO: pull integration data

		const FINANCIAL_STRENGTH = {
			// -ve values give default values
			NET_PROFIT_MARGIN: -1,
			RETURN_ON_ASSETS: -1,
			DEBT_TO_EQUITY_RATIO: -1,
			CURRENT_RATIO: -1
		};

		const scoreConfig = await getScoreFactorsConfig(SCORE_CATEGORIES.FINANCIAL_STRENGTH);

		const score = await Promise.all(
			scoreConfig.factors.map(async scoreFactor => {
				try {
					const score100 = calculateScore(scoreFactor.base["100"].score_evaluation_config, FINANCIAL_STRENGTH[scoreFactor.code], scoreFactor.base["100"].default_score);
					const score850 = calculateScore(scoreFactor.base["850"].score_evaluation_config, FINANCIAL_STRENGTH[scoreFactor.code], scoreFactor.base["850"].default_score);

					const scoreFactorEntry = {
						id: uuidv4(),
						score_id: scoreID,
						category_id: scoreFactor.category_id,
						factor_id: scoreFactor.id,
						weightage: scoreFactor.weightage,
						value: FINANCIAL_STRENGTH[scoreFactor.code],
						score_100: score100,
						weighted_score_100: roundNum((score100 * scoreFactor.weightage) / 100, 2),
						score_850: score850,
						weighted_score_850: roundNum((score850 * scoreFactor.weightage) / 100, 2),
						status: SCORE_STATUS.SUCCESS,
						log: "succes",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					};

					// const insertScoreFactor = `INSERT INTO business_score_factors  SELECT * FROM json_populate_recordset(null::business_score_factors, $1)`;
					// await sqlQuery({ sql: insertScoreFactor, values: [JSON.stringify(scoreFactorEntry)] });
					sqlInsertRows("business_score_factors", scoreFactorEntry);

					return {
						score_factor_id: scoreFactorEntry.id,
						category_id: scoreFactor.category_id,
						score_factor: scoreFactor.code,
						score_100: score100,
						score_850: score850,
						weighted_score_100: scoreFactorEntry.weighted_score_100,
						weighted_score_850: scoreFactorEntry.weighted_score_850
					};
				} catch (error) {
					await insertFailedScoreFactor(scoreID, SCORE_CATEGORIES.CREDIT_UTILIZATION, error, scoreFactor);
					throw error;
				}
			})
		);

		return convertToObject(score, "score_factor");
	} catch (error) {
		throw error;
	}
};
