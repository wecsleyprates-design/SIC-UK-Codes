import { aiScoreEventsHandler } from "../ai_score";

jest.mock("#helpers/index", () => {
	const actualHelpers = jest.requireActual("#helpers/index");
	return {
		...actualHelpers,
		producer: {
			...actualHelpers.producer,
			send: jest.fn()
		},
		sqlQuery: jest.fn(),
		sqlTransaction: jest.fn()
	};
});
jest.mock("#configs/index", () => {
	const { Partitioners } = require("kafkajs");
	return {
		envConfig: {
			KAFKA_BROKERS: "mocked_brokers",
			KAFKA_SSL_ENABLED: false,
			KAFKA_CLIENT_ID: "mocked_client_id"
			//   ... other mocked configuration properties
		},
		kafkaConfig: {},
		consumerConfig: { groupId: "testGroupId" },
		producerConfig: {
			createPartitioner: Partitioners.LegacyPartitioner
		}
	};
});
jest.mock("../../../../../workers/score/common");

import { saveScoreInputs, getScoreDecison, updateScore } from "../../../../../workers/score/common";

const { producer, sqlQuery, sqlTransaction } = require("#helpers/index");

describe("aiScoreGenerated Handler", () => {
	beforeEach(() => {
		producer.send.mockClear();
		sqlQuery.mockClear();
		sqlTransaction.mockClear();
	});
	const modelInput = {
		testing: 123,
		friend: "matt"
	};
	const scoreTriggerId = "test-score-trigger-id";
	const kafkaPayload = {
		score_trigger_id: scoreTriggerId,
		business_id: "test-business-id",
		score_300_850: 700,
		score_0_100: 70,
		categorical_scores: {
			test: {}
		},
		model_metadata: {
			model_version: "tbd",
			shap_scores: "yes",
			model_input: modelInput
		}
	};
	it.skip("saves score inputs", async () => {
		const testId = "testId";
		const mockResponse = { rows: [{ id: testId }] };

		getScoreDecison.mockResolvedValue("true");
		updateScore.mockResolvedValue("true");
		sqlTransaction.mockResolvedValue([mockResponse, mockResponse]);
		sqlQuery.mockResolvedValue([
			{
				id: 1,
				score_trigger_id: scoreTriggerId
			}
		]);
		await aiScoreEventsHandler.scoreGenerated(kafkaPayload);
		expect(saveScoreInputs).toHaveBeenCalledWith(testId, modelInput);
	});
});
