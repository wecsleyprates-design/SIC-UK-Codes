import { integrationData } from "#lib/index";
import { roundNum, convertToObject } from "#utils/index";
import { SCORE_CATEGORIES, SCORE_STATUS } from "#constants/index";
import { getScoreFactorsConfig, calculateScore, insertFailedScoreFactor } from "./common";
import { sqlInsertRows } from "#helpers/index";
import { v4 as uuidv4 } from "uuid";

export const calculatePublicRecordsScore = async (scoreTriggerID, scoreID) => {
	try {
		const publicRecordsResponse = await integrationData.getPublicRecords({ score_trigger_id: scoreTriggerID });

		const publicRecords = {
			BANKRUPTCIES: publicRecordsResponse[0].number_of_bankruptcies === "None Found" ? 0 : parseInt(publicRecordsResponse.number_of_bankruptcies),
			LIENS: publicRecordsResponse[0].number_of_business_liens === "None Found" ? 0 : parseInt(publicRecordsResponse.number_of_business_liens),
			JUDGEMENTS: publicRecordsResponse[0].number_of_judgement_fillings === "None Found" ? 0 : parseInt(publicRecordsResponse.number_of_judgement_fillings), // TODO: fix typo
			SOCIAL_PROFILE: parseFloat(publicRecordsResponse[0].average_rating)
		};

		const scoreConfig = await getScoreFactorsConfig(SCORE_CATEGORIES.PUBLIC_RECORDS);

		const score = await Promise.all(
			scoreConfig.factors.map(async scoreFactor => {
				try {
					const score100 = calculateScore(scoreFactor.base["100"].score_evaluation_config, publicRecords[scoreFactor.code], scoreFactor.base["100"].default_score);
					const score850 = calculateScore(scoreFactor.base["850"].score_evaluation_config, publicRecords[scoreFactor.code], scoreFactor.base["850"].default_score);

					const scoreFactorEntry = {
						id: uuidv4(),
						score_id: scoreID,
						category_id: scoreFactor.category_id,
						factor_id: scoreFactor.id,
						weightage: scoreFactor.weightage,
						value: publicRecords[scoreFactor.code],
						score_100: score100,
						weighted_score_100: roundNum((score100 * scoreFactor.weightage) / 100, 2),
						score_850: score850,
						weighted_score_850: roundNum((score850 * scoreFactor.weightage) / 100, 2),
						status: SCORE_STATUS.SUCCESS,
						log: "succes",
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
					await insertFailedScoreFactor(scoreID, scoreFactor.category_id, error, scoreFactor);
					throw error;
				}
			})
		);

		return convertToObject(score, "score_factor");
	} catch (error) {
		throw error;
	}
};
