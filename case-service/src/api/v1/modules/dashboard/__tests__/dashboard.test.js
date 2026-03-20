import { getFlagValue } from "#helpers";
import { sqlQuery } from "#helpers/database";
import { dashboard } from "../dashboard";

jest.mock("jsonwebtoken");
jest.mock("#helpers/index");
jest.mock("#lib/index");
jest.mock("#utils/index");
jest.mock("uuid");
jest.mock("#configs/index");
jest.mock("kafkajs");
jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000, // 30*24*60*60
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60, // 10 minutes
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60 // 10 minutes
	}
}));

jest.mock("../../../../../helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

describe("Dashboard", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});
	describe("getDecisionStats", () => {
		afterEach(() => {
			jest.resetAllMocks();
		});

		it("Should return empty response if no cases found for a customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			const response = await dashboard.getDecisionStats({ customerID: "customerID" }, {});
			expect(response).toEqual({});
		});

		it("Should return filled data response if cases found for a customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 4,
				rows: [
					{
						status: 6
					},
					{
						status: 5
					},
					{
						status: 13
					},
					{
						status: 8
					}
				]
			});

			const expectedResponse = {
				decisions: {
					AUTO_APPROVED: {
						percentage: "25.00",
						count: 1
					},
					MANUALLY_APPROVED: {
						percentage: "25.00",
						count: 1
					},
					AUTO_REJECTED: {
						percentage: "25.00",
						count: 1
					},
					MANUALLY_REJECTED: {
						percentage: "25.00",
						count: 1
					}
				},
				total_case_count: 4
			};

			const response = await dashboard.getDecisionStats({ customerID: "customerID" }, {});
			expect(response).toEqual(expectedResponse);
		});

		it("Should return filled data response for in progress cases", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 3,
				rows: [
					{
						status: 3
					},
					{
						status: 4
					},
					{
						status: 10
					}
				]
			});

			const expectedResponse = {
				decisions: {
					ONBOARDING: {
						percentage: "33.33",
						count: 1
					},
					UNDER_MANUAL_REVIEW: {
						percentage: "33.33",
						count: 1
					},
					PENDING_DECISION: {
						percentage: "33.33",
						count: 1
					}
				},
				total_case_count: 3
			};
			getFlagValue.mockResolvedValueOnce(false);
			const response = await dashboard.getDecisionStats(
				{ customerID: "customerID" },
				{ require_in_progress_stats: "true" }
			);
			expect(response).toEqual(expectedResponse);
		});

		it("should return created, invited, and submitted statuses when flag is enabled", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 4,
				rows: [
					{
						status: 1
					},
					{
						status: 3
					},
					{
						status: 12
					},
					{
						status: 20
					}
				]
			});
			getFlagValue.mockResolvedValueOnce(true);
			const expectedResponse = {
				decisions: {
					CREATED: {
						percentage: "25.00",
						count: 1
					},
					INVITED: {
						percentage: "25.00",
						count: 1
					},
					ONBOARDING: {
						percentage: "25.00",
						count: 1
					},
					SUBMITTED: {
						percentage: "25.00",
						count: 1
					}
				},
				total_case_count: 4
			};
			const response = await dashboard.getDecisionStats(
				{ customerID: "customerID" },
				{ require_in_progress_stats: "true" }
			);
			expect(response).toEqual(expectedResponse);
		});
	});

	describe("getBusinessScoreRangeStats", () => {
		afterEach(() => {
			jest.resetAllMocks();
		});

		it("Should return empty response if no scores found for a customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			const response = await dashboard.averageScoreStats({ customerID: "customerID" }, {});
			expect(response).toEqual({});
		});

		it("Should return filled data response if scores in given ranges found for a customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 3,
				rows: [
					{ score_range: "0-499", count: 5 },
					{ score_range: "500-649", count: 2 },
					{ score_range: "650-XXX", count: 3 }
				]
			});

			const expectedScoreResponse = {
				score_range: {
					"0-499": {
						count: 5
					},
					"500-649": {
						count: 2
					},
					"650-XXX": {
						count: 3
					}
				}
			};

			const response = await dashboard.getBusinessScoreRangeStats({ customerID: "customerID" });
			expect(response).toEqual(expectedScoreResponse);
		});
	});

	describe("averageScoreStats", () => {
		afterEach(() => {
			jest.resetAllMocks();
		});

		it("Should return empty response if no cases found for a customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			const response = await dashboard.averageScoreStats({ customerID: "customerID" }, {});
			expect(response).toEqual({});
		});

		it("Should return filled data response if scores found for a customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 4,
				rows: [
					{ risk_level: "low", count: 1, avg: "425.00" },
					{ risk_level: "moderate", count: 1, avg: "587.00" },
					{ risk_level: "high", count: 2, avg: "700.00" },
					{ risk_level: null, count: 4, avg: "687.00" }
				]
			});

			const expectedScoreResponse = {
				risk_levels: {
					low: {
						average: "425.00",
						count: 1
					},
					moderate: {
						average: "587.00",
						count: 1
					},
					high: {
						average: "700.00",
						count: 2
					}
				},
				total: {
					average: "687.00",
					count: 4
				}
			};

			const response = await dashboard.averageScoreStats({ customerID: "customerID" }, {});
			expect(response).toEqual(expectedScoreResponse);
		});
	});

	describe("industryExposure", () => {
		afterEach(() => {
			jest.resetAllMocks();
		});

		it("Should return empty response if no details found for a customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			const response = await dashboard.industryExposure({ customerID: "customerID" });
			expect(response).toEqual({});
		});

		it("Should return industry exposure with average, min, and max scores for a customer", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 2,
				rows: [
					{
						industry: "1",
						industry_name: "Industry 1",
						business_id: "business1"
					},
					{
						industry: "2",
						industry_name: "Industry 2",
						business_id: "business2"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 2,
				rows: [{ score_850: "800" }, { score_850: "600" }]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 2,
				rows: [{ score_850: "750" }, { score_850: "650" }]
			});

			const expectedResponse = [
				{
					industry: "Industry 1",
					count: 1,
					average_score: "700.00",
					min_score: 600,
					max_score: 800
				},
				{
					industry: "Industry 2",
					count: 1,
					average_score: "700.00",
					min_score: 650,
					max_score: 750
				}
			];

			const response = await dashboard.industryExposure({ customerID: "customerID" });
			expect(response).toEqual(expectedResponse);
		});

		it("Should handle cases where some industries have no scores", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 2,
				rows: [
					{
						industry: "1",
						industry_name: "Industry 1",
						business_id: "business1"
					},
					{
						industry: "2",
						industry_name: "Industry 2",
						business_id: "business2"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 2,
				rows: [{ score_850: "750" }, { score_850: "650" }]
			});

			const expectedResponse = [
				{
					industry: "Industry 1",
					count: 1,
					average_score: "NaN",
					min_score: null,
					max_score: null
				},
				{
					industry: "Industry 2",
					count: 1,
					average_score: "700.00",
					min_score: 650,
					max_score: 750
				}
			];

			const response = await dashboard.industryExposure({ customerID: "customerID" });
			expect(response).toEqual(expectedResponse);
		});
	});
});
