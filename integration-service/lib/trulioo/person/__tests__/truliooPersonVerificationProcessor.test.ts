import { TruliooPersonVerificationProcessor } from "../truliooPersonVerificationProcessor";
import { TruliooBase } from "../../common/truliooBase";
import { TruliooPSCFormData, TruliooUBOPersonData, TruliooFlowResult } from "../../common/types";
import { ITruliooPersonScreeningProcessor } from "../types";
import { TruliooPersonDataStorage } from "../truliooPersonDataStorage";

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
jest.mock("../truliooPersonDataStorage");

describe("TruliooPersonVerificationProcessor", () => {
	let processor: TruliooPersonVerificationProcessor;
	let mockTruliooBase: jest.Mocked<TruliooBase>;
	let mockScreeningProcessor: jest.Mocked<ITruliooPersonScreeningProcessor>;
	let mockDataStorage: jest.Mocked<TruliooPersonDataStorage>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mocks
		mockTruliooBase = {
			businessID: "test-business-123",
			getBusinessId: jest.fn().mockReturnValue("test-business-123"),
			getPscFlowId: jest.fn().mockReturnValue("test-psc-flow"),
			runVerificationFlow: jest.fn()
		} as any;

		mockScreeningProcessor = {
			processScreeningResults: jest.fn()
		};

		mockDataStorage = {
			storeInitialPersonRecord: jest.fn().mockResolvedValue(undefined)
		} as any;

		// Create processor instance
		processor = new TruliooPersonVerificationProcessor(mockTruliooBase, mockScreeningProcessor, mockDataStorage);
	});

	describe("Person Verification Processing", () => {
		it("should process person verification successfully with completed screening", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "John Doe",
				firstName: "John",
				lastName: "Doe",
				dateOfBirth: "1990-01-01",
				addressLine1: "123 Test Street",
				city: "London",
				postalCode: "SW1A 1AA",
				country: "GB",
				nationality: "GB",
				controlType: "UBO"
			};

			const businessData: TruliooPSCFormData = {
				companyName: "Test Company Ltd",
				companyCountryIncorporation: "GB",
				companyregno: "12345678",
				companyStateAddress: "London",
				companyCity: "London",
				companyZip: "SW1A 1AA"
			};

			const mockFlowResult: TruliooFlowResult = {
				hfSession: "session-123",
				external_id: "external-123",
				status: "completed",
				flowData: { elements: [] },
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{
							listType: "SANCTIONS",
							listName: "OFAC Sanctions List",
							confidence: 0.95,
							matchDetails: "Name match found"
						}
					]
				}
			};

			// Mock successful flow execution
			mockTruliooBase.runVerificationFlow.mockResolvedValue({
				hfSession: mockFlowResult.hfSession || "session-123",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: mockFlowResult.clientData
			});

			// Mock successful screening processing
			mockScreeningProcessor.processScreeningResults.mockResolvedValue({
				person: personData,
				status: "COMPLETED",
				watchlistHits: [
					{
						listType: "SANCTIONS",
						listName: "OFAC Sanctions List",
						confidence: 0.95,
						matchDetails: "Name match found"
					}
				],
				provider: "trulioo",
				screenedAt: new Date().toISOString(),
				metadata: {
					hfSession: "session-123",
					rawResponse: {}
				}
			});

			const result = await processor.processPersonVerification(personData, businessData);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"test-psc-flow",
				expect.objectContaining({
					companyName: "Test Company Ltd",
					companyCountryIncorporation: "GB"
				})
			);

			expect(mockDataStorage.storeInitialPersonRecord).toHaveBeenCalledWith(
				"test-business-123",
				"session-123",
				businessData,
				undefined,
				undefined
			);

			expect(mockScreeningProcessor.processScreeningResults).toHaveBeenCalledWith(personData, {
				hfSession: "session-123",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: mockFlowResult.clientData
			});

			expect(result).toEqual({
				inquiryId: "session-123",
				status: "completed",
				results: {
					watchlistHits: [
						{
							listType: "SANCTIONS",
							listName: "OFAC Sanctions List",
							confidence: 0.95,
							matchDetails: "Name match found"
						}
					],
					screeningStatus: "COMPLETED"
				}
			});
		});

		it("should process person verification with taskId and businessEntityVerificationId provided", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "John Doe",
				firstName: "John",
				lastName: "Doe",
				dateOfBirth: "1990-01-01",
				addressLine1: "123 Test Street",
				city: "London",
				postalCode: "SW1A 1AA",
				country: "GB",
				nationality: "GB",
				controlType: "UBO"
			};

			const businessData: TruliooPSCFormData = {
				companyName: "Test Company Ltd",
				companyCountryIncorporation: "GB",
				companyregno: "12345678",
				companyStateAddress: "London",
				companyCity: "London",
				companyZip: "SW1A 1AA"
			};

			const mockTaskId = "test-task-id-123";
			const mockBusinessEntityVerificationId = "test-kyb-verification-id-123";

			const mockFlowResult: TruliooFlowResult = {
				hfSession: "session-789",
				external_id: "external-789",
				status: "completed",
				flowData: { elements: [] },
				clientData: {
					status: "COMPLETED",
					watchlistResults: []
				}
			};

			// Mock successful flow execution
			mockTruliooBase.runVerificationFlow.mockResolvedValue({
				hfSession: mockFlowResult.hfSession || "session-789",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: mockFlowResult.clientData
			});

			// Mock successful screening processing
			mockScreeningProcessor.processScreeningResults.mockResolvedValue({
				person: personData,
				status: "COMPLETED",
				watchlistHits: [],
				provider: "trulioo",
				screenedAt: new Date().toISOString(),
				metadata: {
					hfSession: "session-789",
					rawResponse: {}
				}
			});

			const result = await processor.processPersonVerification(
				personData,
				businessData,
				mockTaskId,
				mockBusinessEntityVerificationId
			);

			// Verify that both taskId and businessEntityVerificationId are passed to storeInitialPersonRecord
			expect(mockDataStorage.storeInitialPersonRecord).toHaveBeenCalledWith(
				"test-business-123",
				"session-789",
				businessData,
				mockTaskId,
				mockBusinessEntityVerificationId
			);

			expect(result).toEqual({
				inquiryId: "session-789",
				status: "completed",
				results: {
					watchlistHits: [],
					screeningStatus: "COMPLETED"
				}
			});
		});

		it("should process person verification with pending screening", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "Jane Smith",
				firstName: "Jane",
				lastName: "Smith",
				dateOfBirth: "1985-05-15",
				addressLine1: "456 Another Street",
				city: "Manchester",
				postalCode: "M1 1AA",
				country: "GB",
				nationality: "GB",
				controlType: "DIRECTOR"
			};

			const businessData: TruliooPSCFormData = {
				companyName: "Another Company Ltd",
				companyCountryIncorporation: "GB",
				companyregno: "87654321",
				companyStateAddress: "Manchester",
				companyCity: "Manchester",
				companyZip: "M1 1AA"
			};

			const mockFlowResult: TruliooFlowResult = {
				hfSession: "session-456",
				external_id: "external-456",
				status: "pending",
				flowData: { elements: [] },
				clientData: {
					status: "PENDING",
					watchlistResults: []
				}
			};

			// Mock successful flow execution
			mockTruliooBase.runVerificationFlow.mockResolvedValue({
				hfSession: mockFlowResult.hfSession || "session-123",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: mockFlowResult.clientData
			});

			// Mock pending screening processing
			mockScreeningProcessor.processScreeningResults.mockResolvedValue({
				person: personData,
				status: "PENDING",
				watchlistHits: [],
				provider: "trulioo",
				screenedAt: new Date().toISOString(),
				metadata: {
					hfSession: "session-456",
					rawResponse: {}
				}
			});

			const result = await processor.processPersonVerification(personData, businessData);

			expect(mockDataStorage.storeInitialPersonRecord).toHaveBeenCalledWith(
				"test-business-123",
				"session-456",
				businessData,
				undefined,
				undefined
			);

			expect(result).toEqual({
				inquiryId: "session-456",
				status: "pending",
				results: {
					watchlistHits: [],
					screeningStatus: "PENDING"
				}
			});
		});

		it("should handle missing hfSession in flow result", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "John Doe",
				firstName: "John",
				lastName: "Doe",
				dateOfBirth: "1990-01-01",
				addressLine1: "123 Test Street",
				city: "London",
				postalCode: "SW1A 1AA",
				country: "GB",
				nationality: "GB",
				controlType: "UBO"
			};

			const businessData: TruliooPSCFormData = {
				companyName: "Test Company Ltd",
				companyCountryIncorporation: "GB",
				companyregno: "12345678",
				companyStateAddress: "London",
				companyCity: "London",
				companyZip: "SW1A 1AA"
			};

			const mockFlowResult: TruliooFlowResult = {
				external_id: "external-123",
				status: "completed",
				flowData: { elements: [] },
				clientData: {
					status: "COMPLETED",
					watchlistResults: []
				}
				// Missing hfSession
			};

			// Mock successful flow execution
			mockTruliooBase.runVerificationFlow.mockResolvedValue({
				hfSession: "", // Empty hfSession should trigger error
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: mockFlowResult.clientData
			});

			// Mock successful screening processing
			mockScreeningProcessor.processScreeningResults.mockResolvedValue({
				person: personData,
				status: "COMPLETED",
				watchlistHits: [],
				provider: "trulioo",
				screenedAt: new Date().toISOString(),
				metadata: {
					hfSession: "session-123",
					rawResponse: {}
				}
			});

			await expect(processor.processPersonVerification(personData, businessData)).rejects.toThrow(
				"Failed to process person verification for John Doe"
			);
		});
	});

	describe("Error Handling", () => {
		it("should handle flow execution errors", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "John Doe",
				firstName: "John",
				lastName: "Doe",
				dateOfBirth: "1990-01-01",
				addressLine1: "123 Test Street",
				city: "London",
				postalCode: "SW1A 1AA",
				country: "GB",
				nationality: "GB",
				controlType: "UBO"
			};

			const businessData: TruliooPSCFormData = {
				companyName: "Test Company Ltd",
				companyCountryIncorporation: "GB",
				companyregno: "12345678",
				companyStateAddress: "London",
				companyCity: "London",
				companyZip: "SW1A 1AA"
			};

			// Mock flow execution error
			mockTruliooBase.runVerificationFlow.mockRejectedValue(new Error("Trulioo API error"));

			await expect(processor.processPersonVerification(personData, businessData)).rejects.toThrow("Trulioo API error");

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"test-psc-flow",
				expect.objectContaining({
					companyName: "Test Company Ltd",
					companyCountryIncorporation: "GB"
				})
			);
		});

		it("should handle screening processing errors", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "John Doe",
				firstName: "John",
				lastName: "Doe",
				dateOfBirth: "1990-01-01",
				addressLine1: "123 Test Street",
				city: "London",
				postalCode: "SW1A 1AA",
				country: "GB",
				nationality: "GB",
				controlType: "UBO"
			};

			const businessData: TruliooPSCFormData = {
				companyName: "Test Company Ltd",
				companyCountryIncorporation: "GB",
				companyregno: "12345678",
				companyStateAddress: "London",
				companyCity: "London",
				companyZip: "SW1A 1AA"
			};

			const mockFlowResult: TruliooFlowResult = {
				hfSession: "session-123",
				external_id: "external-123",
				status: "completed",
				flowData: { elements: [] },
				clientData: {
					status: "COMPLETED",
					watchlistResults: []
				}
			};

			// Mock successful flow execution
			mockTruliooBase.runVerificationFlow.mockResolvedValue({
				hfSession: mockFlowResult.hfSession || "session-123",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: mockFlowResult.clientData
			});

			// Mock screening processing error
			mockScreeningProcessor.processScreeningResults.mockRejectedValue(new Error("Screening processing failed"));

			await expect(processor.processPersonVerification(personData, businessData)).rejects.toThrow(
				"Screening processing failed"
			);

			expect(mockScreeningProcessor.processScreeningResults).toHaveBeenCalledWith(personData, {
				hfSession: "session-123",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: mockFlowResult.clientData
			});
		});
	});

	describe("DOB Handling", () => {
		const businessData: TruliooPSCFormData = {
			companyName: "Test Company Ltd",
			companyCountryIncorporation: "GB",
			companyregno: "12345678",
			companyStateAddress: "London",
			companyCity: "London",
			companyZip: "SW1A 1AA"
		};

		const setupMocks = (hfSession: string) => {
			mockTruliooBase.runVerificationFlow.mockResolvedValue({
				hfSession,
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: { status: "COMPLETED", watchlistResults: [] }
			});
		mockScreeningProcessor.processScreeningResults.mockResolvedValue({
			person: {} as TruliooUBOPersonData,
			status: "COMPLETED",
			watchlistHits: [],
			provider: "trulioo",
			screenedAt: new Date().toISOString(),
			metadata: {}
		});
		};

		it("should pass DOB as-is when available in person data", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "John Doe",
				firstName: "John",
				lastName: "Doe",
				dateOfBirth: "1990-01-01",
				addressLine1: "123 Test Street",
				city: "London",
				postalCode: "SW1A 1AA",
				country: "GB",
				controlType: "UBO"
			};

			setupMocks("session-dob-1");
			await processor.processPersonVerification(personData, businessData);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"test-psc-flow",
				expect.objectContaining({ personDateOfBirth: "1990-01-01" })
			);
		});

		it("should send empty string for DOB when not available (no placeholder)", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "Marilu Gaudio",
				firstName: "Marilu",
				lastName: "Gaudio",
				dateOfBirth: "",
				addressLine1: "",
				city: "",
				postalCode: "",
				country: "CA",
				controlType: "DIRECTOR"
			};

			setupMocks("session-dob-2");
			await processor.processPersonVerification(personData, businessData);

			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"test-psc-flow",
				expect.objectContaining({ personDateOfBirth: "" })
			);
		});

		it("should not send hardcoded 1900-01-01 as DOB placeholder", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "No DOB Person",
				firstName: "No",
				lastName: "DOB Person",
				dateOfBirth: "",
				addressLine1: "",
				city: "",
				postalCode: "",
				country: "GB",
				controlType: "UBO"
			};

			setupMocks("session-dob-3");
			await processor.processPersonVerification(personData, businessData);

			const call = mockTruliooBase.runVerificationFlow.mock.calls[0];
			const payload = call[1] as Record<string, unknown>;
			expect(payload.personDateOfBirth).not.toBe("1900-01-01");
			expect(payload.personDateOfBirth).toBe("");
		});
	});

	describe("Data Validation", () => {
		it("should validate person data structure", async () => {
			const personData: TruliooUBOPersonData = {
				fullName: "John Doe",
				firstName: "John",
				lastName: "Doe",
				dateOfBirth: "1990-01-01",
				addressLine1: "123 Test Street",
				city: "London",
				postalCode: "SW1A 1AA",
				country: "GB",
				nationality: "GB",
				controlType: "UBO"
			};

			const businessData: TruliooPSCFormData = {
				companyName: "Test Company Ltd",
				companyCountryIncorporation: "GB",
				companyregno: "12345678",
				companyStateAddress: "London",
				companyCity: "London",
				companyZip: "SW1A 1AA"
			};

			const mockFlowResult: TruliooFlowResult = {
				hfSession: "session-123",
				external_id: "external-123",
				status: "completed",
				flowData: { elements: [] },
				clientData: {
					status: "COMPLETED",
					watchlistResults: []
				}
			};

			// Mock successful flow execution
			mockTruliooBase.runVerificationFlow.mockResolvedValue({
				hfSession: mockFlowResult.hfSession || "session-123",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: mockFlowResult.clientData
			});

			// Mock successful screening processing
			mockScreeningProcessor.processScreeningResults.mockResolvedValue({
				person: personData,
				status: "COMPLETED",
				watchlistHits: [],
				provider: "trulioo",
				screenedAt: new Date().toISOString(),
				metadata: {
					hfSession: "session-123",
					rawResponse: {}
				}
			});

			const result = await processor.processPersonVerification(personData, businessData);

			// Verify that the flow was called with correct person data
			expect(mockTruliooBase.runVerificationFlow).toHaveBeenCalledWith(
				"test-psc-flow",
				expect.objectContaining({
					// Person data should be included in the flow payload
					personName: "John Doe",
					personFirstName: "John",
					personLastName: "Doe",
					personDateOfBirth: "1990-01-01",
					// Business data should also be included
					companyName: "Test Company Ltd",
					companyCountryIncorporation: "GB"
				})
			);

			expect(result.inquiryId).toBe("session-123");
			expect(result.status).toBe("completed");
		});
	});
});
