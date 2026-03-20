import { SCORE_STATUS, WEBHOOK_EVENTS, kafkaEvents, kafkaTopics } from "#constants/index";
import { logger, producer, sqlInsertRows, sqlQuery, sqlTransaction } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { schema } from "./schema";
import { getScoreDecison, saveScoreInputs, updateScore } from "../../../../workers/score/common";
import { v4 as uuidv4 } from "uuid";
import { roundNum } from "#utils/index";
import { sendWebhookEvent } from "#common/index";

class AiScoreEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.AI_SCORE_GENERATED:
					validateMessage(schema.scoreGenerated, payload);
					await this.scoreGenerated(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async scoreGenerated(body) {
		try {
			const version = body.model_metadata && body.model_metadata.model_version !== "TODO" ? body.model_metadata.model_version : "2.2";

			const getScoreIdQuery = `SELECT business_scores.id, business_scores.created_at, data_cases.id as case_id FROM business_scores
			LEFT JOIN data_cases ON data_cases.score_trigger_id = business_scores.score_trigger_id
			WHERE business_scores.score_trigger_id = $1`;
			const getScoreTriggerQuery = `SELECT * FROM business_score_triggers WHERE id = $1`;
			const [scoreIDResult, scoreTriggerResult] = await sqlTransaction([getScoreIdQuery, getScoreTriggerQuery], [[body.score_trigger_id], [body.score_trigger_id]]);

			if (!scoreTriggerResult?.rows?.length || !scoreIDResult?.rows?.[0]?.id) {
				logger.error(`Score details not found for score trigger id: ${body.score_trigger_id} and business id: ${body.business_id}`);
				return;
			}

			const scoreID = scoreIDResult.rows[0].id;
			const customerID = scoreTriggerResult.rows?.[0]?.customer_id || null;

			// get query score categories and score category factors
			let getCategoryQuery = `SELECT score_categories.id as category_id, score_categories.code, score_category_factors.id as factor_id, score_category_factors.code as factor_code FROM score_categories
				LEFT JOIN score_category_factors ON score_category_factors.category_id = score_categories.id
				WHERE score_categories.is_deleted = false AND score_categories.code IN (${Object.keys(body.categorical_scores).map(category => `'${category.toUpperCase()}'`)})`;

			// adding factors based on v2.2 model
			getCategoryQuery += ` AND score_category_factors.id BETWEEN 14 AND 27 `;

			const result = await sqlQuery({ sql: getCategoryQuery, values: [] });

			if (!result.length) {
				throw new Error("Cannot find category in ai-score");
			}

			for (const key of result) {
				const scoreFactorEntry = {
					id: uuidv4(),
					score_id: scoreID,
					category_id: key.category_id,
					factor_id: key.factor_id,
					weightage: 0, // currently not getting percent
					value: -2,
					score_100: -2,
					weighted_score_100: roundNum(body.categorical_scores[key.code.toLowerCase()].subcategory_score[key.factor_code.toLowerCase()].shap_points, 2),
					score_850: -2,
					weighted_score_850: roundNum(body.categorical_scores[key.code.toLowerCase()].subcategory_score[key.factor_code.toLowerCase()].shap_points, 2),
					base_score: roundNum(body.shap_base_points, 2),
					status: SCORE_STATUS.SUCCESS,
					log: "Success",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					version
				};

				await sqlInsertRows("business_score_factors", scoreFactorEntry);
			}

			const weightedScore100 = roundNum(body.score_0_100, 0);
			const weightedScore850 = roundNum(body.score_300_850, 0);

			// Object.values(scores).forEach(entry => {
			// 	const { weighted_score_100: s100, weighted_score_850: s850 } = entry;
			// 	weightedScore100 += s100;
			// 	weightedScore850 += s850;
			// });

			if (weightedScore850 === 0 || weightedScore850 > 850) {
				await updateScore(scoreID, { status: SCORE_STATUS.FAILED });
			}

			let score = {};
			try {
				const { risk_level: riskLevel, decision } = await getScoreDecison(weightedScore850, customerID);

				const finalScore = {
					weighted_score_100: weightedScore100,
					weighted_score_850: weightedScore850,
					score_decision: decision,
					risk_level: riskLevel,
					status: SCORE_STATUS.SUCCESS
				};

				// 	score_decision_config: latestCustomerDecision,
				// 	score_weightage_config: latestScoreConfigHistory,
				// 	created_at: new Date().toISOString(),

				score = {
					id: scoreID,
					score_trigger_id: body.score_trigger_id,
					status: SCORE_STATUS.SUCCESS,
					weighted_score_100: weightedScore100,
					weighted_score_850: weightedScore850,
					score_decision: decision,
					risk_level: riskLevel,
					updated_at: new Date().toISOString()
				};

				await updateScore(scoreID, finalScore);
			} catch (error) {
				logger.error({ error }, `Error calculating Score Decision`);
				await updateScore(scoreID, { status: SCORE_STATUS.FAILED });
				throw error;
			}
			const payload = {
				topic: kafkaTopics.SCORES,
				messages: []
			};

			if (scoreTriggerResult.rows[0].trigger_type === "APPLICATION_EDIT" && scoreIDResult.rows.length > 1) {
				scoreIDResult.rows.forEach(row => {
					payload.messages.push({
						key: scoreTriggerResult?.rows?.[0]?.business_id,
						value: {
							event: kafkaEvents.SCORE_CALCULATED,
							score_trigger_id: score.score_trigger_id,
							business_id: scoreTriggerResult.rows[0].business_id,
							customer_id: scoreTriggerResult.rows[0].customer_id,
							trigger_type: scoreTriggerResult.rows[0].trigger_type,
							score_850: score.weighted_score_850,
							score_100: score.weighted_score_100,
							risk_level: score.risk_level,
							decision: score.score_decision,
							created_at: scoreIDResult.rows[0].created_at,
							case_id: row.case_id
						}
					});
				});
			} else {
				payload.messages.push({
					key: scoreTriggerResult?.rows?.[0]?.business_id,
					value: {
						event: kafkaEvents.SCORE_CALCULATED,
						score_trigger_id: score.score_trigger_id,
						business_id: scoreTriggerResult.rows[0].business_id,
						customer_id: scoreTriggerResult.rows[0].customer_id,
						trigger_type: scoreTriggerResult.rows[0].trigger_type,
						score_850: score.weighted_score_850,
						score_100: score.weighted_score_100,
						risk_level: score.risk_level,
						decision: score.score_decision,
						created_at: scoreIDResult.rows[0].created_at,
						case_id: scoreIDResult.rows[0].case_id
					}
				});
			}

			if (body?.model_metadata?.model_input_encoded) {
				try {
					await saveScoreInputs(scoreID, body.model_metadata.model_input_encoded, body.model_metadata.model_input_raw);
				} catch (ex) {
					logger.error({ error: ex }, `scoreId=${scoreID} Error saving model input`);
				}
			}

			// 1. send webhook event
			if (scoreTriggerResult.rows[0]?.customer_id) {
				const scorePayload = {
					score_trigger_id: score.score_trigger_id,
					business_id: scoreTriggerResult.rows[0].business_id,
					customer_id: scoreTriggerResult.rows[0].customer_id,
					score: score.weighted_score_850,
					risk: score.risk_level
				};

				let eventType = WEBHOOK_EVENTS.WORTH_SCORE_GENERATED;

				if (scoreTriggerResult.rows[0].trigger_type !== "ONBOARDING_INVITE") {
					eventType = WEBHOOK_EVENTS.WORTH_SCORE_REFRESHED;
				}

				await sendWebhookEvent(scoreTriggerResult.rows[0].customer_id, eventType, scorePayload);
			}

			// 2. send event to case svc
			await producer.send(payload);
		} catch (error) {
			throw error;
		}
	}
}

export const aiScoreEventsHandler = new AiScoreEventsHandler();
