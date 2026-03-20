import { TruliooBusiness } from "../truliooBusiness";
import { TruliooBase } from "../../common/truliooBase";
import { TruliooBusinessTaskHandler } from "../truliooBusinessTaskHandler";
import { TruliooBusinessKYBProcessor } from "../truliooBusinessKYBProcessor";
import { TruliooBusinessResultsStorage } from "../truliooBusinessResultsStorage";
import { TruliooUBOExtractor } from "../truliooUBOExtractor";

// Mock dependencies
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("#helpers/api", () => ({
	getBusinessDetails: jest.fn(),
	getBusinessCustomers: jest.fn(),
	getCustomerCountries: jest.fn()
}));

jest.mock("#api/v1/modules/customer-integration-settings/customer-integration-settings", () => ({
	customerIntegrationSettings: {
		getIntegrationStatusForCustomer: jest.fn(),
		isCustomerIntegrationSettingEnabled: jest.fn()
	}
}));

jest.mock("../../common/utils", () => ({
	...jest.requireActual("../../common/utils")
}));

jest.mock("../../common/pscScreeningHelpers", () => ({
	shouldScreenPSCsForBusiness: jest.fn()
}));

jest.mock("#helpers/knex", () => {
	const mockDbFn = jest.fn();
	const mockDbRaw = jest.fn((query: string) => query);
	return {
		db: Object.assign(mockDbFn, {
			raw: mockDbRaw
		})
	};
});

jest.mock("../../common/truliooBase");
jest.mock("../truliooBusinessTaskHandler");
jest.mock("../truliooBusinessKYBProcessor");
jest.mock("../truliooBusinessResultsStorage");
jest.mock("../truliooUBOExtractor");
jest.mock("../truliooPSCScreening", () => ({
	TruliooPSCScreening: {
		enqueueForBusiness: jest.fn().mockResolvedValue(undefined)
	}
}));

describe("TruliooBusiness", () => {
	let truliooBusiness: TruliooBusiness;
	const mockBusinessId = "00000000-0000-0000-0000-000000000000" as const;
	let mockGetBusinessDetails: jest.MockedFunction<any>;
	let mockGetBusinessCustomers: jest.MockedFunction<any>;
	let mockGetIntegrationStatusForCustomer: jest.MockedFunction<any>;
	let mockGetCustomerCountries: jest.MockedFunction<any>;
	let mockDb: jest.MockedFunction<any>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mocks for API functions
		const apiHelpers = require("#helpers/api");
		mockGetBusinessDetails = apiHelpers.getBusinessDetails;
		mockGetBusinessCustomers = apiHelpers.getBusinessCustomers;
		mockGetCustomerCountries = apiHelpers.getCustomerCountries;

		// Setup mock for customer integration settings
		const customerIntegrationSettings = require("#api/v1/modules/customer-integration-settings/customer-integration-settings");
		mockGetIntegrationStatusForCustomer =
			customerIntegrationSettings.customerIntegrationSettings.getIntegrationStatusForCustomer;

		// Setup mock for knex db
		const knexHelpers = require("#helpers/knex");
		mockDb = knexHelpers.db;

		mockGetBusinessDetails.mockClear();
		mockGetBusinessCustomers.mockClear();
		mockGetIntegrationStatusForCustomer.mockClear();
		mockGetCustomerCountries.mockClear();
		mockDb.mockClear();

		// Create TruliooBusiness instance
		truliooBusiness = new TruliooBusiness(mockBusinessId);
	});

	describe("canIRun() - Trulioo Routing Logic", () => {
		it("should return true when Trulioo is enabled and business country is in enabled countries list", async () => {
			// Mock business details
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "GB", // UK
					name: "Test UK Business"
				}
			});

			// Mock customer ID
			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo enabled - returns array directly, not wrapped in data
			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Mock enabled countries - returns array directly, not wrapped in data
			mockGetCustomerCountries.mockResolvedValue([
				{ jurisdiction_code: "GB", is_selected: true, is_enabled: true },
				{ jurisdiction_code: "US", is_selected: false, is_enabled: false }
			]);

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(true);
			expect(mockGetBusinessDetails).toHaveBeenCalledWith(mockBusinessId);
			expect(mockGetBusinessCustomers).toHaveBeenCalledWith(mockBusinessId);
			expect(mockGetIntegrationStatusForCustomer).toHaveBeenCalledWith("customer-123");
			expect(mockGetCustomerCountries).toHaveBeenCalledWith("customer-123", 7);
		});

		it("should return false when Trulioo is not enabled for customer", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "GB",
					name: "Test UK Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo disabled - returns array directly
			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "DISABLED"
				}
			]);

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(false);
			expect(mockGetCustomerCountries).not.toHaveBeenCalled();
		});

		it("should return false when business country is not in enabled countries list", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "FR", // France
					name: "Test French Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo enabled - returns array directly
			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Only GB is enabled - returns array directly
			mockGetCustomerCountries.mockResolvedValue([
				{ jurisdiction_code: "GB", is_selected: true, is_enabled: true },
				{ jurisdiction_code: "US", is_selected: false, is_enabled: false }
			]);

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(false);
		});

		it("should normalize UK to GB when enabled countries use UK but business uses GB", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "GB", // Business uses ISO code GB
					name: "Test UK Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Enabled countries use "UK" instead of "GB"
			mockGetCustomerCountries.mockResolvedValue([
				{ jurisdiction_code: "UK", is_selected: true, is_enabled: true },
				{ jurisdiction_code: "CA", is_selected: true, is_enabled: true }
			]);

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(true);
			expect(mockGetCustomerCountries).toHaveBeenCalledWith("customer-123", 7);
		});

		it("should normalize UK to GB when business uses UK but enabled countries use GB", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "UK", // Business uses UK
					name: "Test UK Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Enabled countries use "GB" (ISO code)
			mockGetCustomerCountries.mockResolvedValue([
				{ jurisdiction_code: "GB", is_selected: true, is_enabled: true }
			]);

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(true);
		});

		it("should handle case-insensitive country code normalization", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "gb", // Lowercase GB
					name: "Test UK Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Enabled countries use uppercase "UK"
			mockGetCustomerCountries.mockResolvedValue([
				{ jurisdiction_code: "uk", is_selected: true, is_enabled: true } // Lowercase UK
			]);

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(true);
		});

		it("should default to US when country is not provided and US is enabled", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "", // No country provided
					name: "Test Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo enabled - returns array directly
			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			mockGetCustomerCountries.mockResolvedValue([{ jurisdiction_code: "US", is_selected: true, is_enabled: true }]);

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(true); // US is default
		});

		it("should return false when customer ID cannot be determined", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "GB",
					name: "Test Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: []
			});

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(false);
		});

		it(
			"should return false when business details fetch fails after retries",
			async () => {
				mockGetBusinessDetails.mockRejectedValue(new Error("API Error"));

				const result = await TruliooBusiness.canIRun(mockBusinessId);

				expect(result).toBe(false);
				// Verify that retries were attempted (3 retries with 1s delay each)
				expect(mockGetBusinessDetails).toHaveBeenCalledTimes(3);
			},
			15000
		); // Increased timeout to account for retries

		it("should return false when business data is null", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: null
			});

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(false);
		});

		it("should return false when getCustomerCountries throws an error (fail-closed)", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "CA",
					name: "Test Canadian Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo enabled - returns array directly
			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Mock getCustomerCountries to throw an error (e.g., International Business toggle disabled)
			mockGetCustomerCountries.mockRejectedValue(new Error("Failed to get customer countries"));

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(false);
			expect(mockGetIntegrationStatusForCustomer).toHaveBeenCalledWith("customer-123");
			expect(mockGetCustomerCountries).toHaveBeenCalledWith("customer-123", 7);
		});

		it("should return false when no countries are enabled (empty enabledCountries array)", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "CA",
					name: "Test Canadian Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo enabled - returns array directly
			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Mock empty enabled countries (International Business toggle disabled or no countries selected) - returns array directly
			mockGetCustomerCountries.mockResolvedValue([]); // No countries enabled

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(false);
			expect(mockGetIntegrationStatusForCustomer).toHaveBeenCalledWith("customer-123");
			expect(mockGetCustomerCountries).toHaveBeenCalledWith("customer-123", 7);
		});

		it("should return false when enabled countries list has no selected/enabled countries", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "CA",
					name: "Test Canadian Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo enabled - returns array directly
			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Mock countries exist but none are selected/enabled - returns array directly
			mockGetCustomerCountries.mockResolvedValue([
				{ jurisdiction_code: "CA", is_selected: false, is_enabled: false },
				{ jurisdiction_code: "GB", is_selected: false, is_enabled: false }
			]);

			const result = await TruliooBusiness.canIRun(mockBusinessId);

			expect(result).toBe(false);
			expect(mockGetIntegrationStatusForCustomer).toHaveBeenCalledWith("customer-123");
			expect(mockGetCustomerCountries).toHaveBeenCalledWith("customer-123", 7);
		});
	});

	describe("taskHandlerMap - Integration with canIRun()", () => {
		let mockUpdateTask: jest.Mock;
		let mockTaskHandler: jest.Mocked<TruliooBusinessTaskHandler>;

		beforeEach(() => {
			mockUpdateTask = jest.fn().mockResolvedValue({});
			mockTaskHandler = new TruliooBusinessTaskHandler({} as any, {} as any) as jest.Mocked<TruliooBusinessTaskHandler>;

			// Mock the createTaskHandlerMap method
			mockTaskHandler.createTaskHandlerMap = jest.fn().mockReturnValue({
				fetch_business_entity_verification: jest.fn().mockResolvedValue(true)
			});

			// Replace the task handler in our instance
			(truliooBusiness as any).taskHandler = mockTaskHandler;
			(truliooBusiness as any).updateTask = mockUpdateTask;
		});

		it("should skip task execution when canIRun returns false (country not enabled) and not US", async () => {
			// Mock canIRun to return false - country not in enabled list
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "FR",
					name: "Test French Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo enabled - direct DB query
			const mockDbChain = {
				leftJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({
					integration_status_id: "trulioo-status-id",
					integration_code: "trulioo",
					integration_label: "Trulioo",
					status: "ENABLED"
				})
			};
			mockDb.mockReturnValue(mockDbChain);

			// Only GB is enabled
			mockGetCustomerCountries.mockResolvedValue({
				data: [{ jurisdiction_code: "GB", is_selected: true, is_enabled: true }]
			});

			const taskId = "00000000-0000-0000-0000-000000000000" as const;
			const result = await truliooBusiness.taskHandlerMap?.fetch_business_entity_verification?.(taskId);

			expect(result).toBe(true);
			expect(mockUpdateTask).toHaveBeenCalledWith(taskId, {
				metadata: {
					status: "skipped",
					reason: "KYB integration not needed, PSC screening triggered if applicable"
				}
			});
			expect(mockTaskHandler.createTaskHandlerMap).not.toHaveBeenCalled();
		});

		it("should enqueue deferrable PSC task for US business when KYB is skipped (not trigger immediately)", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "US",
					name: "Test US Business"
				}
			});

			const pscHelpers = require("../../common/pscScreeningHelpers");
			pscHelpers.shouldScreenPSCsForBusiness.mockResolvedValue({
				shouldScreen: true,
				reason: "Advanced Watchlists enabled"
			});

			const mockDbChain = {
				where: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ id: "verification-123" })
			};
			mockDb.mockReturnValue(mockDbChain);

			truliooBusiness.triggerPSCScreening = jest.fn().mockResolvedValue(undefined);

			// Mock TruliooPSCScreening.enqueueForBusiness
			const truliooPSCScreeningModule = require("../truliooPSCScreening");
			truliooPSCScreeningModule.TruliooPSCScreening = {
				enqueueForBusiness: jest.fn().mockResolvedValue(undefined)
			};

			const taskId = "00000000-0000-0000-0000-000000000000" as const;
			const result = await truliooBusiness.taskHandlerMap?.fetch_business_entity_verification?.(taskId);

			expect(result).toBe(true);
			// PSC screening should NOT be triggered immediately (race condition fix)
			expect(truliooBusiness.triggerPSCScreening).not.toHaveBeenCalled();
			// Task should be marked as skipped with deferrable enqueue message
			expect(mockUpdateTask).toHaveBeenCalledWith(taskId, expect.objectContaining({
				metadata: expect.objectContaining({
					status: "skipped",
					reason: expect.stringContaining("deferrable task")
				})
			}));
		});

		it("should execute task when canIRun returns true (country enabled)", async () => {
			// Mock canIRun to return true - country is enabled
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "GB",
					name: "Test UK Business"
				}
			});

			mockGetBusinessCustomers.mockResolvedValue({
				customer_ids: ["customer-123"]
			});

			// Mock Trulioo enabled - returns array directly
			mockGetIntegrationStatusForCustomer.mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			mockGetCustomerCountries.mockResolvedValue([
				{ jurisdiction_code: "GB", is_selected: true, is_enabled: true },
				{ jurisdiction_code: "US", is_selected: false, is_enabled: false }
			]);

			const taskId = "00000000-0000-0000-0000-000000000000" as const;
			const result = await truliooBusiness.taskHandlerMap?.fetch_business_entity_verification?.(taskId);

			expect(result).toBe(true);
			expect(mockUpdateTask).not.toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					metadata: expect.objectContaining({ status: "skipped" })
				})
			);
			expect(mockTaskHandler.createTaskHandlerMap).toHaveBeenCalled();
		});
	});

	describe("triggerPSCScreening", () => {
		let mockShouldScreenPSCsForBusiness: jest.MockedFunction<any>;
		let mockUBOExtractor: any;
		let mockTruliooBase: any;

		beforeEach(() => {
			const pscHelpers = require("../../common/pscScreeningHelpers");
			mockShouldScreenPSCsForBusiness = pscHelpers.shouldScreenPSCsForBusiness;
			mockShouldScreenPSCsForBusiness.mockClear();

			// Get the UBO extractor instance and TruliooBase
			mockUBOExtractor = (truliooBusiness as any).uboExtractor;
			mockTruliooBase = (truliooBusiness as any).truliooBase;
			
			// Mock getBusinessId to return the mock business ID
			if (mockTruliooBase) {
				mockTruliooBase.getBusinessId = jest.fn().mockReturnValue(mockBusinessId);
			}
		});

		it("should proceed with PSC screening for non-US business (Canada) automatically when International KYB is enabled", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "CA",
					name: "Test Canadian Business",
					business_addresses: []
				}
			});

			mockShouldScreenPSCsForBusiness.mockResolvedValue({
				shouldScreen: true,
				reason: "Non-US business - automatic PSC screening when International KYB is enabled"
			});

			mockUBOExtractor.extractAndScreenUBOsDirectors.mockResolvedValue([]);

			const mockClientData = {
				businessData: {
					name: "Test Business",
					country: "CA",
					state: "ON",
					city: "Toronto",
					postalCode: "M5B 2R6"
				}
			};

			const mockFlowResult = {
				hfSession: "test-session",
				flowData: { elements: [] },
				submitResponse: {},
				clientData: mockClientData
			};

			await truliooBusiness.triggerPSCScreening(
				"verification-id",
				mockClientData,
				mockFlowResult
			);

			expect(mockShouldScreenPSCsForBusiness).toHaveBeenCalledWith(mockBusinessId, "CA");
			expect(mockUBOExtractor.extractAndScreenUBOsDirectors).toHaveBeenCalled();
		});

		it("should proceed with PSC screening for UK business automatically when International KYB is enabled", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "GB",
					name: "Test UK Business",
					business_addresses: []
				}
			});

			mockShouldScreenPSCsForBusiness.mockResolvedValue({
				shouldScreen: true,
				reason: "Non-US business - automatic PSC screening when International KYB is enabled"
			});

			mockUBOExtractor.extractAndScreenUBOsDirectors.mockResolvedValue([]);

			const mockClientData = {
				businessData: {
					name: "Test Business",
					country: "GB",
					state: "England",
					city: "London",
					postalCode: "SW1A 1AA"
				}
			};

			const mockFlowResult = {
				hfSession: "test-session",
				flowData: { elements: [] },
				submitResponse: {},
				clientData: mockClientData
			};

			await truliooBusiness.triggerPSCScreening(
				"verification-id",
				mockClientData,
				mockFlowResult
			);

			expect(mockShouldScreenPSCsForBusiness).toHaveBeenCalledWith(mockBusinessId, "GB");
			expect(mockUBOExtractor.extractAndScreenUBOsDirectors).toHaveBeenCalled();
		});

		it("should skip PSC screening when International KYB is disabled", async () => {
			mockGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: {
					address_country: "CA",
					name: "Test Canadian Business",
					business_addresses: []
				}
			});

			mockShouldScreenPSCsForBusiness.mockResolvedValue({
				shouldScreen: false,
				reason: "International KYB not enabled"
			});

			const mockClientData = {
				businessData: {
					name: "Test Business",
					country: "CA"
				}
			};

			const mockFlowResult = {
				hfSession: "test-session",
				flowData: { elements: [] },
				submitResponse: {},
				clientData: mockClientData
			};

			await truliooBusiness.triggerPSCScreening(
				"verification-id",
				mockClientData,
				mockFlowResult
			);

			expect(mockShouldScreenPSCsForBusiness).toHaveBeenCalled();
			expect(mockUBOExtractor.extractAndScreenUBOsDirectors).not.toHaveBeenCalled();
		});

		it("should continue with PSC screening using Trulioo data when getBusinessDetails fails", async () => {
			const mockLogger = require("#helpers/logger").logger;
			mockLogger.warn.mockClear();

			mockGetBusinessDetails.mockRejectedValue(new Error("Network error: Failed to fetch business details"));

			mockShouldScreenPSCsForBusiness.mockResolvedValue({
				shouldScreen: true,
				reason: "Non-US business - automatic PSC screening when International KYB is enabled"
			});

			mockUBOExtractor.extractAndScreenUBOsDirectors.mockResolvedValue([]);

			if (mockTruliooBase) {
				mockTruliooBase["businessID"] = mockBusinessId;
			}

			const mockClientData = {
				businessData: {
					name: "Test Business from Trulioo",
					country: "CA",
					state: "ON",
					city: "Toronto",
					postalCode: "M5B 2R6"
				}
			};

			const mockFlowResult = {
				hfSession: "test-session",
				flowData: { elements: [] },
				submitResponse: {},
				clientData: mockClientData
			};

			await truliooBusiness.triggerPSCScreening(
				"verification-id",
				mockClientData,
				mockFlowResult
			);

			expect(mockGetBusinessDetails).toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.objectContaining({
					businessId: mockBusinessId,
					error: expect.any(String)
				}),
				"Failed to fetch business details from case-service, continuing with Trulioo response data only"
			);
			expect(mockShouldScreenPSCsForBusiness).toHaveBeenCalledWith(mockBusinessId, "CA");
			expect(mockUBOExtractor.extractAndScreenUBOsDirectors).toHaveBeenCalled();
		});
	});

	describe("Download shareholder PDF document", () => {
		it("should extract PDF URL when clientData contains ShareholderListDocument in flowData", () => {
			const transactionRecordId = "20cba072-e0ec-aa3d-9dbc-5fe71577a28f";
			const clientDataWithPdf = {
				flowData: {
					node1: {
						serviceData: [
							{
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												AppendedFields: [
													{
														FieldName: "ShareholderListDocument",
														Data: `/verifications/v3/documentdownload/${transactionRecordId}/ShareholderListDocument`
													}
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const extractPdfUrlFromResponse = (truliooBusiness as any).extractPdfUrlFromResponse.bind(truliooBusiness);
			const result = extractPdfUrlFromResponse(clientDataWithPdf);

			expect(result).toBe(
				`https://api.trulioo.com/v3/verifications/documentdownload/${transactionRecordId}/ShareholderListDocument`
			);
		});

		it("should return null when clientData has no ShareholderListDocument", () => {
			const clientDataWithoutPdf = {
				flowData: {
					node1: {
						serviceData: [
							{
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												AppendedFields: [
													{ FieldName: "OtherField", Data: "value" }
												]
											}
										]
									}
								}
							}
						]
					}
				}
			};

			const extractPdfUrlFromResponse = (truliooBusiness as any).extractPdfUrlFromResponse.bind(truliooBusiness);
			const result = extractPdfUrlFromResponse(clientDataWithoutPdf);

			expect(result).toBeNull();
		});
	});
});
