import { OpenCorporates } from "../opencorporates";

import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import { BusinessEntityVerificationService } from "../../../src/api/v1/modules/verification/businessEntityVerification";
jest.mock("#configs/env.config", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id",
		KAFKA_GROUP_ID: "mocked_group_id",
		PLAID_IDV_TEMPLATE_ID: "1"
		//   ... other mocked configuration properties
	}
}));
jest.mock("#common/common", () => {
	return {
		uploadRawIntegrationDataToS3: jest.fn().mockResolvedValue(Promise.resolve()) // Mock resolved promise by default
	};
});

jest.mock("#utils/canadianProvinces", () => {
	return {
		isCanadianProvince: jest.fn().mockResolvedValue(false),
		isCanadianAddress: jest.fn().mockResolvedValue(false)
	};
});

describe("OpenCorporates", () => {
	let openCorporates;
	const businessID = "0000-0000-0000-0000-0000";
	const taskId = "2222-0000-0000-0000-0000";
	const dbConnection = {
		id: "1111-0000-0000-0000-0000",
		business_id: businessID,
		platform_id: INTEGRATION_ID.OPENCORPORATES,
		connection_status: CONNECTION_STATUS.SUCCESS,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		configuration: {}
	};

	beforeEach(() => {
		openCorporates = new OpenCorporates(dbConnection);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it("on manual match, should create a task and process it", async () => {
		const task = { id: taskId, metadata: {} };
		jest.spyOn(openCorporates, "getOrCreateTaskForCode").mockResolvedValue(taskId);
		jest.spyOn(openCorporates, "processTask").mockResolvedValue(true);
		jest.spyOn(BusinessEntityVerificationService, "getEnrichedTask").mockResolvedValue(task);
		jest.spyOn(openCorporates, "getBusinessNamesAndAddresses").mockResolvedValue({
			names: ["name1"],
			addresses: [
				{
					line_1: "123 Main St",
					city: "Anytown",
					state: "CA",
					postal_code: "12345",
					apartment: "Apt 1",
					country: "USA"
				}
			]
		});
		const result = await openCorporates.matchBusiness();

		expect(openCorporates.getOrCreateTaskForCode).toHaveBeenCalledWith({ reference_id: businessID, taskCode: "fetch_business_entity_verification" });
		expect(openCorporates.processTask).toHaveBeenCalledWith({ taskId });
		expect(OpenCorporates.getEnrichedTask).toHaveBeenCalledWith(taskId);
		expect(result).toEqual(task);
	});

	describe("fetchOpenCorporates", () => {
		it("should return false if connection is invalid", async () => {
			jest.spyOn(openCorporates, "getDBConnection").mockResolvedValue({});
			const result = await openCorporates.fetchOpenCorporates("123");

			expect(result).toBe(false);
		});

		it("should return false if no match is found", async () => {
			const task = { id: "123", metadata: {} };
			jest.spyOn(openCorporates, "updateTask").mockResolvedValue(task);
			jest.spyOn(OpenCorporates, "getEnrichedTask").mockResolvedValue(task);
			jest.spyOn(openCorporates, "generateBusinessSearchQuery").mockResolvedValue("query");
			jest.spyOn(openCorporates, "executeMatchSearchQuery").mockResolvedValue([]);

			const result = await openCorporates.fetchOpenCorporates("123");

			expect(result).toBe(false);
			expect(openCorporates.updateTask).toHaveBeenCalledWith("123", { metadata: { match: null } });
		});

		it("should return false if match index is below MIN_INDEX", async () => {
			const task = { id: "123", metadata: {} };
			const match = [{ index: 30 }];
			jest.spyOn(openCorporates, "updateTask").mockResolvedValue(undefined);
			jest.spyOn(OpenCorporates, "getEnrichedTask").mockResolvedValue(task);
			jest.spyOn(openCorporates, "generateBusinessSearchQuery").mockResolvedValue("query");
			jest.spyOn(openCorporates, "executeMatchSearchQuery").mockResolvedValue(match);

			const result = await openCorporates.fetchOpenCorporates("123");

			expect(result).toBe(false);
			expect(openCorporates.updateTask).toHaveBeenCalledWith("123", { metadata: { match: match[0] } });
		});

		it("should update task metadata and save request response if match is found", async () => {
			const task = { id: "123", metadata: {} };
			const match = [{ index: 50, company_number: "789", jurisdiction_code: "us" }];
			const firmographic = [
				{ company_number: "123", jurisdiction_code: "fr" },
				[
					{ company_number: "789", jurisdiction_code: "us" },
					{ company_number: "000", jurisdiction_code: "us" }
				]
			];
			const names = ["abc", "def"];
			const externalId = `us:789`;
			const addresses = [];
			const officers = [{
				name: "JOHN DOE",
				title: "CEO",
				position: "CHIEF EXECUTIVE OFFICER",
				// Address fields
				officer_address_street: "123 Main St",
				officer_address_locality: "San Francisco",
				officer_address_region: "CA",
				officer_address_postal_code: "94102",
				officer_address_country: "US",
				officer_address_full: "123 Main St, San Francisco, CA 94102, US",
				// Name fields
				officer_first_name: "John",
				officer_last_name: "Doe",
				// Metadata fields
				officer_status: "ACTIVE",
				officer_start_date: "2020-01-01",
				officer_person_uid: "person_123",
				officer_person_number: "P001",
				officer_type: "DIRECTOR",
				officer_source_url: "https://opencorporates.com/officers/123",
				officer_retrieved_at: "2024-01-01T10:00:00Z"
			}];
			jest.spyOn(OpenCorporates, "getEnrichedTask").mockResolvedValue(task);
			jest.spyOn(openCorporates, "generateBusinessSearchQuery").mockResolvedValue("query");
			jest.spyOn(openCorporates, "executeMatchSearchQuery").mockResolvedValue(match);
			jest.spyOn(openCorporates, "getFirmographic").mockResolvedValue(firmographic);
			jest.spyOn(openCorporates, "getNames").mockResolvedValue(names);
			jest.spyOn(openCorporates, "getAddresses").mockResolvedValue(addresses);
			jest.spyOn(openCorporates, "getOfficers").mockResolvedValue(officers);
			jest.spyOn(openCorporates, "updateTask").mockResolvedValue(undefined);
			jest.spyOn(openCorporates, "saveRequestResponse").mockResolvedValue({});

			const result = await openCorporates.fetchOpenCorporates("123");

			expect(result).toBe(true);
			expect(openCorporates.updateTask).toHaveBeenCalledWith("123", { metadata: { match: match[0], firmographic: firmographic[0], sosFilings: firmographic[1], names, addresses, officers } });
			expect(openCorporates.saveRequestResponse).toHaveBeenCalledWith(task, expect.any(Object), externalId);
		});
	});

	describe("sanitizeBusinessName", () => {
		it("should sanitize the business name", () => {
			const name = "Test And Co and Partners";
			const sanitized = openCorporates.sanitizeBusinessName(name);
			expect(sanitized).toBe("Test & Co & Partners");
		});

		it("should return undefined if name is undefined", () => {
			const sanitized = openCorporates.sanitizeBusinessName(undefined);
			expect(sanitized).toBeUndefined();
		});
	});

	describe("generateAddressString", () => {
		it("should generate address string for  a full address", () => {
			const address = {
				line_1: "123 Main St",
				city: "Anytown",
				state: "CA",
				postal_code: "12345",
				apartment: "Apt 1",
				country: "USA"
			};
			const addressString = openCorporates.generateAddressString(address);
			expect(addressString).toBe("123 MAIN ST, APT 1, ANYTOWN, CA 12345, USA");
		});
		it("should generate address string", () => {
			const address = {
				line_1: "123 Main St",
				city: "Anytown",
				state: "CA",
				postal_code: "12345"
			};
			const addressString = openCorporates.generateAddressString(address);
			expect(addressString).toBe("123 MAIN ST, ANYTOWN, CA 12345");
		});
	});
});
