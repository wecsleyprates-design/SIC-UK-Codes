import { CONNECTION_STATUS, DIRECTORIES, INTEGRATION_ID } from "#constants";
import type { IBusinessIntegrationTaskEnriched, IDBConnection, TDateISO } from "#types";
import { OpenCorporates } from "../opencorporates";
import type { OpenCorporateEntityMatchTask } from "../types";
import { type OpenCorporatesFirmographicsEvent } from "@joinworth/types/dist/types/kafka/entity_matching.v1/FirmographicsEvent";

// Mock taskQueue to prevent the entire import chain that leads to OpenAI
jest.mock("#workers/taskHandler", () => ({
	taskQueue: {
		add: jest.fn(),
		process: jest.fn(),
		on: jest.fn()
	}
}));

// Mock kafkaToQueue function
jest.mock("#messaging/index", () => ({
	kafkaToQueue: jest.fn()
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

class OpenCorporatesUnderTest extends OpenCorporates {
	constructor(dbConnection: IDBConnection) {
		super(dbConnection);
	}
	saveRequestResponse = jest.fn().mockResolvedValue(undefined);
	updateTask = jest.fn().mockResolvedValue(undefined);
	saveToS3 = jest.fn().mockResolvedValue(undefined);
	convertKafkaEventPayloadToLegacyMetadata = jest.fn().mockReturnValue({
		match_id: "0000-0000-0000-0000-0000",
		prediction: 0,
		match: null,
		all_matches: null,
		match_mode: "ai",
		firmographic: {
			company_number: "L18000057850",
			jurisdiction_code: "us_fl"
		}
	});
}

describe("BEST-64: OpenCorporates Entity Matching", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	const businessID = "0000-0000-0000-0000-0000";
	const dbConnection: IDBConnection = {
		id: "1111-0000-0000-0000-0000",
		business_id: businessID,
		platform_id: INTEGRATION_ID.OPENCORPORATES,
		connection_status: CONNECTION_STATUS.SUCCESS,
		created_at: new Date().toISOString() as TDateISO,
		updated_at: new Date().toISOString() as TDateISO,
		configuration: {}
	};
	const openCorporates = new OpenCorporatesUnderTest(dbConnection);

	it("should process entity matching", async () => {
		const taskId = "0000-0000-0000-0000-9999";
		const externalId = "us_fl:L18000057850";

		const task = { id: taskId, metadata: {} } as unknown as IBusinessIntegrationTaskEnriched<OpenCorporateEntityMatchTask>;
		const payload = generateOC();
		const result = await openCorporates.processFirmographicsEvent(task, payload);
		expect(result).toBe(undefined);
		expect(openCorporates.saveRequestResponse).toHaveBeenCalledWith(
			task,
			expect.objectContaining({
				firmographic: expect.objectContaining({
					company_number: "L18000057850",
					jurisdiction_code: "us_fl"
				})
			}),
			externalId
		);
		const metadata = openCorporates.convertKafkaEventPayloadToLegacyMetadata(task, payload);
		expect(openCorporates.updateTask).toHaveBeenCalledWith(taskId, { reference_id: externalId, metadata });
		expect(openCorporates.saveToS3).toHaveBeenCalledWith(metadata, "match", DIRECTORIES.BUSINESS_ENTITY_VERIFICATION, "OPENCORPORATES");
	});
});

const generateOC = (args = {}): OpenCorporatesFirmographicsEvent => {
	return {
		collected_at: "2025-09-02T15:00:37.919422Z",
		business_id: "b644680a-e43d-464b-8ae3-4d3c06021236",
		match_id: "0000-0000-0000-0000-0000",
		prediction: 0.95,
		firmographics: {
			additional_identifiers: [],
			alternative_names: [],
			officers: [],
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
			non_reg_addresses: []
		},
		source: "open_corporate"
	};
};
