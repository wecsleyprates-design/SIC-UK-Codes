import { integrationDataHandlerForScore } from "../integrationDataHandler";
import type { IntegrationData } from "../types";
import { redis, internalGetCaseByID, sqlQuery, sqlTransaction, internalGetBusinessEntity, internalGetBusinessDetails, internalGetRevenue } from "#helpers/index";
import { v4 as uuid } from "uuid";
import type { UUID } from "crypto";

// Mock the kafkaTopics object
jest.mock("#constants/index", () => ({
	kafkaTopics: {
		CASES: "mocked.cases.v1",
		BUSINESS: "mocked.business.v1",
		SCORES: "mocked.scores.v1",
		AI_SCORES: "mocked.scores.ai.v1",
		USERS: "mocked.users.v1",
		WEBHOOKS: "mocked.webhooks.v1",
		REPORTS: "mocked.reports.v1"
	},
	SCORE_STATUS: {
		SUCCESS: "SUCCESS",
		FAILED: "FAILED",
		PROCESSING: "PROCESSING"
	}
}));
jest.mock("#helpers/index", () => ({
	redis: {
		jsonget: jest.fn(),
		jsonset: jest.fn(),
		delete: jest.fn()
	},
	logger: {
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn()
	},
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	internalGetCaseByID: jest.fn(),
	internalGetBusinessEntity: jest.fn(),
	internalGetBusinessDetails: jest.fn(),
	internalGetRevenue: jest.fn()
}));

jest.mock("#configs/env", () => ({
	KAFKA_BROKERS: "localhost:9092",
	KAFKA_SSL_ENABLED: false,
	KAFKA_CLIENT_ID: "test-client"
}));

describe("IntegrationDataHandlerForScore", () => {
	const scoreTriggerID = uuid();
	const businessID = uuid();
	const customerID = uuid();
	const caseID = uuid();
	const applicantID = uuid();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("checkScoreDataStatus", () => {
		it("should return false if no data exists in Redis", async () => {
			(redis.jsonget as jest.Mock).mockResolvedValue(null);

			const result = await integrationDataHandlerForScore.checkScoreDataStatus(scoreTriggerID as UUID, businessID as UUID, "ONBOARDING_INVITE", caseID as UUID, customerID as UUID);
			expect(result.status).toBe(false);
		});

		it("should return false if case is not submitted and manual category is missing", async () => {
			const redisData = { category: {} }; // manual missing
			(redis.jsonget as jest.Mock).mockResolvedValue(JSON.stringify(redisData));
			(internalGetCaseByID as jest.Mock).mockResolvedValue({ status_history: [{ status: "ONBOARDING" }] });

			const result = await integrationDataHandlerForScore.checkScoreDataStatus(scoreTriggerID as UUID, businessID as UUID, "ONBOARDING_INVITE", caseID as UUID, customerID as UUID);
			expect(result.status).toBe(false);
		});

		it("should return true when required categories are validated and case is submitted", async () => {
			const redisData = {
				category: {
					manual: {
						manual: [
							{
								task_code: "manual",
								status: "FAILED"
							}
						]
					},
					public_records: {
						google_places_reviews: [
							{
								task_code: "google_places_reviews",
								status: "SUCCESS"
							}
						]
					},
					banking: {
						giact: [
							{
								task_code: "giact",
								status: "SUCCESS"
							}
						]
					}
				},
				meta: {
					revenue: 100000,
					naics_code: "123456"
				},
				case_status: {
					status: "SUBMITTED"
				}
			};
			(redis.jsonget as jest.Mock).mockResolvedValue(JSON.stringify(redisData));
			(sqlQuery as jest.Mock).mockResolvedValue([
				{
					config: {
						categories: {
							bureau: {
								required: false,
								platforms: [
									{
										name: "equifax",
										required: false
									}
								],
								minPlatforms: 0
							},
							manual: {
								required: false,
								platforms: [
									{
										name: "manual",
										required: false
									}
								],
								minPlatforms: 0
							},
							banking: {
								required: true,
								platforms: [
									{
										name: "giact",
										required: false
									},
									{
										name: "plaid",
										required: false
									}
								],
								minPlatforms: 1
							},
							commerce: {
								required: false,
								platforms: [
									{
										name: "rutter_paypal",
										required: false
									},
									{
										name: "rutter_square",
										required: false
									},
									{
										name: "rutter_stripe",
										required: false
									}
								],
								minPlatforms: 0
							},
							taxation: {
								required: false,
								platforms: [
									{
										name: "taxation",
										required: false
									},
									{
										name: "electronic_signature",
										required: false
									}
								],
								minPlatforms: 0
							},
							accounting: {
								required: false,
								platforms: [
									{
										name: "quickbooks",
										required: false
									},
									{
										name: "rutter_quickbooks",
										required: false
									},
									{
										name: "rutter_freshbooks",
										required: false
									},
									{
										name: "rutter_netsuite",
										required: false
									},
									{
										name: "rutter_wave",
										required: false
									},
									{
										name: "rutter_xero",
										required: false
									},
									{
										name: "rutter_zoho",
										required: false
									},
									{
										name: "rutter_quickbooksdesktop",
										required: false
									}
								],
								minPlatforms: 0
							},
							public_records: {
								required: true,
								platforms: [
									{
										name: "adverse_media",
										required: false
									},
									{
										name: "google_business_reviews",
										required: false
									},
									{
										name: "google_places_reviews",
										required: false
									},
									{
										name: "verdata",
										required: false
									}
								],
								minPlatforms: 1
							},
							identity_verification: {
								required: false,
								platforms: [
									{
										name: "persona",
										required: false
									},
									{
										name: "plaid_idv",
										required: false
									}
								],
								minPlatforms: 0
							},
							business_entity_verification: {
								required: false,
								platforms: [
									{
										name: "middesk",
										required: false
									},
									{
										name: "npi",
										required: false
									},
									{
										name: "opencorporates",
										required: false
									},
									{
										name: "serp_scrape",
										required: false
									},
									{
										name: "zoominfo",
										required: false
									},
									{
										name: "entity_matching",
										required: false
									}
								],
								minPlatforms: 0
							}
						},
						metaCondition: {
							type: "and",
							conditions: [
								{
									type: "and",
									conditions: [
										{
											type: "and",
											conditions: [
												{
													name: "revenue",
													type: "field",
													value: 0,
													operator: "notEqual",
													required: true,
													valueType: "number"
												},
												{
													type: "or",
													conditions: [
														{
															name: "formation_date",
															type: "field",
															value: "",
															operator: "isNotNull",
															required: true,
															valueType: "string"
														},
														{
															name: "naics_code",
															type: "field",
															value: "",
															operator: "isNotNull",
															required: true,
															valueType: "string"
														}
													]
												}
											]
										}
									]
								}
							]
						}
					}
				}
			]);

			const result = await integrationDataHandlerForScore.checkScoreDataStatus(scoreTriggerID as UUID, businessID as UUID, "ONBOARDING_INVITE", caseID as UUID, customerID as UUID);
			expect(result.status).toBe(true);
			expect(redis.delete).toHaveBeenCalledWith(`{business}:${businessID}:{score_generate}:${scoreTriggerID}`);
		});

		describe("race condition handling", () => {
			const validConfig = [
				{
					config: {
						categories: {
							manual: { required: false, platforms: [{ name: "manual", required: false }], minPlatforms: 0 },
							banking: { required: true, platforms: [{ name: "giact", required: false }], minPlatforms: 1 },
							public_records: { required: true, platforms: [{ name: "google_places_reviews", required: false }], minPlatforms: 1 }
						},
						metaCondition: {
							type: "and",
							conditions: [{ name: "revenue", type: "field", value: 0, operator: "notEqual", required: true, valueType: "number" }]
						}
					}
				}
			];

			const validRedisData = {
				category: {
					manual: { manual: [{ task_code: "manual", status: "SUCCESS" }] },
					banking: { giact: [{ task_code: "giact", status: "SUCCESS" }] },
					public_records: { google_places_reviews: [{ task_code: "google_places_reviews", status: "SUCCESS" }] }
				},
				meta: { revenue: 100000 },
				case_status: { status: "SUBMITTED" }
			};

			// Case data structure expected by the code: case_status.status
			const validCaseData = { case_status: { status: "SUBMITTED" } };

			it("should return true and delete keys when data exists (first process wins)", async () => {
				// First call returns full data, second call (case check), third call (for .meta path)
				(redis.jsonget as jest.Mock)
					.mockResolvedValueOnce(JSON.stringify(validRedisData)) // Initial check
					.mockResolvedValueOnce(JSON.stringify(validCaseData)) // Case status check
					.mockResolvedValueOnce(JSON.stringify(validRedisData.meta)); // Re-fetch .meta before delete
				(sqlQuery as jest.Mock).mockResolvedValue(validConfig);

				const result = await integrationDataHandlerForScore.checkScoreDataStatus(
					scoreTriggerID as UUID,
					businessID as UUID,
					"ONBOARDING_INVITE",
					caseID as UUID,
					customerID as UUID
				);

				expect(result.status).toBe(true);
				expect(result.scoreInput).toEqual(validRedisData.meta);
				expect(redis.delete).toHaveBeenCalledWith(`{business}:${businessID}:{score_generate}:${scoreTriggerID}`);
				expect(redis.delete).toHaveBeenCalledWith(`{business}:${businessID}:{case}:${caseID}:score_generate`);
			});

			it("should return false when data was already deleted by another process (race condition detected)", async () => {
				// First call returns data, but re-fetch returns null (another process deleted it)
				(redis.jsonget as jest.Mock)
					.mockResolvedValueOnce(JSON.stringify(validRedisData)) // Initial check - data exists
					.mockResolvedValueOnce(JSON.stringify(validCaseData)) // Case status check
					.mockResolvedValueOnce(null); // Re-fetch .meta returns null - data was deleted!
				(sqlQuery as jest.Mock).mockResolvedValue(validConfig);

				const result = await integrationDataHandlerForScore.checkScoreDataStatus(
					scoreTriggerID as UUID,
					businessID as UUID,
					"ONBOARDING_INVITE",
					caseID as UUID,
					customerID as UUID
				);

				// Should detect race condition and return false to avoid duplicate processing
				expect(result.status).toBe(false);
				expect(result.scoreInput).toEqual({});
				// Should NOT call delete since data was already gone
				expect(redis.delete).not.toHaveBeenCalled();
			});

			it("should detect when another process has already deleted the data (sequential race)", async () => {
				// This test simulates the scenario where:
				// 1. Process A completes and deletes the data
				// 2. Process B then tries to process (data is already gone)
				// The re-fetch check prevents Process B from returning success

				let hasBeenDeleted = false;

				(redis.jsonget as jest.Mock).mockImplementation(async (key: string, path?: string) => {
					await Promise.resolve(); // Satisfy linter requirement for await in async function
					if (path === ".meta") {
						// If data has been deleted, return null (simulates another process winning)
						return hasBeenDeleted ? null : JSON.stringify(validRedisData.meta);
					}
					if (key.includes("case")) {
						return JSON.stringify(validCaseData);
					}
					return JSON.stringify(validRedisData);
				});

				(redis.delete as jest.Mock).mockImplementation(async () => {
					await Promise.resolve(); // Satisfy linter requirement for await in async function
					hasBeenDeleted = true;
					return true;
				});

				(sqlQuery as jest.Mock).mockResolvedValue(validConfig);

				// First call succeeds and deletes
				const result1 = await integrationDataHandlerForScore.checkScoreDataStatus(
					scoreTriggerID as UUID,
					businessID as UUID,
					"ONBOARDING_INVITE",
					caseID as UUID,
					customerID as UUID
				);

				// Second call should detect data is gone and return false
				const result2 = await integrationDataHandlerForScore.checkScoreDataStatus(
					scoreTriggerID as UUID,
					businessID as UUID,
					"ONBOARDING_INVITE",
					caseID as UUID,
					customerID as UUID
				);

				expect(result1.status).toBe(true);
				expect(result1.scoreInput).toEqual(validRedisData.meta);
				expect(result2.status).toBe(false);
				expect(result2.scoreInput).toEqual({});
			});

			it("should use native JSON path to fetch only .meta field", async () => {
				(redis.jsonget as jest.Mock)
					.mockResolvedValueOnce(JSON.stringify(validRedisData))
					.mockResolvedValueOnce(JSON.stringify(validCaseData))
					.mockResolvedValueOnce(JSON.stringify(validRedisData.meta));
				(sqlQuery as jest.Mock).mockResolvedValue(validConfig);

				await integrationDataHandlerForScore.checkScoreDataStatus(
					scoreTriggerID as UUID,
					businessID as UUID,
					"ONBOARDING_INVITE",
					caseID as UUID,
					customerID as UUID
				);

				// Verify that the third jsonget call used the .meta path
				const jsongetCalls = (redis.jsonget as jest.Mock).mock.calls;
				const metaFetchCall = jsongetCalls.find((call: string[]) => call[1] === ".meta");
				expect(metaFetchCall).toBeDefined();
				expect(metaFetchCall[0]).toBe(`{business}:${businessID}:{score_generate}:${scoreTriggerID}`);
				expect(metaFetchCall[1]).toBe(".meta");
			});
		});

		it("should return false if required categories are missing in Redis data", async () => {
			const redisData = {
				category: {
					manual: {}
					// Missing banking and public_records
				}
			};
			(redis.jsonget as jest.Mock).mockResolvedValue(JSON.stringify(redisData));
			(internalGetCaseByID as jest.Mock).mockResolvedValue({ status_history: [{ status: "SUBMITTED" }] });
			(sqlQuery as jest.Mock).mockResolvedValue([
				{
					config: {
						categories: {
							bureau: {
								required: false,
								platforms: [
									{
										name: "equifax",
										required: false
									}
								],
								minPlatforms: 0
							},
							manual: {
								required: false,
								platforms: [
									{
										name: "manual",
										required: false
									}
								],
								minPlatforms: 0
							},
							banking: {
								required: true,
								platforms: [
									{
										name: "giact",
										required: false
									},
									{
										name: "plaid",
										required: false
									}
								],
								minPlatforms: 1
							},
							commerce: {
								required: false,
								platforms: [
									{
										name: "rutter_paypal",
										required: false
									},
									{
										name: "rutter_square",
										required: false
									},
									{
										name: "rutter_stripe",
										required: false
									}
								],
								minPlatforms: 0
							},
							taxation: {
								required: false,
								platforms: [
									{
										name: "taxation",
										required: false
									},
									{
										name: "electronic_signature",
										required: false
									}
								],
								minPlatforms: 0
							},
							accounting: {
								required: false,
								platforms: [
									{
										name: "quickbooks",
										required: false
									},
									{
										name: "rutter_quickbooks",
										required: false
									},
									{
										name: "rutter_freshbooks",
										required: false
									},
									{
										name: "rutter_netsuite",
										required: false
									},
									{
										name: "rutter_wave",
										required: false
									},
									{
										name: "rutter_xero",
										required: false
									},
									{
										name: "rutter_zoho",
										required: false
									},
									{
										name: "rutter_quickbooksdesktop",
										required: false
									}
								],
								minPlatforms: 0
							},
							public_records: {
								required: true,
								platforms: [
									{
										name: "adverse_media",
										required: false
									},
									{
										name: "google_business_reviews",
										required: false
									},
									{
										name: "google_places_reviews",
										required: false
									},
									{
										name: "verdata",
										required: false
									}
								],
								minPlatforms: 1
							},
							identity_verification: {
								required: false,
								platforms: [
									{
										name: "persona",
										required: false
									},
									{
										name: "plaid_idv",
										required: false
									}
								],
								minPlatforms: 0
							},
							business_entity_verification: {
								required: false,
								platforms: [
									{
										name: "middesk",
										required: false
									},
									{
										name: "npi",
										required: false
									},
									{
										name: "opencorporates",
										required: false
									},
									{
										name: "serp_scrape",
										required: false
									},
									{
										name: "zoominfo",
										required: false
									},
									{
										name: "entity_matching",
										required: false
									}
								],
								minPlatforms: 0
							}
						},
						metaCondition: {
							type: "and",
							conditions: [
								{
									type: "and",
									conditions: [
										{
											type: "and",
											conditions: [
												{
													name: "revenue",
													type: "field",
													value: 0,
													operator: "notEqual",
													required: true,
													valueType: "number"
												},
												{
													type: "or",
													conditions: [
														{
															name: "formation_date",
															type: "field",
															value: "",
															operator: "isNotNull",
															required: true,
															valueType: "string"
														},
														{
															name: "naics_code",
															type: "field",
															value: "",
															operator: "isNotNull",
															required: true,
															valueType: "string"
														}
													]
												}
											]
										}
									]
								}
							]
						}
					}
				}
			]);

			const result = await integrationDataHandlerForScore.checkScoreDataStatus(scoreTriggerID as UUID, businessID as UUID, "ONBOARDING_INVITE", caseID as UUID, customerID as UUID);
			expect(result.status).toBe(false);
		});
	});

	describe("saveIntegrationData", () => {
		it("should save new integration data and insert into DB/Redis", async () => {
			(redis.jsonget as jest.Mock).mockResolvedValue(null);
			(sqlQuery as jest.Mock).mockImplementation(({ sql }) => {
				if (sql.includes("SELECT business_score_triggers")) return [];
				if (sql.includes("SELECT * FROM data_cases")) return [];
				return [];
			});
			(sqlTransaction as jest.Mock).mockResolvedValue([{ rows: [{ id: uuid() }] }, { rows: [{ id: uuid() }] }]);
			(internalGetBusinessEntity as jest.Mock).mockResolvedValue({ id: businessID, businessEntityVerification: { formation_date: "2020-01-01" } });
			(internalGetBusinessDetails as jest.Mock).mockResolvedValue({ id: businessID, naics_code: "123456" });
			(internalGetRevenue as jest.Mock).mockResolvedValue({ revenue: 100000 });
			const integrationData: IntegrationData = {
				score_trigger_id: scoreTriggerID as UUID,
				business_id: businessID as UUID,
				customer_id: customerID as UUID,
				applicant_id: applicantID as UUID,
				case_id: caseID as UUID,
				trigger_type: "ONBOARDING_INVITE",
				platform_category_code: "public_records",
				platform_code: "lexisnexis",
				task_code: "bjl",
				task_id: uuid() as UUID,
				task_status: "PENDING",
				platform_id: 1,
				connection_id: uuid() as UUID,
				task_label: "Task Label Example",
				trigger_version: 1
			};

			await integrationDataHandlerForScore.saveIntegrationData(integrationData);

			expect(sqlQuery).toHaveBeenCalled();
			expect(sqlTransaction).toHaveBeenCalled();
			expect(redis.jsonset).toHaveBeenCalled();
		});
	});
});
