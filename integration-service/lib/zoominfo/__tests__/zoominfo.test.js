import { BusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import { ZoomInfo } from "../zoominfo";
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

jest.mock("#common/common-new", () => {
	return {
		prepareIntegrationDataForScore: jest.fn().mockResolvedValue(Promise.resolve()) // Mock resolved promise by default
	};
});

describe("ZoomInfo", () => {
	let zoomInfo;
	const businessID = "0000-0000-0000-0000-0000";
	const taskId = "2222-0000-0000-0000-0000";
	const dbConnection = {
		id: "1111-0000-0000-0000-0000",
		business_id: businessID,
		platform_id: INTEGRATION_ID.ZOOMINFO,
		connection_status: CONNECTION_STATUS.SUCCESS,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		configuration: {}
	};

	beforeEach(() => {
		zoomInfo = new ZoomInfo(dbConnection);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it("on manual match, should create a task and process it", async () => {
		const task = { id: taskId, metadata: {} };
		jest.spyOn(zoomInfo, "getOrCreateTaskForCode").mockResolvedValue(taskId);
		jest.spyOn(zoomInfo, "processTask").mockResolvedValue(true);
		jest.spyOn(BusinessEntityVerificationService, "getEnrichedTask").mockResolvedValue(task);

		const result = await zoomInfo.matchBusiness();

		expect(zoomInfo.getOrCreateTaskForCode).toHaveBeenCalledWith({ taskCode: "fetch_business_entity_verification", reference_id: businessID });
		expect(zoomInfo.processTask).toHaveBeenCalledWith({ taskId });
		expect(ZoomInfo.getEnrichedTask).toHaveBeenCalledWith(taskId);
		expect(result).toEqual(task);
	});

	describe("fetchzoomInfo", () => {
		it("should return false if connection is invalid", async () => {
			jest.spyOn(zoomInfo, "getDBConnection").mockResolvedValue({});
			const result = await zoomInfo.fetchZoomInfo("123");

			expect(result).toBe(false);
		});

		it("should return true if no match is found", async () => {
			const task = { id: "123", metadata: {} };
			jest.spyOn(zoomInfo, "updateTask").mockResolvedValue(task);
			jest.spyOn(ZoomInfo, "getEnrichedTask").mockResolvedValue(task);
			jest.spyOn(zoomInfo, "buildSearchQuery").mockResolvedValue("query");
			jest.spyOn(zoomInfo, "executeMatchSearchQuery").mockResolvedValue([]);

			const result = await zoomInfo.fetchZoomInfo("123");

			expect(result).toBe(true);
			expect(zoomInfo.updateTask).toHaveBeenCalledWith("123", { metadata: { match: null } });
		});

		it("should return true if match index is below MIN_INDEX", async () => {
			const task = { id: "123", metadata: {} };
			const match = [{ index: 30 }];
			jest.spyOn(zoomInfo, "updateTask").mockResolvedValue(undefined);
			jest.spyOn(ZoomInfo, "getEnrichedTask").mockResolvedValue(task);
			jest.spyOn(zoomInfo, "buildSearchQuery").mockResolvedValue("query");
			jest.spyOn(zoomInfo, "executeMatchSearchQuery").mockResolvedValue(match);

			const result = await zoomInfo.fetchZoomInfo("123");

			expect(result).toBe(true);
			expect(zoomInfo.updateTask).toHaveBeenCalledWith("123", { metadata: { match: match[0] } });
		});

		it("should update task metadata and save request response if match is found", async () => {
			const task = { id: "123", metadata: {} };
			const match = [{ index: 50, zi_c_location_id: "789", zi_c_company_id: 1235, zi_es_location_id: "ABCEDFG" }];
			const firmographic = { zi_c_location_id: "789", zi_c_company_id: 1235, zi_es_location_id: "ABCEDFG" };
			const externalId = `1235:789:ABCEDFG`;
			jest.spyOn(BusinessEntityVerificationService, "getEnrichedTask").mockResolvedValue(task);
			jest.spyOn(zoomInfo, "buildSearchQuery").mockResolvedValue("query");
			jest.spyOn(zoomInfo, "executeMatchSearchQuery").mockResolvedValue(match);
			jest.spyOn(zoomInfo, "getFirmographic").mockResolvedValue(firmographic);
			jest.spyOn(zoomInfo, "updateTask").mockResolvedValue(undefined);
			jest.spyOn(zoomInfo, "saveRequestResponse").mockResolvedValue({});

			const result = await zoomInfo.fetchZoomInfo("123");

			expect(result).toBe(true);
			expect(zoomInfo.updateTask).toHaveBeenCalledWith("123", { metadata: { match: match[0], firmographic, match_mode: "heuristic" } });
			expect(zoomInfo.saveRequestResponse).toHaveBeenCalledWith(task, expect.any(Object), externalId);
		});
	});

	describe("sanitizeBusinessName", () => {
		it("should sanitize the business name", () => {
			const name = "Test And Co and Partners";
			const sanitized = zoomInfo.sanitizeBusinessName(name);
			expect(sanitized).toBe("Test & Co & Partners");
		});

		it("should return undefined if name is undefined", () => {
			const sanitized = zoomInfo.sanitizeBusinessName(undefined);
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
			const addressString = zoomInfo.generateAddressString(address);
			expect(addressString).toBe("123 MAIN ST, APT 1, ANYTOWN, CA 12345, USA");
		});
		it("should generate address string", () => {
			const address = {
				line_1: "123 Main St",
				city: "Anytown",
				state: "CA",
				postal_code: "12345"
			};
			const addressString = zoomInfo.generateAddressString(address);
			expect(addressString).toBe("123 MAIN ST, ANYTOWN, CA 12345");
		});
	});
});
