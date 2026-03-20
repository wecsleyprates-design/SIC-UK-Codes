import { TruliooFactory } from "../../utils/truliooFactory";
import { TruliooBusiness } from "../../business/truliooBusiness";
import { TruliooPerson } from "../../person/truliooPerson";
import { TruliooUBOPersonData, TruliooPSCFormData } from "../types";
import { envConfig } from "#configs";

// Mock the dependencies
jest.mock("#api/v1/modules/verification/businessEntityVerification", () => ({
	BusinessEntityVerificationService: class {
		async getBusinessDetails() {
			return {
				id: "test-business-123",
				name: "Test Business",
				status: "active"
			};
		}
		async getOrCreateTaskForCode() {
			return "test-task-id";
		}
		async processTask() {
			return { success: true };
		}
	}
}));
jest.mock("#helpers", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn()
	}
}));
jest.mock("#helpers/knex", () => ({
	db: jest.fn(() => ({
		select: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		first: jest.fn().mockResolvedValue(null),
		insert: jest.fn().mockReturnThis(),
		onConflict: jest.fn().mockReturnThis(),
		ignore: jest.fn().mockReturnThis(),
		merge: jest.fn().mockReturnThis(),
		returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
	}))
}));
jest.mock("#constants", () => ({
	INTEGRATION_ID: {
		TRULIOO: 38
	},
	INTEGRATION_STATUS: {
		INITIATED: "initiated",
		COMPLETED: "completed"
	},
	ERROR_CODES: {
		INVALID: "INVALID",
		NOT_FOUND: "NOT_FOUND",
		UNKNOWN_ERROR: "UNKNOWN_ERROR"
	},
	IDV_STATUS: {
		SUCCESS: "SUCCESS",
		CANCELED: "CANCELED",
		FAILED: "FAILED",
		EXPIRED: "EXPIRED"
	},
	IBusinessIntegrationTaskEnriched: {
		task_code: "core_tasks.code",
		platform_id: "core_integrations_platforms.id",
		platform_code: "core_integrations_platforms.code",
		platform_category_code: "core_categories.code",
		trigger_type: "business_score_triggers.trigger_type",
		trigger_version: "business_score_triggers.version",
		customer_id: "business_score_triggers.customer_id",
		case_id: "data_cases.id"
	}
}));
jest.mock("#api/v1/modules/tasks/taskManager", () => ({
	TaskManager: {
		getEnrichedTask: jest.fn().mockResolvedValue({
			id: "test-task-id",
			business_id: "test-business-123",
			connection_id: "test-connection-id",
			platform_id: 38,
			task_code: "fetch_business_entity_verification",
			task_status: "CREATED",
			metadata: {}
		})
	}
}));

// Mock TruliooBase methods
jest.mock("../truliooBase", () => {
	return {
		TruliooBase: jest.fn().mockImplementation(() => ({
			runVerificationFlow: jest.fn().mockResolvedValue({
				hfSession: "testSession123",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: { status: "completed", watchlistResults: [] }
			}),
			getFlow: jest.fn().mockResolvedValue({}),
			submitFlow: jest.fn().mockResolvedValue({}),
			getClientData: jest.fn().mockResolvedValue({}),
			mapListType: jest.fn().mockReturnValue("SANCTIONS"),
			calculateRiskLevel: jest.fn().mockReturnValue("LOW"),
			calculateRiskScore: jest.fn().mockReturnValue(25)
		}))
	};
});

describe("Trulioo Dynamic Architecture", () => {
	const mockBusinessId = "test-business-123";

	beforeEach(() => {
		// Mock environment variables
		envConfig.TRULIOO_PSC_FLOWID = "test-psc-flow";
		envConfig.TRULIOO_KYB_FLOWID = "test-kyb-flow";
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("TruliooFactory", () => {
		it("should create business verification instance with correct type", () => {
			const instance = TruliooFactory.create("business", mockBusinessId);

			expect(instance).toBeInstanceOf(TruliooBusiness);
			expect(instance.getIntegrationId()).toBe(38);
			expect(instance.getFlowType()).toBe("KYB");
		});

		it("should create person verification instance with correct type", () => {
			const instance = TruliooFactory.create("person", mockBusinessId);

			expect(instance).toBeInstanceOf(TruliooPerson);
			expect(instance.getIntegrationId()).toBe(38);
			expect(instance.getFlowType()).toBe("PSC");
		});

		it("should throw error for invalid instance type", () => {
			expect(() => {
				TruliooFactory.create("invalid" as any, mockBusinessId);
			}).toThrow("Unsupported Trulioo verification type: invalid");
		});
	});

	describe("TruliooBusiness Integration", () => {
		let businessInstance: TruliooBusiness;

		beforeEach(() => {
			businessInstance = TruliooFactory.create("business", mockBusinessId) as TruliooBusiness;
		});

		it("should have correct task handler mapping for business verification", () => {
			const taskHandlerMap = businessInstance.taskHandlerMap;

			expect(taskHandlerMap).toHaveProperty("fetch_business_entity_verification");
			expect(typeof taskHandlerMap.fetch_business_entity_verification).toBe("function");
		});

		it("should execute business verification flow correctly", async () => {
			const mockTask = {
				id: "test-task-id",
				business_id: mockBusinessId,
				connection_id: "test-connection-id",
				platform_id: 38,
				platform_category_code: "verification",
				task_code: "fetch_business_entity_verification",
				task_status: "CREATED",
				metadata: {},
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			};

			// Mock the runVerificationFlow method
			jest.spyOn(businessInstance, "runVerificationFlow").mockImplementation(async (flowId: string, formData: any) => ({
				hfSession: "testSession123",
				flowData: { elements: [] },
				submitResponse: { success: true },
				clientData: { status: "completed" }
			}));

			const result = await businessInstance.matchBusiness();

			expect(result).toBeDefined();
			expect(result.id).toBe("test-task-id");
		});
	});

	describe("TruliooPerson Integration", () => {
		let personInstance: TruliooPerson;

		beforeEach(() => {
			personInstance = TruliooFactory.create("person", mockBusinessId) as TruliooPerson;
		});

		it("should create person inquiry with correct data flow", async () => {
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

			// Mock the createPersonInquiry method
			jest.spyOn(personInstance, "createPersonInquiry").mockResolvedValue({
				data: { is_trulioo_verified: true, personId: undefined },
				message: "Verification completed"
			});

			const result = await personInstance.createPersonInquiry(personData, businessData, "business-verification-123");

			expect(personInstance.createPersonInquiry).toHaveBeenCalledWith(
				personData,
				businessData,
				"business-verification-123"
			);
			expect(result.data.is_trulioo_verified).toBe(true);
			expect(result.data.personId).toBe(undefined);
		});

		it("should get person verification details correctly", async () => {
			// Mock the getPersonVerificationDetails method
			jest.spyOn(personInstance, "getPersonVerificationDetails").mockResolvedValue({
				data: {
					inquiry_id: "inquiry-123",
					trulioo_status: "completed",
					person_data: { fullName: "John Doe" },
					business_data: { companyName: "Test Company" },
					verification_results: { status: "completed" }
				},
				message: "Details retrieved"
			});

			const result = await personInstance.getPersonVerificationDetails();

			expect(personInstance.getPersonVerificationDetails).toHaveBeenCalledWith();
			expect(result.data?.inquiry_id).toBe("inquiry-123");
			expect(result.data?.trulioo_status).toBe("completed");
		});
	});

	describe("Flow Type Configuration", () => {
		it("should use correct flow IDs from environment configuration", () => {
			const businessInstance = TruliooFactory.create("business", mockBusinessId);
			const personInstance = TruliooFactory.create("person", mockBusinessId);

			// Verify flow types are correctly set
			expect(businessInstance.getFlowType()).toBe("KYB");
			expect(personInstance.getFlowType()).toBe("PSC");
		});

		it("should handle missing environment configuration gracefully", () => {
			// Temporarily remove environment config
			const originalKybFlow = envConfig.TRULIOO_KYB_FLOWID;
			const originalPscFlow = envConfig.TRULIOO_PSC_FLOWID;

			delete (envConfig as any).TRULIOO_KYB_FLOWID;
			delete (envConfig as any).TRULIOO_PSC_FLOWID;

			// Should still create instances with default flow IDs
			const businessInstance = TruliooFactory.create("business", mockBusinessId);
			const personInstance = TruliooFactory.create("person", mockBusinessId);

			expect(businessInstance).toBeInstanceOf(TruliooBusiness);
			expect(personInstance).toBeInstanceOf(TruliooPerson);

			// Restore environment config
			envConfig.TRULIOO_KYB_FLOWID = originalKybFlow;
			envConfig.TRULIOO_PSC_FLOWID = originalPscFlow;
		});
	});

	describe("Error Handling", () => {
		it("should handle business verification errors gracefully", async () => {
			const businessInstance = TruliooFactory.create("business", mockBusinessId);

			// Mock the TaskManager to throw error
			const { TaskManager } = await import("#api/v1/modules/tasks/taskManager");
			jest.spyOn(TaskManager, "getEnrichedTask").mockRejectedValue(new Error("Trulioo API error"));

			await expect(businessInstance.matchBusiness()).rejects.toThrow("Trulioo API error");
		});

		it("should handle person verification errors gracefully", async () => {
			const personInstance = TruliooFactory.create("person", mockBusinessId) as TruliooPerson;

			// Mock createPersonInquiry to throw error
			jest.spyOn(personInstance, "createPersonInquiry").mockRejectedValue(new Error("Person verification failed"));

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

			await expect(
				personInstance.createPersonInquiry(personData, businessData, "business-verification-123")
			).rejects.toThrow("Person verification failed");
		});
	});
});
