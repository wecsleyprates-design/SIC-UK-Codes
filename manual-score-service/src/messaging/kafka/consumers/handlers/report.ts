import { kafkaEvents, kafkaTopics } from "#constants/index";
import { logger, producer, sqlQuery } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { type KafkaMessage } from "kafkajs";
import { schema } from "./schema";
import { type I360Report } from "./types";
import { score } from "#api/v1/modules/score/score";
import { reduceScoreObject } from "#common/common";

export class ReportEventsHandler {
	async handleEvent(message: KafkaMessage) {
		try {
			if (!message.value) {
				logger.error(`Invalid message received: ${JSON.stringify(message)}`);
				return;
			}
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.FETCH_REPORT_DATA:
					validateMessage(schema.fetchReportData, payload);
					await this.fetchReportData(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			logger.error({ error }, `Unhandled exception processing event`);
			throw error;
		}
	}

	async fetchReportData(body: I360Report) {
		try {
			const [executiveSummaryData] = await Promise.all([
				this._getExecutiveSummary(body).catch(e => {
					logger.error(`_getExecutiveSummary error: ${e.message}`);
				})
			]);

			const data = {
				executive_summary: executiveSummaryData
			};

			// TODO: In progress functionality
			const message = {
				report_id: body.report_id,
				data
			};

		const payload = {
			topic: kafkaTopics.REPORTS,
			messages: [{
				key: body.report_id || body.business_id, // Fallback to business_id if report_id is not provided
				value: {
					event: kafkaEvents.UPDATE_REPORT_DATA,
					...message
				}
			}]
		};

		await producer.send(payload);
		} catch (error) {
			logger.error({ error }, `Unhandled exception processing event`);
			throw error;
		}
	}

	async _getExecutiveSummary(body: I360Report) {
		try {
			const businessID = body.business_id;
			const caseID = body.case_id;

			const getScoreQuery = `WITH score AS
            (SELECT business_scores.id, business_scores.created_at, business_scores.status, business_scores.weighted_score_100, business_scores.weighted_score_850, score_config, risk_level, score_decision, version, base_score FROM business_scores
           LEFT JOIN score_config_history ON business_scores.score_weightage_config = score_config_history.id
           LEFT JOIN business_score_factors ON business_score_factors.score_id = business_scores.id
           LEFT JOIN business_score_triggers ON business_score_triggers.id = business_scores.score_trigger_id
					 LEFT JOIN data_cases ON data_cases.score_trigger_id = business_score_triggers.id
           WHERE business_score_triggers.business_id= $1 ${caseID ? `AND data_cases.id = '${caseID}'` : ""} AND business_scores.status = 'SUCCESS' ORDER BY business_scores.created_at DESC LIMIT 1),
           factors AS
           (SELECT json_agg(business_score_factors) factors FROM score
           LEFT JOIN business_score_factors ON business_score_factors.score_id = score.id
           GROUP BY score.id)
           SELECT score.*, factors FROM score, factors`;

			const scoreResult = await sqlQuery({ sql: getScoreQuery, values: [businessID] });

			if (!scoreResult.length) {
				return {
					at_a_glance: {
						worth_score: { is_score_calculated: false, base_score: 0 }
					}
				};
			}

			const scoreData = reduceScoreObject(scoreResult);

			const scoreTrendParams = {
				businessID
			};

			const scoreTrendQuery = {};
			const scoreTrendChart = await score.getScoreTrendChart(scoreTrendQuery, scoreTrendParams);

			return {
				at_a_glance: {
					worth_score: {
						scoreData,
						is_score_calculated: true
					},
					score_trend_chart: scoreTrendChart
				}
			};
		} catch (error) {
			logger.error(`Unhandled exception processing event: ${JSON.stringify(error)}`);
			throw error;
		}
	}
}

export const reportEventsHandler = new ReportEventsHandler();
