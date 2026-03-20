import { calculateBankingScore } from "./banking";
import { calculatePublicRecordsScore } from "./public_records";
import { calculateFinancialScore } from "./financial_strength";
import { getScoreDecison, updateScore } from "./common";
import { logger, sqlQuery, sqlTransaction } from "#helpers/index";
import { v4 as uuidv4 } from "uuid";
import { SCORE_STATUS } from "#constants/index";
import { initTaskWorker } from "./taskHandler";

export const calculateScore = async (scoreTriggerID, customerID, businessID) => {
	try {
		const scoreID = uuidv4();
		let customerQuery = "customer_id = $1";
		const values = [customerID];
		if (!customerID) {
			customerQuery = "customer_id IS NULL";
			values.pop();
		}
		const getLatestScoreConfigHistory = `SELECT id FROM score_config_history ORDER BY created_at ASC LIMIT 1`;
		const getLatestCustomerDecision = `SELECT id FROM score_decision_history WHERE ${customerQuery} ORDER BY created_at ASC LIMIT 1`;

		let [latestScoreConfigHistory, latestCustomerDecision] = await sqlTransaction([getLatestScoreConfigHistory, getLatestCustomerDecision], [[], values]);

		latestScoreConfigHistory = latestScoreConfigHistory.rows[0].id;
		latestCustomerDecision = latestCustomerDecision.rows[0].id;
		const score = {
			id: scoreID,
			score_trigger_id: scoreTriggerID,
			status: SCORE_STATUS.PROCESSING,
			weighted_score_100: null,
			weighted_score_850: null,
			score_decision: null,
			risk_level: null,
			score_decision_config: latestCustomerDecision,
			score_weightage_config: latestScoreConfigHistory,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};

		// const scoreHistory = {
		// 	id: uuidv4(),
		// 	score_id: scoreID,
		// 	status: SCORE_STATUS.PROCESSING,
		// 	created_at: new Date().toISOString()
		// };

		// For some reason json_populate_record is not working
		const insertScore = `INSERT INTO business_scores (id, score_trigger_id, status, score_decision_config, score_weightage_config) VALUES ($1, $2, $3, $4, $5)`;
		const insertScoreHistory = `INSERT INTO business_score_history (score_id, status) VALUES ($1, $2)`;
		const insertCurrentScore = `INSERT INTO data_current_scores (score_id, business_id, customer_id) VALUES ($1, $2, $3)`;
		await sqlTransaction(
			[insertScore, insertScoreHistory, insertCurrentScore],
			[
				[scoreID, scoreTriggerID, score.status, score.score_decision_config, score.score_weightage_config],
				[scoreID, score.status],
				[scoreID, businessID, customerID]
			]
		);

		try {
			const [banking, publicRecords, financialStrength] = await Promise.all([calculateBankingScore(scoreTriggerID, scoreID), calculatePublicRecordsScore(scoreTriggerID, scoreID), calculateFinancialScore(scoreTriggerID, scoreID)]);

			let weightedScore100 = 0;
			let weightedScore850 = 0;

			const scores = { ...banking, ...publicRecords, ...financialStrength };

			Object.values(scores).forEach(entry => {
				const { weighted_score_100: s100, weighted_score_850: s850 } = entry;
				weightedScore100 += s100;
				weightedScore850 += s850;
			});

			if (weightedScore850 === 0 || weightedScore850 > 850) {
				await updateScore(scoreID, { status: SCORE_STATUS.FAILED });
			}

			try {
				const { risk_level: riskLevel, decision } = await getScoreDecison(weightedScore850, customerID);

				const finalScore = {
					weighted_score_100: weightedScore100,
					weighted_score_850: weightedScore850,
					score_decision: decision,
					risk_level: riskLevel,
					status: SCORE_STATUS.SUCCESS
				};

				score.score_decision = decision;
				score.risk_level = riskLevel;
				score.status = SCORE_STATUS.SUCCESS;
				score.weighted_score_100 = weightedScore100;
				score.weighted_score_850 = weightedScore850;

				await updateScore(scoreID, finalScore);
			} catch (error) {
				logger.error({ error }, `Error calculating Score Decision`);
				await updateScore(scoreID, { status: SCORE_STATUS.FAILED });
				throw error;
			}
		} catch (error) {
			logger.error({ error }, `Error calculating Score`);
			await updateScore(scoreID, { status: SCORE_STATUS.FAILED });
			throw error;
		}

		return score;
	} catch (error) {
		throw error;
	}
};

export const updateToLatestScoreConfig = async (scoreID, customerId) => {
	let decisionHistoryCustomer = "customer_id IS NULL";
	const decisionHistoryValues = [];
	if (customerId) {
		decisionHistoryCustomer = "customer_id = $1";
		decisionHistoryValues.push(customerId);
	}
	const getLatestScoreConfigHistory = `SELECT id FROM score_config_history ORDER BY created_at DESC LIMIT 1`;
	const getLatestCustomerDecision = `SELECT id FROM score_decision_history WHERE ${decisionHistoryCustomer} ORDER BY created_at DESC LIMIT 1`;

	const [latestScoreConfigHistory, latestCustomerDecision] = await sqlTransaction([getLatestScoreConfigHistory, getLatestCustomerDecision], [[], decisionHistoryValues]);

	if (latestCustomerDecision?.rows?.length === 1 && latestScoreConfigHistory?.rows?.length === 1) {
		const updateScoreQuery = `UPDATE business_scores SET score_decision_config = $1, score_weightage_config = $2 WHERE id = $3`;
		await sqlQuery({ sql: updateScoreQuery, values: [latestCustomerDecision.rows[0].id, latestScoreConfigHistory.rows[0].id, scoreID] });
		await sqlQuery({ sql: `DELETE from business_score_factors where score_id = $1`, values: [scoreID] });
	}
};

export const initWorkers = () => {
	initTaskWorker();
};
