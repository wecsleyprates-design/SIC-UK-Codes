import { TruliooBusinessKYBProcessor } from "../truliooBusinessKYBProcessor";
import { TruliooBase } from "../../common/truliooBase";
import { ITruliooBusinessResultsStorage, ITruliooUBOExtractor } from "../types";

// Mock dependencies
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("../../common/truliooBase");

describe("TruliooBusinessKYBProcessor", () => {
	let processor: TruliooBusinessKYBProcessor;
	let mockTruliooBase: jest.Mocked<TruliooBase>;
	let mockResultsStorage: jest.Mocked<ITruliooBusinessResultsStorage>;
	let mockUBOExtractor: jest.Mocked<ITruliooUBOExtractor>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mocks
		mockTruliooBase = {
			businessID: "test-business-123",
			runVerificationFlow: jest.fn(),
			getKybFlowId: jest.fn().mockReturnValue("kyb-flow"),
			getPscFlowId: jest.fn().mockReturnValue("psc-flow")
		} as any;

		mockResultsStorage = {
			storeBusinessVerificationResults: jest.fn(),
			storeInitialVerificationRecord: jest.fn().mockResolvedValue(undefined)
		} as any;

		mockUBOExtractor = {
			extractAndScreenUBOsDirectors: jest.fn()
		};

		// Create processor instance
		processor = new TruliooBusinessKYBProcessor(mockTruliooBase, mockResultsStorage, mockUBOExtractor);
	});

	describe("KYB Flow Processing", () => {
		it("should process KYB flow successfully", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business Ltd",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA",
						line_1: "123 Test Street"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			// Setup mocks
			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			// Verify initial record was stored
			expect(mockResultsStorage.storeInitialVerificationRecord).toHaveBeenCalledWith(
				taskId,
				expect.any(Object),
				"test-session-123"
			);

			// Verify verification flow was called
			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyName: "Test Business Ltd",
					companyCountryIncorporation: "GB",
					companyCity: "London",
					companyZip: "SW1A 1AA"
				})
			);

			// Verify results were stored
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					companyName: "Test Business Ltd",
					companyCountryIncorporation: "GB"
				}),
				mockFlowResult
			);
		});

		it("should handle flow processing failure", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const flowError = new Error("Flow processing failed");
			mockTruliooBase.runVerificationFlow.mockRejectedValue(flowError);

			await expect(processor.processKYBFlow(taskId, businessData)).rejects.toThrow("Flow processing failed");

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalled();
			expect(mockResultsStorage.storeBusinessVerificationResults).not.toHaveBeenCalled();
		});

		it("should handle missing session in flow result", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "", // Empty session should trigger error
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);

			await expect(processor.processKYBFlow(taskId, businessData)).rejects.toThrow(
				"Failed to initiate KYB flow - no session returned from Trulioo"
			);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalled();
			expect(mockResultsStorage.storeBusinessVerificationResults).not.toHaveBeenCalled();
		});

		it("should handle results storage failure", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};
			const storageError = new Error("Storage failed");

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockRejectedValue(storageError);

			await expect(processor.processKYBFlow(taskId, businessData)).rejects.toThrow("Storage failed");

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalled();
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalled();
		});
	});

	describe("Business Data Mapping", () => {
		it("should map business data correctly to Trulioo format", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business Ltd",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						state: "England",
						city: "London",
						postal_code: "SW1A 1AA",
						line_1: "123 Test Street"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyName: "Test Business Ltd", // Should use name
					companyCountryIncorporation: "GB", // Should use country
					companyStateAddress: "England", // Should use state
					companyCity: "London",
					companyZip: "SW1A 1AA", // Should use postal_code
					companyAddressFull: "123 Test Street" // Should use line_1 from primary address
				})
			);
		});

		it("should use flat address_line_1 as fallback when primary address has no line_1", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business Ltd",
				address_line_1: "456 Main Street", // Flat field fallback
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						state: "England",
						city: "London",
						postal_code: "SW1A 1AA"
						// No line_1 in primary address
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyAddressFull: "456 Main Street" // Should use flat address_line_1 as fallback
				})
			);
		});

		it("should prioritize primary address line_1 over flat address_line_1", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business Ltd",
				address_line_1: "456 Main Street", // Should be ignored when primary address has line_1
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						state: "England",
						city: "London",
						postal_code: "SW1A 1AA",
						line_1: "123 Test Street" // Primary address has precedence
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyAddressFull: "123 Test Street" // Primary address line_1 has precedence
				})
			);
		});

		it("should send street-only address to Trulioo but store full address with suite (nested address)", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Hive Solutions Inc",
				business_addresses: [
					{
						is_primary: true,
						country: "CA",
						state: "AB",
						city: "Calgary",
						postal_code: "T2P0L4",
						line_1: "330 5 Avenue Southwest",
						apartment: "suite 1800"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			// Trulioo receives street-only (no suite) → ensures all-green Comprehensive View
			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyAddressFull: "330 5 Avenue Southwest"
				})
			);

			// Storage receives full address (with suite) → ensures verification badge still works
			expect(mockResultsStorage.storeInitialVerificationRecord).toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					companyAddressFull: "330 5 Avenue Southwest, suite 1800"
				}),
				"test-session-123"
			);
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					companyAddressFull: "330 5 Avenue Southwest, suite 1800"
				}),
				mockFlowResult
			);
		});

		it("should send street-only address to Trulioo but store full address with suite (flat fields)", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Corp",
				address_line_1: "200 University Ave",
				address_line_2: "Suite 200",
				address_city: "Toronto",
				address_state: "ON",
				address_postal_code: "M5H 3W5",
				address_country: "CA",
				business_addresses: []
			};

			const mockFlowResult = {
				hfSession: "test-session-456",
				flowData: { elements: [] },
				submitResponse: {},
				clientData: {}
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			// Trulioo receives street-only (no suite)
			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyAddressFull: "200 University Ave"
				})
			);

			// Storage receives full address (with suite)
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					companyAddressFull: "200 University Ave, Suite 200"
				}),
				mockFlowResult
			);
		});

		it("should send same address to both Trulioo and storage when no address_line_2 exists", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Simple Corp",
				business_addresses: [
					{
						is_primary: true,
						country: "CA",
						state: "ON",
						city: "Toronto",
						postal_code: "M5H 3W5",
						line_1: "200 University Ave"
						// No apartment / address_line_2
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-789",
				flowData: { elements: [] },
				submitResponse: {},
				clientData: {}
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			// Both Trulioo and storage receive the same address (no suite to separate)
			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyAddressFull: "200 University Ave"
				})
			);
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					companyAddressFull: "200 University Ave"
				}),
				mockFlowResult
			);
		});
	});

	describe("Error Handling", () => {
		it("should handle null business data gracefully", async () => {
			const taskId = "test-task-123";
			const businessData = null as any;

			await expect(processor.processKYBFlow(taskId, businessData)).rejects.toThrow();

			expect(mockTruliooBase.runVerificationFlow).not.toHaveBeenCalled();
		});

		it("should handle undefined business data gracefully", async () => {
			const taskId = "test-task-123";
			const businessData = undefined as any;

			await expect(processor.processKYBFlow(taskId, businessData)).rejects.toThrow();

			expect(mockTruliooBase.runVerificationFlow).not.toHaveBeenCalled();
		});

		it("should handle malformed business data", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: undefined,
				country: undefined,
				registrationNumber: 123 // Wrong type
			} as any;

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await expect(processor.processKYBFlow(taskId, businessData)).rejects.toThrow(
				"Business name is required for KYB verification"
			);

			// Should not call runVerificationFlow due to validation error
			expect(mockTruliooBase.runVerificationFlow).not.toHaveBeenCalled();
		});
	});

	describe("Integration with Dependencies", () => {
		it("should properly integrate with TruliooBase", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyName: businessData.name
				})
			);
		});

		it("should properly integrate with ResultsStorage", async () => {
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			expect(mockResultsStorage.storeInitialVerificationRecord).toHaveBeenCalled();
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					companyName: businessData.name
				}),
				mockFlowResult
			);
		});
	});

	describe("Logging and Monitoring", () => {
		it("should log KYB flow processing start", async () => {
			const { logger } = require("#helpers/logger");
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

					expect(logger.info).toHaveBeenCalledWith(
						expect.stringContaining("🚀 Starting KYB verification for business: test-business-123")
					);
		});

		it("should log KYB flow completion", async () => {
			const { logger } = require("#helpers/logger");
			const taskId = "test-task-123";
			const businessData = {
				name: "Test Business",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

					expect(logger.info).toHaveBeenCalledWith(
						expect.stringContaining("🎉 KYB verification completed for business: test-business-123")
					);
		});
	});

	describe("Edge Cases", () => {
		it("should handle concurrent KYB processing", async () => {
			const taskId1 = "test-task-1";
			const taskId2 = "test-task-2";
			const businessData = {
				name: "Test Business",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			const [result1, result2] = await Promise.all([
				processor.processKYBFlow(taskId1, businessData),
				processor.processKYBFlow(taskId2, businessData)
			]);

			expect(mockResultsStorage.storeInitialVerificationRecord).toHaveBeenCalledTimes(2);
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalledTimes(2);
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalledWith(
				taskId1,
				expect.any(Object),
				mockFlowResult
			);
			expect(mockResultsStorage.storeBusinessVerificationResults).toHaveBeenCalledWith(
				taskId2,
				expect.any(Object),
				mockFlowResult
			);
		});

		it("should handle different business data formats", async () => {
			const taskId = "test-task-123";
			const businessData = {
				// Only name provided
				name: "Test Business Ltd",
				business_addresses: [
					{
						is_primary: true,
						country: "GB",
						city: "London",
						postal_code: "SW1A 1AA"
					}
				]
			};

			const mockFlowResult = {
				hfSession: "test-session-123",
				flowData: { elements: [], verification: "passed" },
				submitResponse: { status: "submitted" },
				clientData: { clientId: "test-client-123", data: { verification: "passed" } }
			};

			mockTruliooBase.runVerificationFlow.mockResolvedValue(mockFlowResult);
			mockResultsStorage.storeBusinessVerificationResults.mockResolvedValue();

			await processor.processKYBFlow(taskId, businessData);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"kyb-flow",
				expect.objectContaining({
					companyName: "Test Business Ltd",
					companyCountryIncorporation: "GB",
					companyStateAddress: "",
					companyCity: "London",
					companyZip: "SW1A 1AA"
				})
			);
		});
	});
});
