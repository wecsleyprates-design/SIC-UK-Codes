import { BusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import type { TDateISO } from "#types";
import { EntityMatchingEventHandler } from "../entity-matching";

// Mock taskHandler queues to prevent the entire import chain that leads to OpenAI
jest.mock("#workers/taskHandler", () => ({
	taskQueue: {
		addJob: jest.fn(),
		add: jest.fn(),
		process: jest.fn(),
		on: jest.fn()
	},
	entityMatchingQueue: {
		queue: { process: jest.fn(), on: jest.fn() },
		addJob: jest.fn()
	},
	firmographicsQueue: {
		queue: { process: jest.fn(), on: jest.fn() },
		addJob: jest.fn()
	}
}));

// Mock kafkaToQueue function
jest.mock("#messaging/index", () => ({
	kafkaToQueue: jest.fn()
}));

jest.mock("#common/index", () => ({
	...jest.requireActual("#common/index"),
	prepareIntegrationDataForScore: jest.fn().mockResolvedValue(undefined)
}));

// Mock specific helper functions
jest.mock("#helpers", () => ({
	...jest.requireActual("#helpers"),
	getOrCreateConnection: jest.fn(),
	platformFactory: jest.fn(),
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn()
	}
}));

jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});
class EntityMatchingEventHandlerUnderTest extends EntityMatchingEventHandler {
	constructor() {
		super();
	}
}

describe("Entity Matching Events Handler", () => {
	describe("BEST-64 firmographics_event", () => {
		const taskId = "0000-0000-0000-8888-9999";

		let handler: EntityMatchingEventHandlerUnderTest;
		let getOrCreateConnectionSpy: jest.SpyInstance;
		let getTasksForCodeSpy: jest.SpyInstance = jest.fn().mockResolvedValue(["task-id-1"]);
		let createTaskForCodeSpy: jest.SpyInstance = jest.fn().mockResolvedValue("new-task-id");
		let getEnrichedTaskSpy: jest.SpyInstance;
		let isDirectQuerySpy: jest.SpyInstance;
		let processFirmographicsEventSpy: jest.SpyInstance = jest.fn().mockResolvedValue(undefined);
		let prepareIntegrationDataForScoreMock: jest.Mock;
		class PlatformMock extends BusinessEntityVerificationService {
			constructor() {
				super();
				this.getTasksForCode = getTasksForCodeSpy as jest.MockedFunction<
					typeof BusinessEntityVerificationService.prototype.getTasksForCode
				>;
				this.createTaskForCode = createTaskForCodeSpy as jest.MockedFunction<
					typeof BusinessEntityVerificationService.prototype.createTaskForCode
				>;
			}
			public async processFirmographicsEvent(task, payload): Promise<void> {}
			updateTaskStatus = jest.fn().mockResolvedValue(undefined);
		}
		let mockPlatform: PlatformMock;

		beforeEach(() => {
			handler = new EntityMatchingEventHandlerUnderTest();
			prepareIntegrationDataForScoreMock = require("#common/index").prepareIntegrationDataForScore as jest.Mock;
			prepareIntegrationDataForScoreMock.mockResolvedValue(undefined);

			// Import the mocked helpers
			const { getOrCreateConnection, platformFactory } = require("#helpers");

			// Setup mocks for the imported functions
			getOrCreateConnectionSpy = getOrCreateConnection as jest.MockedFunction<typeof getOrCreateConnection>;
			getOrCreateConnectionSpy.mockResolvedValue({ id: "mock-connection" });

			// Reset and reconfigure spy functions
			getTasksForCodeSpy.mockReset();
			createTaskForCodeSpy.mockReset();
			processFirmographicsEventSpy.mockReset();

			// Set default mock values
			getTasksForCodeSpy.mockResolvedValue(["task-id-1"]);
			createTaskForCodeSpy.mockResolvedValue("new-task-id");
			processFirmographicsEventSpy.mockResolvedValue(undefined);

			mockPlatform = new PlatformMock();

			// Update the mock platform object
			mockPlatform.getTasksForCode = getTasksForCodeSpy as jest.MockedFunction<
				typeof BusinessEntityVerificationService.prototype.getTasksForCode
			>;
			mockPlatform.createTaskForCode = createTaskForCodeSpy as jest.MockedFunction<
				typeof BusinessEntityVerificationService.prototype.createTaskForCode
			>;

			mockPlatform.processFirmographicsEvent = processFirmographicsEventSpy as jest.MockedFunction<
				typeof BusinessEntityVerificationService.prototype.processFirmographicsEvent
			>;

			// Mock platform factory to return a mock platform with our spy methods
			(platformFactory as jest.MockedFunction<typeof platformFactory>).mockReturnValue(mockPlatform);

			getEnrichedTaskSpy = jest.spyOn(BusinessEntityVerificationService, "getEnrichedTask").mockResolvedValue({
				id: taskId,
				customer_id: "0000-0000-0000-0000-0000",
				business_id: "0000-0000-0000-0000-0000",
				platform_id: INTEGRATION_ID.ENTITY_MATCHING,
				platform_code: "entity_matching",
				platform_category_code: "MANUAL",
				task_code: "fetch_business_entity_verification",
				task_label: "Entity Matching",
				connection_id: "0000-0000-0000-0000-0000",
				integration_task_id: 1,
				task_status: "CREATED",
				created_at: new Date().toISOString() as TDateISO,
				updated_at: new Date().toISOString() as TDateISO,
				metadata: {}
			});
			isDirectQuerySpy = jest.spyOn(EntityMatching, "isDirectQuery").mockResolvedValue(false);
		});

		afterEach(() => {
			jest.resetAllMocks();
		});

		it("should skip processFirmographicsEvent if direct query is enabled", async () => {
			// When isDirectQuery returns true, the task should be skipped (no terminal status -> no score prep)
			isDirectQuerySpy.mockResolvedValue(true);
			const payload = generateOC();

			await handler.firmographicsEvent(payload);

			// Test the actual behavior
			expect(getOrCreateConnectionSpy).toHaveBeenCalledWith(
				payload.business_id,
				EntityMatching.SOURCE_TO_PLATFORM_MAP.open_corporate[0]
			);
			expect(isDirectQuerySpy).toHaveBeenCalledWith("0000-0000-0000-0000-0000");
			expect(isDirectQuerySpy).toHaveBeenCalledTimes(1);
			expect(processFirmographicsEventSpy).not.toHaveBeenCalled();
			expect(prepareIntegrationDataForScoreMock).not.toHaveBeenCalled();
		});

		it("should processFirmographicsEvent if direct query is disabled", async () => {
			// Make sure we have in-progress tasks so no new task is created
			getTasksForCodeSpy.mockResolvedValue([taskId]);
			const payload = generateOC();

			await handler.firmographicsEvent(payload);
			expect(getOrCreateConnectionSpy).toHaveBeenCalledWith(
				payload.business_id,
				EntityMatching.SOURCE_TO_PLATFORM_MAP.open_corporate[0]
			);
			expect(isDirectQuerySpy).toHaveBeenCalledWith("0000-0000-0000-0000-0000");
			expect(isDirectQuerySpy).toHaveBeenCalledTimes(1);
			expect(processFirmographicsEventSpy).toHaveBeenCalledTimes(1);
			expect(mockPlatform.updateTaskStatus).toHaveBeenCalledTimes(1);
			expect(mockPlatform.updateTaskStatus).toHaveBeenCalledWith(
				taskId,
				TASK_STATUS.SUCCESS,
				"Firmographics event processed"
			);
			expect(prepareIntegrationDataForScoreMock).toHaveBeenCalledTimes(1);
			expect(prepareIntegrationDataForScoreMock).toHaveBeenCalledWith(taskId, undefined);
		});
		it("shouldn't processFirmographicsEvent if prediction is below threshold", async () => {
			// Make sure we have in-progress tasks so no new task is created
			getTasksForCodeSpy.mockResolvedValue([taskId]);
			const payload = generateOC();
			payload.prediction = 0.1; // Below threshold

			await handler.firmographicsEvent(payload);
			expect(getOrCreateConnectionSpy).toHaveBeenCalledWith(
				payload.business_id,
				EntityMatching.SOURCE_TO_PLATFORM_MAP.open_corporate[0]
			);
			expect(isDirectQuerySpy).toHaveBeenCalledTimes(1);
			expect(processFirmographicsEventSpy).toHaveBeenCalledTimes(0);
			expect(mockPlatform.updateTaskStatus).toHaveBeenCalledTimes(1);
			expect(mockPlatform.updateTaskStatus).toHaveBeenCalledWith(
				taskId,
				TASK_STATUS.FAILED,
				`Prediction score below minimum threshold, prediction=${payload.prediction}`
			);
			expect(prepareIntegrationDataForScoreMock).toHaveBeenCalledTimes(1);
			expect(prepareIntegrationDataForScoreMock).toHaveBeenCalledWith(taskId, undefined);
		});

		it("should call prepareIntegrationDataForScore once when processFirmographicsEvent throws (FAILED outcome)", async () => {
			getTasksForCodeSpy.mockResolvedValue([taskId]);
			processFirmographicsEventSpy.mockRejectedValue(new Error("Platform error"));
			const payload = generateOC();

			await handler.firmographicsEvent(payload);

			expect(mockPlatform.updateTaskStatus).toHaveBeenCalledWith(
				taskId,
				TASK_STATUS.FAILED,
				"Firmographics event processing failed"
			);
			expect(prepareIntegrationDataForScoreMock).toHaveBeenCalledTimes(1);
			expect(prepareIntegrationDataForScoreMock).toHaveBeenCalledWith(taskId, undefined);
		});
	});
});

const generateOC = (args = {}) => {
	return {
		collected_at: "2025-09-02T15:00:37.919422Z",
		business_id: "b644680a-e43d-464b-8ae3-4d3c06021236",
		match_id: "0000-0000-0000-0000-0000",
		prediction: 0.95,
		firmographics: {
			additional_identifiers: [
				{
					company_number: "L18000057850",
					jurisdiction_code: "us_fl",
					uid: "82-4714879",
					identifier_system_code: "us_fein"
				}
			],
			alternative_names: [],
			companies: [
				{
					company_number: "L18000057850",
					jurisdiction_code: "us_fl",
					name: "TESTE LLC",
					normalised_name: "teste llc",
					company_type: "Florida Limited Liability",
					nonprofit: false,
					current_status: "Inactive",
					incorporation_date: "2018-03-05",
					dissolution_date: "",
					branch: "",
					business_number: "",
					current_alternative_legal_name: "",
					current_alternative_legal_name_language: "",
					home_jurisdiction_text: "FL",
					native_company_number: "",
					previous_names: "",
					retrieved_at: "2025-04-03 00:00:00 UTC",
					registry_url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
					restricted_for_marketing: null,
					inactive: true,
					accounts_next_due: "",
					accounts_reference_date: "",
					accounts_last_made_up_date: "",
					annual_return_next_due: "",
					annual_return_last_made_up_date: "",
					has_been_liquidated: null,
					has_insolvency_history: null,
					has_charges: null,
					number_of_employees: "",
					"registered_address.street_address": "",
					"registered_address.locality": "",
					"registered_address.region": "",
					"registered_address.postal_code": "",
					"registered_address.country": "",
					"registered_address.in_full": "",
					home_jurisdiction_code: "",
					home_jurisdiction_company_number: "",
					industry_code_uids: "",
					latest_accounts_date: "",
					latest_accounts_cash: null,
					latest_accounts_assets: null,
					latest_accounts_liabilities: null
				}
			],
			non_reg_addresses: [
				{
					company_number: "L18000057850",
					jurisdiction_code: "us_fl",
					address_type: "Head Office",
					street_address: "2742 SW 29th AVE",
					locality: "MIAMI",
					region: "FL",
					postal_code: "33133",
					country: "",
					country_code: "",
					in_full: "",
					start_date: "",
					end_date: ""
				},
				{
					company_number: "L18000057850",
					jurisdiction_code: "us_fl",
					address_type: "Mailing",
					street_address: "2742 SW 29th AVE",
					locality: "MIAMI",
					region: "FL",
					postal_code: "33133",
					country: "",
					country_code: "",
					in_full: "",
					start_date: "",
					end_date: ""
				}
			],
			officers: [
				{
					id: 278803600,
					company_number: "L18000057850",
					jurisdiction_code: "us_fl",
					name: "MAXIMINO RAMIREZ",
					title: "",
					first_name: "",
					last_name: "",
					position: "",
					start_date: "",
					person_number: null,
					person_uid: "",
					end_date: "",
					current_status: "",
					occupation: "",
					nationality: "",
					country_of_residence: "",
					partial_date_of_birth: "",
					type: "",
					"address.in_full": "2742 SW 29th, MIAMI, FL, 33133",
					"address.street_address": "2742 SW 29th",
					"address.locality": "MIAMI",
					"address.region": "FL",
					"address.postal_code": "33133",
					"address.country": "",
					retrieved_at: "2025-01-10 00:00:00 UTC",
					source_url: ""
				},
				{
					id: 630776526,
					company_number: "L18000057850",
					jurisdiction_code: "us_fl",
					name: "CBS Financial CPA PA",
					title: "",
					first_name: "",
					last_name: "",
					position: "agent",
					start_date: "",
					person_number: null,
					person_uid: "",
					end_date: "",
					current_status: "",
					occupation: "",
					nationality: "",
					country_of_residence: "",
					partial_date_of_birth: "",
					type: "",
					"address.in_full": "6075  W Commercial Blvd, Tamarac, FL, 33319",
					"address.street_address": "6075  W Commercial Blvd",
					"address.locality": "Tamarac",
					"address.region": "FL",
					"address.postal_code": "33319",
					"address.country": "",
					retrieved_at: "2025-01-10 00:00:00 UTC",
					source_url: ""
				}
			]
		},
		source: "open_corporate"
	};
};
