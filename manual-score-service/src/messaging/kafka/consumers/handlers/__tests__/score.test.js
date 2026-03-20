import { scoreEventsHandler } from "../score";
import { updateToLatestScoreConfig } from "../../../../../workers/score/index";
import { kafkaEvents, kafkaTopics } from "#constants/kafka.constant";
jest.mock("../../../../../workers/score/index", () => {
	return {
		updateToLatestScoreConfig: jest.fn()
	};
});

jest.mock("#helpers/index", () => {
	const actualHelpers = jest.requireActual("#helpers/index");
	return {
		...actualHelpers,
		producer: {
			...actualHelpers.producer,
			send: jest.fn()
		},
		sqlQuery: jest.fn()
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

const { producer, sqlQuery } = require("#helpers/index");

describe("ScoreEventsHandler", () => {
	beforeEach(() => {
		updateToLatestScoreConfig.mockClear();
		producer.send.mockClear();
		sqlQuery.mockClear();
	});
	describe("refreshBusinessScore", () => {
		it("should call find most recent score trigger and send message to AI_SCORES topic", async () => {
			const scoreTriggerId = "test-score-trigger-id";
			const scoreId = "test-score-id";
			const kafkaPayload = {
				business_id: "test-business-id",
				customer_id: "test-customer-id",
				trigger_type: "MANUAL_REFRESH"
			};

			// Mock the a response from the database
			sqlQuery.mockResolvedValue([
				{
					id: scoreId,
					score_trigger_id: scoreTriggerId
				}
			]);
			// Call the method
			await scoreEventsHandler.refreshBusinessScore(kafkaPayload);

			// Assertions
			expect(updateToLatestScoreConfig).toHaveBeenCalledTimes(1);
			expect(updateToLatestScoreConfig).toHaveBeenCalledWith(scoreId, kafkaPayload.customer_id);

			expect(producer.send).toHaveBeenCalledTimes(1);
			expect(producer.send).toHaveBeenCalledWith({
				topic: kafkaTopics.AI_SCORES,
				messages: [
					{
						key: "test-business-id",
						value: {
							event: kafkaEvents.GENERATE_AI_SCORE,
							business_id: kafkaPayload.business_id,
							score_trigger_id: scoreTriggerId
						}
					}
				]
			});
		});

		it("should not call updateToLatestScoreConfig and send message to AI_SCORES topic if trigger type is not MANUAL_REFRESH", async () => {
			const kafkaPayload = {
				business_id: "test-business-id",
				customer_id: "test-customer-id",
				trigger_type: "DUMMY"
			};

			await scoreEventsHandler.refreshBusinessScore(kafkaPayload);

			// Assertions
			expect(updateToLatestScoreConfig).not.toHaveBeenCalled();
			expect(producer.send).not.toHaveBeenCalled();
		});
	});
});
