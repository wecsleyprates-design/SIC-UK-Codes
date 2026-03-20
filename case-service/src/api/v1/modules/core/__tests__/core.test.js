import { sqlQuery } from "#helpers/database";
import { core } from "../core";

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

describe("Core", () => {
	describe("updateOnboardingStagesOrder", () => {
		it("should throw an error when new onboarding step is bein added", async () => {
			const body = {
				stages: [
					{
						id: 1,
						stage: "Stage 1",
						priority_order: 1,
						completion_weightage: 50,
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true
					},
					{
						id: 2,
						stage: "Stage 2",
						priority_order: 2,
						completion_weightage: 50,
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true
					}
				]
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						stage: "Stage 1"
					}
				]
			});

			await expect(core.updateOnboardingStagesOrder(body)).rejects.toThrow("Cannot add new onboarding stage");
		});

		it("should throw an error if completion weightage does not sum up to 100", async () => {
			const body = {
				stages: [
					{
						id: 1,
						stage: "Stage 1",
						priority_order: 1,
						completion_weightage: 50,
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true
					},
					{
						id: 2,
						stage: "Stage 2",
						priority_order: 2,
						completion_weightage: 60, // Invalid completion weightage
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true
					}
				]
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						stage: "Stage 1"
					},
					{
						stage: "Stage 2"
					}
				]
			});

			await expect(core.updateOnboardingStagesOrder(body)).rejects.toThrow(
				`Completion weightage should sum upto exactly 100, provided completion weightage sums up to 110 `
			);
		});

		it("should throw an error if all onboarding stages that exists in db arent provided in the body", async () => {
			const body = {
				stages: [
					{
						id: 1,
						stage: "Stage 1",
						priority_order: 1,
						completion_weightage: 100,
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true
					}
				]
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						stage: "Stage 1"
					},
					{
						stage: "Stage 2"
					}
				]
			});

			await expect(core.updateOnboardingStagesOrder(body)).rejects.toThrow(
				`Provide order and details for all of the onboarding stages`
			);
		});

		it("should update the order of onboarding stages", async () => {
			const body = {
				stages: [
					{
						id: 1,
						stage: "Stage 1",
						priority_order: 1,
						completion_weightage: 50,
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true
					},
					{
						id: 2,
						stage: "Stage 2",
						priority_order: 2,
						completion_weightage: 50,
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true
					},
					{
						id: 3,
						stage: "Stage 3",
						priority_order: 3,
						completion_weightage: 0,
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true
					}
				]
			};

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						stage: "Stage 1"
					},
					{
						stage: "Stage 2"
					},
					{
						stage: "Stage 3"
					}
				]
			});

			await core.updateOnboardingStagesOrder(body);
		});
	});
});
