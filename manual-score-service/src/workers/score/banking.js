import { integrationData } from "#lib/index";
import { roundNum, convertToObject } from "#utils/index";
import { SCORE_CATEGORIES, SCORE_STATUS } from "#constants/index";
import { getScoreFactorsConfig, calculateScore, insertFailedScoreFactor } from "./common";
import { sqlInsertRows } from "#helpers/index";
import { v4 as uuidv4 } from "uuid";

export const calculateBankingScore = async (scoreTriggerID, scoreID) => {
	try {
		const accounts = await integrationData.getBankAccounts({ score_trigger_id: scoreTriggerID });

		// Credit Utilization = (SUM of all current balances / SUM of all balance limits)
		// NOTE: if Limit = null/ not available, then current balance is not considered in the calculation
		const { current, limit } = accounts.reduce(
			(acc, account) => {
				if (!account.balance_limit) {
					return acc;
				}

				// Both current and limit should be numbers
				if (isNaN(parseFloat(account.balance_current)) || isNaN(parseFloat(account.balance_limit))) {
					return acc;
				}

				acc.current += parseFloat(account.balance_current);
				acc.limit += parseFloat(account.balance_limit);

				return acc;
			},
			{ current: 0, limit: 1 }
		);

		let creditUtilization = (current / limit) * 100;

		const scoreConfig = await getScoreFactorsConfig(SCORE_CATEGORIES.CREDIT_UTILIZATION);

		// Round to 2 decimal places
		creditUtilization = roundNum(creditUtilization, 2);

		const score = await Promise.all(
			scoreConfig.factors.map(async scoreFactor => {
				try {
					const score100 = calculateScore(scoreFactor.base["100"].score_evaluation_config, creditUtilization, scoreFactor.base["100"].default_score);
					const score850 = calculateScore(scoreFactor.base["850"].score_evaluation_config, creditUtilization, scoreFactor.base["850"].default_score);

					const scoreFactorEntry = {
						id: uuidv4(),
						score_id: scoreID,
						category_id: scoreFactor.category_id,
						factor_id: scoreFactor.id,
						weightage: scoreFactor.weightage,
						value: creditUtilization,
						score_100: score100,
						weighted_score_100: roundNum((score100 * scoreFactor.weightage) / 100, 2),
						score_850: score850,
						weighted_score_850: roundNum((score850 * scoreFactor.weightage) / 100, 2),
						status: SCORE_STATUS.SUCCESS,
						log: "Success",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					};

					await sqlInsertRows("business_score_factors", scoreFactorEntry);

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
