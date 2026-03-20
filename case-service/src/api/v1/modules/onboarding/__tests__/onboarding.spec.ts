import { OnboardingApiError } from "../error"; // Adjust the error import as needed
import { onboarding } from "../onboarding"; // Replace with your actual module path
import { getCustomerIntegrationSettings, sqlQuery, sqlSequencedTransaction, sqlTransaction, db } from "#helpers/index";
import { Tracker, createTracker } from "knex-mock-client";
import { UUID } from "crypto";
import { CUSTOM_ONBOARDING_SETUP, CUSTOM_ONBOARDING_TYPES, SECTION_VISIBILITY } from "#constants";
import { businesses } from "../../businesses/businesses";

require("kafkajs");

jest.mock("kafkajs");
jest.mock("crypto");
jest.mock("#utils/index");
jest.mock("#constants");
jest.mock("#configs/index", () => ({
	envConfig: {
		CRYPTO_SECRET_KEY: "secretkey",
		CRYPTO_IV: "cryptoiv",
		STRIPE_SECRET_KEY: "stripesecretkey",
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
	}
}));

jest.mock("#helpers/index", () => {
	const { MockClient } = require("knex-mock-client");
	const { knex } = require("knex");
	return {
		sqlQuery: jest.fn(),
		sqlSequencedTransaction: jest.fn(),
		sqlTransaction: jest.fn(),
		getCustomerIntegrationSettings: jest.fn(),
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		},
		BullQueue: jest.fn().mockImplementation(() => {
			return {};
		}),
		db: knex({ client: MockClient, dialect: "pg" }),
		producer: {
			send: jest.fn()
		}
	};
});

jest.mock("#workers/invitationStatus", () => ({
	invitationStatusQueue: {
		addJob: jest.fn(),
		getJobByID: jest.fn(),
		removeJobByID: jest.fn()
	}
}));

const mockedSqlQuery = sqlQuery as jest.Mock; // Cast the imported function to Jest's mock type
const mockedSqlSequencedTransaction = sqlSequencedTransaction as jest.Mock;
const mockedSqlTransaction = sqlTransaction as jest.Mock;

describe("Onboarding", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("getCustomerOnboardingSetups", () => {
		afterEach(() => {
			jest.clearAllMocks();
		});

		it("should return existing onboarding setups", async () => {
			const mockResult = {
				rows: [
					{ setup_id: 1, is_enabled: true, code: "SETUP_1", label: "Setup 1" },
					{ setup_id: 2, is_enabled: false, code: "SETUP_2", label: "Setup 2" }
				]
			};
			mockedSqlQuery.mockResolvedValueOnce(mockResult);

			const params = { customerID: "customer123" };
			const result = await onboarding.getCustomerOnboardingSetups(params);

			expect(sqlQuery).toHaveBeenCalledWith({
				sql: expect.stringContaining("SELECT rcss.setup_id"),
				values: [params.customerID]
			});
			expect(result).toEqual(mockResult.rows);
		});

		it("should throw an error if fetching existing setups fails", async () => {
			mockedSqlQuery.mockRejectedValueOnce(new Error("SQL error"));

			await expect(onboarding.getCustomerOnboardingSetups({ customerID: "customer123" })).rejects.toThrow("SQL error");

			expect(mockedSqlQuery).toHaveBeenCalledWith({
				sql: expect.stringContaining("SELECT rcss.setup_id"),
				values: ["customer123"]
			});
		});

		it("should handle invalid customerID gracefully", async () => {
			mockedSqlQuery.mockResolvedValueOnce({ rows: [] });

			const result = await onboarding.getCustomerOnboardingSetups({ customerID: "" });

			expect(mockedSqlQuery).toHaveBeenCalledWith({
				sql: expect.stringContaining("SELECT rcss.setup_id"),
				values: [""]
			});
			expect(result).toEqual([]);
		});
	});

	describe("createCustomerOnboardingSetups", () => {
		afterEach(() => {
			jest.clearAllMocks();
		});

		it("should insert setups with correct permissions", async () => {
			const customerID = "customer123";

			mockedSqlQuery.mockResolvedValueOnce({
				rows: [
					{ id: 1, code: "SETUP_1", label: "Setup 1" },
					{ id: 2, code: "SETUP_2", label: "Setup 2" }
				]
			});

			mockedSqlSequencedTransaction.mockResolvedValueOnce({});

			const result = await onboarding.createCustomerOnboardingSetups(customerID, {
				module_permissions: { onboarding: false, white_labeling: false }
			});

			expect(mockedSqlQuery).toHaveBeenNthCalledWith(1, {
				sql: expect.stringContaining("SELECT * FROM onboarding_schema.core_onboarding_setup_types"),
				values: []
			});
			expect(mockedSqlSequencedTransaction).toHaveBeenCalledWith(
				expect.arrayContaining([expect.stringContaining("INSERT INTO onboarding_schema.rel_customer_setup_status")]),
				expect.any(Array)
			);
			expect(result).toEqual([
				{ code: "SETUP_1", label: "Setup 1", setup_id: 1, is_enabled: false },
				{ code: "SETUP_2", label: "Setup 2", setup_id: 2, is_enabled: false }
			]);
		});

		it("should throw an error if fetching core setups fails", async () => {
			const customerID = "customer123";

			mockedSqlQuery.mockRejectedValueOnce(new Error("SQL error on core setups"));

			await expect(
				onboarding.createCustomerOnboardingSetups(customerID, { module_permissions: { onboarding: true } })
			).rejects.toThrow("SQL error on core setups");
		});

		it("should return empty array if no core setups exist", async () => {
			const customerID = "customer123";

			// Mock core setups fetch (first call)
			mockedSqlQuery.mockResolvedValueOnce({ rows: [] }); // No core setups

			// Mock existing setups fetch (second call)
			mockedSqlQuery.mockResolvedValueOnce({ rows: [] }); // No existing setups

			const result = await onboarding.createCustomerOnboardingSetups(customerID, {
				module_permissions: { onboarding: true }
			});

			// First: core setups
			expect(mockedSqlQuery).toHaveBeenNthCalledWith(1, {
				sql: expect.stringContaining("SELECT * FROM onboarding_schema.core_onboarding_setup_types"),
				values: []
			});

			expect(result).toEqual([]);
		});

		it("should throw an error if transaction for inserting setups fails", async () => {
			const customerID = "customer123";

			mockedSqlQuery.mockResolvedValueOnce({
				rows: [
					{ id: 1, code: "SETUP_1", label: "Setup 1" },
					{ id: 2, code: "SETUP_2", label: "Setup 2" }
				]
			});

			mockedSqlSequencedTransaction.mockRejectedValueOnce(new Error("Transaction error"));

			await expect(
				onboarding.createCustomerOnboardingSetups(customerID, { module_permissions: { onboarding: true } })
			).rejects.toThrow("Transaction error");

			expect(mockedSqlQuery).toHaveBeenNthCalledWith(1, {
				sql: expect.stringContaining("SELECT * FROM onboarding_schema.core_onboarding_setup_types"),
				values: []
			});
			expect(mockedSqlSequencedTransaction).toHaveBeenCalledWith(
				expect.arrayContaining([expect.stringContaining("INSERT INTO onboarding_schema.rel_customer_setup_status")]),
				expect.any(Array)
			);
		});
	});

	describe("updateCustomerOnboardingStages", () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("should update customer onboarding stages and configurations successfully", async () => {
			const params = { customerID: "customer123" };
			const body = {
				setupType: "normal_onboarding",
				stages: [
					{
						stage_id: "stage123",
						stage: "Stage 1",
						is_enabled: true,
						is_skippable: false,
						config: {
							fields: [
								{ name: "field1", section_name: "section1", status: "Optional" },
								{ name: "field2", section_name: null, status: "Required" }
							],
							integrations: [
								{ name: "integration1", is_enabled: true },
								{ name: "integration2", is_enabled: false }
							],
							additional_settings: [
								{ name: "setting1", is_enabled: true },
								{ name: "setting2", is_enabled: false }
							]
						}
					}
				]
			};
			const userInfo = { user_id: "user123" };

			const mockCustomerIntegrationSettings = {
				customer_id: "customerID",
				settings: {
					isBJLEnabled: false,
					isGiactGverifyEnabled: false,
					isGiactGauthenticateEnabled: false
				}
			};

			(getCustomerIntegrationSettings as jest.Mock).mockResolvedValue(mockCustomerIntegrationSettings);

			mockedSqlSequencedTransaction.mockResolvedValueOnce({});

			await expect(onboarding.updateCustomerOnboardingStages(params, body, userInfo)).resolves.not.toThrow();

			expect(sqlSequencedTransaction).toHaveBeenCalledTimes(1);

			const queries = mockedSqlSequencedTransaction.mock.calls[0][0];
			const values = mockedSqlSequencedTransaction.mock.calls[0][1];

			// Verify the number of queries generated
			expect(queries.length).toBeGreaterThan(0);

			// Verify the main update query for the stages
			expect(queries[0]).toContain("UPDATE onboarding_schema.data_customer_onboarding_stages");

			// Verify the update query for fields configuration
			expect(queries.some(q => q.includes("UPDATE onboarding_schema.data_customer_stage_fields_config"))).toBe(true);

			// Verify the `next_stage` and `prev_stage` updates
			expect(queries.some(q => q.includes("SET next_stage"))).toBe(true);
			expect(queries.some(q => q.includes("SET prev_stage"))).toBe(true);

			// Verify the values passed
			expect(values).toContainEqual(
				expect.arrayContaining(["field1", "section1", "Optional", "stage123", "customer123"])
			);
			expect(values).toContainEqual(expect.arrayContaining(["integration1", true, "stage123", "customer123"]));
			expect(values).toContainEqual(expect.arrayContaining(["setting1", true, "stage123", "customer123"]));
		});

		it("should throw an error if sqlSequencedTransaction fails", async () => {
			const params = { customerID: "customer123" };
			const body = {
				setupType: "normal_onboarding",
				stages: []
			};
			const userInfo = { user_id: "user123" };

			const mockCustomerIntegrationSettings = {
				customer_id: "customerID",
				settings: {
					isBJLEnabled: false,
					isGiactGverifyEnabled: false,
					isGiactGauthenticateEnabled: false
				}
			};

			(getCustomerIntegrationSettings as jest.Mock).mockResolvedValue(mockCustomerIntegrationSettings);

			mockedSqlSequencedTransaction.mockRejectedValueOnce(new Error("Transaction error"));

			await expect(onboarding.updateCustomerOnboardingStages(params, body, userInfo)).rejects.toThrow(
				"Transaction error"
			);

			expect(sqlSequencedTransaction).toHaveBeenCalledTimes(1);
		});
	});

	describe("reorderStages", () => {
		const customerID = "customer-uuid" as UUID;
		const mockStages = [
			{ id: "stage-uuid-1", priority_order: 1, is_orderable: true, stage: "Stage 1" },
			{ id: "stage-uuid-2", priority_order: 2, is_orderable: false, stage: "Stage 2" },
			{ id: "stage-uuid-3", priority_order: 3, is_orderable: true, stage: "Stage 3" }
		];

		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("should reorder stages successfully when input is valid", async () => {
			const body = {
				onboardingType: CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING,
				stages: [
					{ priorityOrder: 3, stageID: "stage-uuid-1" as UUID },
					{ priorityOrder: 1, stageID: "stage-uuid-3" as UUID }
				]
			};

			mockedSqlQuery.mockResolvedValueOnce({ rows: mockStages });
			mockedSqlSequencedTransaction.mockResolvedValueOnce(null);

			await onboarding.reorderStages(body, { customerID });

			expect(sqlQuery).toHaveBeenCalledTimes(1);

			expect(sqlSequencedTransaction).toHaveBeenCalledTimes(1);
		});

		it("should throw an error if a non-orderable stage is attempted to be reordered", async () => {
			const body = {
				onboardingType: CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING,
				stages: [{ priorityOrder: 1, stageID: "stage-uuid-2" as UUID }]
			};

			mockedSqlQuery.mockResolvedValueOnce({ rows: mockStages }).mockResolvedValueOnce({ rows: mockStages });

			await expect(onboarding.reorderStages(body, { customerID })).rejects.toThrow(OnboardingApiError);
			await expect(onboarding.reorderStages(body, { customerID })).rejects.toThrow("Stage Stage 2 is not orderable");

			expect(sqlQuery).toHaveBeenCalledTimes(2);
			expect(sqlSequencedTransaction).not.toHaveBeenCalled();
		});

		it("should not perform any updates if no changes are detected", async () => {
			const body = {
				onboardingType: CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING,
				stages: [
					{ priorityOrder: 1, stageID: "stage-uuid-1" as UUID },
					{ priorityOrder: 2, stageID: "stage-uuid-2" as UUID }
				]
			};

			mockedSqlQuery.mockResolvedValueOnce({ rows: mockStages });

			await onboarding.reorderStages(body, { customerID });

			expect(sqlQuery).toHaveBeenCalledTimes(1);
			expect(sqlSequencedTransaction).not.toHaveBeenCalled();
		});

		it("should throw an error if `sqlQuery` fails", async () => {
			const body = {
				onboardingType: CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING,
				stages: [{ priorityOrder: 1, stageID: "stage-uuid-1" as UUID }]
			};

			(sqlQuery as jest.Mock).mockRejectedValueOnce(new Error("Database query failed"));

			await expect(onboarding.reorderStages(body, { customerID })).rejects.toThrow("Database query failed");

			expect(sqlQuery).toHaveBeenCalledTimes(1);
			expect(sqlSequencedTransaction).not.toHaveBeenCalled();
		});

		it("should handle errors during `sqlSequencedTransaction` execution", async () => {
			const body = {
				onboardingType: CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING,
				stages: [{ priorityOrder: 3, stageID: "stage-uuid-1" as UUID }]
			};

			(sqlQuery as jest.Mock).mockResolvedValueOnce({ rows: mockStages });
			(sqlSequencedTransaction as jest.Mock).mockRejectedValueOnce(new Error("Transaction failed"));

			await expect(onboarding.reorderStages(body, { customerID })).rejects.toThrow("Transaction failed");

			expect(sqlQuery).toHaveBeenCalledTimes(1);
			expect(sqlSequencedTransaction).toHaveBeenCalledTimes(1);
		});
	});

	describe("getCustomerOnboardingStages", () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("should return customer onboarding stages when setup is enabled", async () => {
			const params = { customerID: "customer-uuid" };
			const body = { setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP };

			const onboardingSetupResult = {
				rows: [
					{
						setup_id: "setup-uuid",
						is_enabled: true,
						code: "MODIFY_PAGES_FIELDS_SETUP",
						label: "Modify Pages Fields Setup"
					}
				]
			};

			const onboardingStagesResult = {
				rows: [
					{
						stage_id: "stage-uuid",
						stage: "Stage Name",
						completion_weightage: 50,
						allow_back_nav: true,
						is_skippable: false,
						is_enabled: true,
						is_removable: true,
						is_orderable: false,
						next_stage: null,
						prev_stage: "prev-stage-uuid",
						priority_order: 1,
						stage_code: "STAGE_CODE",
						config: { fields: [] }
					}
				]
			};

			mockedSqlQuery
				.mockResolvedValueOnce(onboardingSetupResult) // First query: Check setup
				.mockResolvedValueOnce(onboardingStagesResult); // Second query: Get stages

			const result = await onboarding.getCustomerOnboardingStages(params, body);

			expect(sqlQuery).toHaveBeenCalledTimes(2);
			expect(sqlQuery).toHaveBeenNthCalledWith(1, {
				sql: expect.stringContaining("SELECT rcss.setup_id, rcss.is_enabled"),
				values: [params.customerID, body.setupType]
			});
			expect(sqlQuery).toHaveBeenNthCalledWith(2, {
				sql: expect.stringContaining("SELECT dcos.id AS stage_id"),
				values: [params.customerID, CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING]
			});
			expect(result).toEqual(onboardingStagesResult.rows);
		});

		it("should throw an error if the onboarding setup is not found or not enabled", async () => {
			const params = { customerID: "customer-uuid" };
			const body = { setupType: "INVALID_SETUP_TYPE" };

			const onboardingSetupResult = { rows: [] };

			mockedSqlQuery.mockResolvedValueOnce(onboardingSetupResult);

			await expect(onboarding.getCustomerOnboardingStages(params, body)).rejects.toThrow(OnboardingApiError);

			mockedSqlQuery.mockResolvedValueOnce(onboardingSetupResult);
			await expect(onboarding.getCustomerOnboardingStages(params, body)).rejects.toThrow(
				"Customer onboarding setup not found or not enabled"
			);

			expect(sqlQuery).toHaveBeenCalledTimes(2);
			expect(sqlQuery).toHaveBeenCalledWith({
				sql: expect.stringContaining("SELECT rcss.setup_id, rcss.is_enabled"),
				values: [params.customerID, body.setupType]
			});
		});

		it("should handle a different setup type and return the correct stages", async () => {
			const params = { customerID: "customer-uuid" };
			const body = { setupType: CUSTOM_ONBOARDING_SETUP.LIGHTNING_SETUP };

			const onboardingSetupResult = {
				rows: [{ setup_id: "setup-uuid", is_enabled: true, code: "LIGHTNING_SETUP", label: "Lightning Setup" }]
			};

			const onboardingStagesResult = { rows: [] };

			mockedSqlQuery
				.mockResolvedValueOnce(onboardingSetupResult) // First query: Check setup
				.mockResolvedValueOnce(onboardingStagesResult); // Second query: Get stages

			const result = await onboarding.getCustomerOnboardingStages(params, body);

			expect(sqlQuery).toHaveBeenCalledTimes(2);
			expect(sqlQuery).toHaveBeenNthCalledWith(1, {
				sql: expect.stringContaining("SELECT rcss.setup_id, rcss.is_enabled"),
				values: [params.customerID, body.setupType]
			});
			expect(sqlQuery).toHaveBeenNthCalledWith(2, {
				sql: expect.stringContaining("SELECT dcos.id AS stage_id"),
				values: [params.customerID, CUSTOM_ONBOARDING_TYPES.LIGHTNING_ONBOARDING]
			});
			expect(result).toEqual([]);
		});

		it("should throw an error if the query fails", async () => {
			const params = { customerID: "customer-uuid" };
			const body = { setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP };

			mockedSqlQuery.mockRejectedValueOnce(new Error("Query failed"));

			await expect(onboarding.getCustomerOnboardingStages(params, body)).rejects.toThrow("Query failed");

			expect(sqlQuery).toHaveBeenCalledTimes(1);
			expect(sqlQuery).toHaveBeenCalledWith({
				sql: expect.stringContaining("SELECT rcss.setup_id, rcss.is_enabled"),
				values: [params.customerID, body.setupType]
			});
		});
	});

	describe("updateCustomerOnboardingSetups", () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("should update customer onboarding setups successfully when setups are valid", async () => {
			const params = { customerID: "customer-uuid" };
			const body = {
				setups: [
					{ setup_id: 1, is_enabled: true },
					{ setup_id: 2, is_enabled: false }
				]
			};
			const userInfo = { user_id: "user-uuid" };

			const coreSetupsResult = {
				rows: [{ id: 1 }, { id: 2 }] // Core setup types available
			};

			const customerSetupsResult = {
				rows: [
					{ setup_id: 1, is_enabled: false, code: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
					{ setup_id: 2, is_enabled: true, code: "OTHER_SETUP" }
				]
			};

			const customerStagesResult = {
				rows: []
			};

			mockedSqlTransaction.mockResolvedValueOnce([coreSetupsResult, customerSetupsResult, customerStagesResult]);
			mockedSqlSequencedTransaction.mockResolvedValueOnce(null);

			const result = await onboarding.updateCustomerOnboardingSetups(params, body, userInfo);

			expect(sqlTransaction).toHaveBeenCalledTimes(1);
			expect(sqlTransaction).toHaveBeenCalledWith(
				[
					expect.stringContaining("SELECT * FROM onboarding_schema.core_onboarding_setup_types"),
					expect.stringContaining("SELECT rcss.setup_id"),
					expect.stringContaining("SELECT * FROM onboarding_schema.data_customer_onboarding_stages")
				],
				[[], [params.customerID], [params.customerID]]
			);

			expect(sqlSequencedTransaction).toHaveBeenCalledTimes(1);
			expect(sqlSequencedTransaction).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.stringContaining("UPDATE onboarding_schema.rel_customer_setup_status"),
					expect.stringContaining("WITH inserted_stages AS")
				]),
				expect.any(Array)
			);

			expect(result).toBeNull();
		});

		it("should throw an error for an invalid setup_id", async () => {
			const params = { customerID: "customer-uuid" };
			const body = { setups: [{ setup_id: 99, is_enabled: true }] };
			const userInfo = { user_id: "user-uuid" };

			const coreSetupsResult = {
				rows: [{ id: 1 }, { id: 2 }]
			};

			const customerSetupsResult = {
				rows: [{ setup_id: 1, is_enabled: true, code: "VALID_SETUP" }]
			};

			const customerStagesResult = {
				rows: []
			};

			// First call mock
			mockedSqlTransaction.mockResolvedValueOnce([coreSetupsResult, customerSetupsResult, customerStagesResult]);

			await expect(onboarding.updateCustomerOnboardingSetups(params, body, userInfo)).rejects.toThrow(
				OnboardingApiError
			);

			// Second call mock
			mockedSqlTransaction.mockResolvedValueOnce([coreSetupsResult, customerSetupsResult, customerStagesResult]);

			await expect(onboarding.updateCustomerOnboardingSetups(params, body, userInfo)).rejects.toThrow(
				"Invalid setup_id: 99"
			);

			expect(sqlTransaction).toHaveBeenCalledTimes(2);
			expect(sqlSequencedTransaction).not.toHaveBeenCalled();
		});

		it("should insert default customer stages when page setup is enabled and no stages exist", async () => {
			const params = { customerID: "customer-uuid" };
			const body = {
				setups: [{ setup_id: 1, is_enabled: true }]
			};
			const userInfo = { user_id: "user-uuid" };

			const coreSetupsResult = {
				rows: [{ id: 1 }]
			};

			const customerSetupsResult = {
				rows: [{ setup_id: 1, is_enabled: false, code: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP }]
			};

			const customerStagesResult = {
				rows: []
			};

			mockedSqlTransaction.mockResolvedValueOnce([coreSetupsResult, customerSetupsResult, customerStagesResult]);
			mockedSqlSequencedTransaction.mockResolvedValueOnce(null);

			const result = await onboarding.updateCustomerOnboardingSetups(params, body, userInfo);

			expect(sqlSequencedTransaction).toHaveBeenCalledTimes(1);
			expect(sqlSequencedTransaction).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.stringContaining("WITH inserted_stages AS"),
					expect.stringContaining("UPDATE onboarding_schema.data_customer_onboarding_stages")
				]),
				expect.any(Array)
			);

			expect(result).toBeNull();
		});

		it("should handle errors during execution", async () => {
			const params = { customerID: "customer-uuid" };
			const body = { setups: [{ setup_id: 1, is_enabled: true }] };
			const userInfo = { user_id: "user-uuid" };

			mockedSqlTransaction.mockRejectedValueOnce(new Error("Transaction failed"));

			await expect(onboarding.updateCustomerOnboardingSetups(params, body, userInfo)).rejects.toThrow(
				"Transaction failed"
			);

			expect(sqlTransaction).toHaveBeenCalledTimes(1);
			expect(sqlSequencedTransaction).not.toHaveBeenCalled();
		});
	});
	describe("getAllStages", () => {
		let tracker: Tracker;
		beforeEach(() => {
			tracker = createTracker(db);
		});

		afterEach(() => {
			tracker.reset(); // Reset tracker between tests
		});
		it("should return stages without custom fields when no 'custom_fields' stage is found", async () => {
			const params = { customerID: "123e4567-e89b-12d3-a456-426614174000" as UUID };
			const body = { include_config: true };

			const mockStages = [
				{
					id: "1",
					stage: "stage1",
					label: "Stage 1",
					priority_order: 1,
					config: { someConfig: "value" },
					is_enabled: true
				},
				{
					id: "2",
					stage: "stage2",
					label: "Stage 2",
					priority_order: 2,
					config: { someConfig: "value" },
					is_enabled: false
				}
			];

			mockedSqlQuery.mockResolvedValueOnce({ rows: mockStages });

			jest.spyOn(businesses, "getProgressionConfigWithCustomFields").mockResolvedValue(undefined);

			tracker.on
				.select(query => {
					return (
						query.method === "select" &&
						query.sql.includes('from "onboarding_schema"."data_custom_templates"') &&
						query.bindings.includes(params.customerID)
					);
				})
				.response(undefined);

			const result = await onboarding.getAllStages(params, body);

			expect(result).toEqual([
				{
					id: "1",
					label: "Stage 1",
					stage: "stage1",
					priority_order: 1,
					visibility: "Default",
					config: { someConfig: "value" }
				},
				{
					id: "2",
					label: "Stage 2",
					stage: "stage2",
					priority_order: 2,
					visibility: "Hidden",
					config: { someConfig: "value" }
				}
			]);
			expect(businesses.getProgressionConfigWithCustomFields).not.toHaveBeenCalled();
		});
		it("should return stages with custom fields when 'custom_fields' stage is found", async () => {
			const params = { customerID: "123e4567-e89b-12d3-a456-426614174000" as UUID };
			const body = { include_config: true };

			const mockStages = [
				{ id: "1", stage: "custom_fields", label: "One Section", priority_order: 1, config: { someConfig: "value" } },
				{ id: "2", stage: "stage2", label: "Stage 2", priority_order: 2, config: { someConfig: "value" } }
			];

			const mockProcessedStages = [
				{
					id: "1",
					stage: "custom_fields:One Section",
					label: "One Section",
					priority_order: 1,
					visibility: "Hidden",
					config: { someConfig: "value" }
				},
				{
					id: "2",
					stage: "stage2",
					label: "Stage 2",
					priority_order: 2,
					visibility: "Hidden",
					config: { someConfig: "value" }
				}
			];

			mockedSqlQuery.mockResolvedValueOnce({ rows: mockStages });
			jest.spyOn(businesses, "getProgressionConfigWithCustomFields").mockResolvedValue(mockProcessedStages);

			tracker.on
				.select(query => {
					return (
						query.method === "select" &&
						query.sql.includes('from "onboarding_schema"."data_custom_templates"') &&
						query.bindings.includes(params.customerID)
					);
				})
				.response({ id: "456e4567-e89b-12d3-a456-426614174000", customer_id: "123e4567-e89b-12d3-a456-426614174000" });
			const result = await onboarding.getAllStages(params, body);

			expect(result).toEqual([
				{
					id: "1",
					stage: "custom_fields:One Section",
					label: "One Section",
					priority_order: 1,
					visibility: "Hidden",
					config: { someConfig: "value" }
				},
				{
					id: "2",
					stage: "stage2",
					label: "Stage 2",
					priority_order: 2,
					visibility: "Hidden",
					config: { someConfig: "value" }
				}
			]);
			expect(businesses.getProgressionConfigWithCustomFields).toHaveBeenCalledWith(mockStages, params.customerID, [
				SECTION_VISIBILITY.HIDDEN,
				SECTION_VISIBILITY.DEFAULT
			]);
		});
	});
});
