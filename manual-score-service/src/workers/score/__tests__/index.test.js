import { sqlQuery, sqlTransaction } from "#helpers/database";
import { updateToLatestScoreConfig } from "../index";
jest.mock("#helpers/database");
jest.mock("uuid");
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
describe("works/score/index.js", () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});
	describe("updateToLatestScoreConfig", () => {
		it("should update when a customer is set", async () => {
			const mockResponse = { rows: [{ id: "testId" }] };
			sqlTransaction.mockResolvedValue([mockResponse, mockResponse]);
			await updateToLatestScoreConfig("testScoreId", "testCustomerId");
			expect(sqlTransaction).toHaveBeenCalledWith([expect.any(String), expect.any(String)], [[], ["testCustomerId"]]);
			expect(sqlQuery).toHaveBeenCalledWith({ sql: expect.any(String), values: ["testId", "testId", "testScoreId"] });
		});

		it("should update when a customer is not set", async () => {
			const mockResponse = { rows: [{ id: "testId" }] };
			sqlTransaction.mockResolvedValue([mockResponse, mockResponse]);
			await updateToLatestScoreConfig("testScoreId");
			expect(sqlTransaction).toHaveBeenCalledWith([expect.any(String), expect.any(String)], [[], []]);
			expect(sqlQuery).toHaveBeenCalledWith({ sql: expect.any(String), values: ["testId", "testId", "testScoreId"] });
		});
	});
});
