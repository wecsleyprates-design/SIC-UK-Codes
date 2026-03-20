import { kafkaEvents, kafkaTopics } from "#constants/kafka.constant";
import { producer } from "#helpers/kafka";
import { logger } from "#helpers/logger";
import { catchAsync } from "#utils/index";
import { score } from "./score";

export const controller = {
	getScore: catchAsync(async (req, res) => {
		const response = await score.getScore(req.query, req.params);
		res.jsend.success(response, "Success");
	}),
	getScoreDate: catchAsync(async (req, res) => {
		const response = await score.getScoreDate(req.query, req.params);
		res.jsend.success(response, "Success");
	}),
	getCaseScore: catchAsync(async (req, res) => {
		const response = await score.getCaseScore(req.params, req.query);
		res.jsend.success(response, "Success");
	}),
	patchCaseScore: catchAsync(async (req, res) => {
		const response = await score.updateCaseValuesGeneratedAt(req.params, req.body, req.query);
		res.jsend.success(response, "Success");
	}),
	forceScoreGeneration: catchAsync(async (req, res) => {
		const message = {
			business_id: req.params.businessID,
			score_trigger_id: req.params.scoreTriggerID
		};
		const payload = {
			topic: kafkaTopics.AI_SCORES,
			messages: [
				{
					key: req.params.businessID,
					value: {
						event: kafkaEvents.GENERATE_AI_SCORE,
						...message
					}
				}
			]
		};
		logger.debug(`Sending message to topic ${payload.topic} with key ${payload.messages[0].key} & message ${message}`);
		await producer.send(payload);
		res.jsend.success(message, "Success");
	}),

	getScoreInputs: catchAsync(async (req, res) => {
		const { scoreID } = req.params;
		const response = await score.getScoreInputs(scoreID);
		res.jsend.success(response, "Success");
	}),
	getScoreTrendChart: catchAsync(async (req, res) => {
		const response = await score.getScoreTrendChart(req.query, req.params);
		res.jsend.success(response, "Success");
	}),
	getScoreConfig: catchAsync(async (req, res) => {
		const response = await score.getScoreConfig();
		res.jsend.success(response, "Success");
	}),
	getCustomerScoreConfig: catchAsync(async (req, res) => {
		const response = await score.getCustomerScoreConfig(req.params);
		res.jsend.success(response, "Success");
	}),
	addCustomerScoreConfig: catchAsync(async (req, res) => {
		const response = await score.addCustomerScoreConfig(req.params, req.body);
		res.jsend.success(response, "Successfully added customer score config");
	}),
	updateCustomerScoreConfig: catchAsync(async (req, res) => {
		const response = await score.updateCustomerScoreConfig(req.params, req.body);
		res.jsend.success(response, "Successfully updated customer score config");
	}),
	// TODO: remove after executing on PROD
	scoreVersioning: catchAsync(async (req, res) => {
		const response = await score.scoreVersioning(req.params);
		res.jsend.success(response, "Success");
	})
};
