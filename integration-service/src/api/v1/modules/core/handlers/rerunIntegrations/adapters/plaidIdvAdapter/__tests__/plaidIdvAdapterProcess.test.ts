import { plaidIdvAdapterProcess as process } from "../plaidIdvAdapterProcess";
import { logger } from "#helpers/logger";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import type { IIdentityVerification, Owner } from "#types";
import type { PlaidIdvMetadata } from "../types";
import { UUID } from "crypto";
import { IntegrationProcessFunctionParams } from "../../types";
import { INTEGRATION_ID, IDV_STATUS, TASK_STATUS } from "#constants";
import type { IPlaidIDV } from "#lib/plaid/types";

jest.mock("#helpers/logger");
jest.mock("#lib/plaid/plaidIdv");
jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-trace-id")
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
const MockPlaidIdv = PlaidIdv as jest.MockedClass<typeof PlaidIdv>;

describe("plaidIdvAdapter - process", () => {
	const businessID = "123e4567-e89b-12d3-a456-426614174000" as UUID;
	const connectionID = "223e4567-e89b-12d3-a456-426614174000" as UUID;

	const createMockOwner = (overrides: Partial<Owner> = {}): Owner => ({
		id: "323e4567-e89b-12d3-a456-426614174000" as UUID,
		title: null,
		first_name: "John",
		last_name: "Doe",
		ssn: "encrypted-ssn",
		email: "john@example.com",
		mobile: "1234567890",
		date_of_birth: "encrypted-dob",
		address_apartment: null,
		address_line_1: "123 Main St",
		address_line_2: null,
		address_city: "New York",
		address_state: "NY",
		address_postal_code: "10001",
		address_country: "US",
		created_at: "2024-01-01T00:00:00.000Z",
		created_by: "423e4567-e89b-12d3-a456-426614174000" as UUID,
		updated_at: "2024-01-01T00:00:00.000Z",
		updated_by: "523e4567-e89b-12d3-a456-426614174000" as UUID,
		last_four_of_ssn: "1234",
		year_of_birth: 1990,
		...overrides
	});

	const createMockPlaidIdv = () => {
		const mockInstance = new MockPlaidIdv() as jest.Mocked<PlaidIdv>;
		mockInstance.initializePlaidIdvConnectionConfiguration = jest.fn().mockResolvedValue(mockInstance as any);
		mockInstance.enrollApplicantOrGetExistingIdvRecord = jest.fn();
		return mockInstance;
	};

	/** Factory function for creating mock enrollment response */
	const createMockEnrollmentResponse = (
		overrides: Partial<IPlaidIDV.EnrollApplicantResponse> = {}
	): IPlaidIDV.EnrollApplicantResponse => ({
		taskId: "623e4567-e89b-12d3-a456-426614174000" as UUID,
		taskStatus: TASK_STATUS.IN_PROGRESS,
		previousSuccess: false,
		record: {
			status: IDV_STATUS.PENDING,
			external_id: "plaid_idv_12345",
			created_at: "2024-01-01T00:00:00.000Z"
		} as unknown as IIdentityVerification,
		...overrides
	});

	/** Factory function for creating test params */
	const createParams = (
		overrides: Partial<IntegrationProcessFunctionParams<PlaidIdvMetadata>> = {}
	): IntegrationProcessFunctionParams<PlaidIdvMetadata> => ({
		platform: createMockPlaidIdv() as unknown as PlaidIdv,
		platform_id: INTEGRATION_ID.PLAID_IDV,
		platform_code: "plaid_idv",
		connection_id: connectionID,
		business_id: businessID,
		task_code: "fetch_identity_verification",
		metadata: { owners: [] },
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockLogger.info = jest.fn();
		mockLogger.debug = jest.fn();
		mockLogger.error = jest.fn();
	});

	describe("successful enrollment", () => {
		it("should enroll a single owner and return task ID", async () => {
			/** Arrange */
			const mockOwner = createMockOwner();
			const metadata: PlaidIdvMetadata = { owners: [mockOwner] };
			const taskId = "623e4567-e89b-12d3-a456-426614174000" as UUID;
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord.mockResolvedValue(createMockEnrollmentResponse({ taskId }));

			/** Act */
			const result = await process(params);

			/** Assert */
			expect(result).toEqual([taskId]);
			expect(mockPlaidIdv.initializePlaidIdvConnectionConfiguration).toHaveBeenCalledTimes(1);
			expect(mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord).toHaveBeenCalledWith(mockOwner);
			expect(mockLogger.info).toHaveBeenCalledWith(
				{ trace_id: "mock-trace-id", business_id: businessID, connection_id: connectionID, ownerCount: 1 },
				"Starting Plaid IDV enrollment for 1 owner(s)"
			);
		});

		it("should enroll multiple owners and return all task IDs", async () => {
			/** Arrange */
			const mockOwners = [
				createMockOwner({ id: "723e4567-e89b-12d3-a456-426614174000" as UUID }),
				createMockOwner({ id: "823e4567-e89b-12d3-a456-426614174000" as UUID }),
				createMockOwner({ id: "923e4567-e89b-12d3-a456-426614174000" as UUID })
			];
			const metadata: PlaidIdvMetadata = { owners: mockOwners };
			const taskIds = [
				"a23e4567-e89b-12d3-a456-426614174000" as UUID,
				"b23e4567-e89b-12d3-a456-426614174000" as UUID,
				"c23e4567-e89b-12d3-a456-426614174000" as UUID
			];
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord
				.mockResolvedValueOnce(createMockEnrollmentResponse({ taskId: taskIds[0] }))
				.mockResolvedValueOnce(createMockEnrollmentResponse({ taskId: taskIds[1] }))
				.mockResolvedValueOnce(createMockEnrollmentResponse({ taskId: taskIds[2] }));

			/** Act */
			const result = await process(params);

			/** Assert */
			expect(result).toEqual(taskIds);
			expect(mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord).toHaveBeenCalledTimes(3);
			expect(mockLogger.info).toHaveBeenCalledWith(
				{
					trace_id: "mock-trace-id",
					business_id: businessID,
					connection_id: connectionID,
					totalOwners: 3,
					successful: 3,
					failed: 0
				},
				"Completed Plaid IDV enrollment"
			);
		});

		it("should handle owner with previous successful IDV", async () => {
			/** Arrange */
			const mockOwner = createMockOwner();
			const metadata: PlaidIdvMetadata = { owners: [mockOwner] };
			const taskId = "d23e4567-e89b-12d3-a456-426614174000" as UUID;
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord.mockResolvedValue(
				createMockEnrollmentResponse({ taskId, taskStatus: TASK_STATUS.SUCCESS, previousSuccess: true })
			);

			/** Act */
			const result = await process(params);

			/** Assert */
			expect(result).toEqual([taskId]);
			expect(mockLogger.info).toHaveBeenCalledWith(
				{ trace_id: "mock-trace-id", business_id: businessID, ownerId: mockOwner.id, task_id: taskId },
				`Owner ${mockOwner.id} has already completed IDV with unchanged information`
			);
		});

		it("should filter out undefined task IDs", async () => {
			/** Arrange */
			const mockOwners = [
				createMockOwner({ id: "e23e4567-e89b-12d3-a456-426614174000" as UUID }),
				createMockOwner({ id: "f23e4567-e89b-12d3-a456-426614174000" as UUID })
			];
			const metadata: PlaidIdvMetadata = { owners: mockOwners };
			const taskId = "023e4567-e89b-12d3-a456-426614174000" as UUID;
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord
				.mockResolvedValueOnce(createMockEnrollmentResponse({ taskId }))
				.mockResolvedValueOnce(createMockEnrollmentResponse({ taskId: undefined }));

			/** Act */
			const result = await process(params);

			/** Assert */
			expect(result).toEqual([taskId]);
		});

		it("should log enrollment results for each owner", async () => {
			/** Arrange */
			const mockOwner = createMockOwner();
			const metadata: PlaidIdvMetadata = { owners: [mockOwner] };
			const taskId = "123e4567-e89b-12d3-a456-426614174001" as UUID;
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord.mockResolvedValue(createMockEnrollmentResponse({ taskId }));

			/** Act */
			await process(params);

			/** Assert */
			expect(mockLogger.debug).toHaveBeenCalledWith(
				{ trace_id: "mock-trace-id", business_id: businessID, ownerId: mockOwner.id },
				"Enrolling owner in Plaid IDV"
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				{
					trace_id: "mock-trace-id",
					business_id: businessID,
					ownerId: mockOwner.id,
					taskId,
					taskStatus: TASK_STATUS.IN_PROGRESS,
					previousSuccess: false
				},
				"Owner enrollment result"
			);
		});
	});

	describe("partial enrollment success", () => {
		it("should continue enrolling remaining owners when one fails", async () => {
			/** Arrange */
			const mockOwners = [
				createMockOwner({ id: "223e4567-e89b-12d3-a456-426614174001" as UUID }),
				createMockOwner({ id: "323e4567-e89b-12d3-a456-426614174001" as UUID }),
				createMockOwner({ id: "423e4567-e89b-12d3-a456-426614174001" as UUID })
			];
			const metadata: PlaidIdvMetadata = { owners: mockOwners };
			const taskIds = ["523e4567-e89b-12d3-a456-426614174001" as UUID, "623e4567-e89b-12d3-a456-426614174001" as UUID];
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord
				.mockResolvedValueOnce(createMockEnrollmentResponse({ taskId: taskIds[0] }))
				.mockRejectedValueOnce(new Error("Enrollment failed"))
				.mockResolvedValueOnce(createMockEnrollmentResponse({ taskId: taskIds[1] }));

			/** Act */
			const result = await process(params);

			/** Assert */
			expect(result).toEqual(taskIds);
			expect(mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord).toHaveBeenCalledTimes(3);
			expect(mockLogger.error).toHaveBeenCalledWith(
				{
					trace_id: "mock-trace-id",
					business_id: businessID,
					ownerId: "323e4567-e89b-12d3-a456-426614174001",
					error: expect.any(Error)
				},
				"Failed to enroll owner in Plaid IDV: Enrollment failed"
			);
		});

		it("should return task IDs for successful enrollments when some fail", async () => {
			/** Arrange */
			const mockOwners = [
				createMockOwner({ id: "723e4567-e89b-12d3-a456-426614174001" as UUID }),
				createMockOwner({ id: "823e4567-e89b-12d3-a456-426614174001" as UUID })
			];
			const metadata: PlaidIdvMetadata = { owners: mockOwners };
			const taskId = "923e4567-e89b-12d3-a456-426614174001" as UUID;
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord
				.mockResolvedValueOnce(createMockEnrollmentResponse({ taskId }))
				.mockRejectedValueOnce(new Error("Enrollment failed"));

			/** Act */
			const result = await process(params);

			/** Assert */
			expect(result).toEqual([taskId]);
			expect(mockLogger.info).toHaveBeenCalledWith(
				{
					trace_id: "mock-trace-id",
					business_id: businessID,
					connection_id: connectionID,
					totalOwners: 2,
					successful: 1,
					failed: 1
				},
				"Completed Plaid IDV enrollment"
			);
		});
	});

	describe("error cases", () => {
		it("should throw error when platform is not PlaidIdv instance", async () => {
			/** Arrange */
			const mockOwner = createMockOwner();
			const metadata: PlaidIdvMetadata = { owners: [mockOwner] };
			/** Create a plain object that won't pass instanceof check */
			const invalidPlatform = Object.create({
				constructor: { name: "NotPlaidIdv" }
			});
			const params = createParams({ platform: invalidPlatform as unknown as PlaidIdv, metadata });

			/** Act & Assert */
			await expect(process(params)).rejects.toThrow("Expected PlaidIdv platform instance, got NotPlaidIdv");
		});

		it("should throw error when metadata is missing", async () => {
			/** Arrange */
			const params = createParams({ metadata: undefined as unknown as PlaidIdvMetadata });

			/** Act & Assert */
			await expect(process(params)).rejects.toThrow(
				`No valid owners in metadata for Plaid IDV - business ${businessID}`
			);
		});

		it("should throw error when metadata.owners is missing", async () => {
			/** Arrange */
			const metadata = {} as PlaidIdvMetadata;
			const params = createParams({ metadata });

			/** Act & Assert */
			await expect(process(params)).rejects.toThrow(
				`No valid owners in metadata for Plaid IDV - business ${businessID}`
			);
		});

		it("should throw error when metadata.owners is not an array", async () => {
			/** Arrange */
			const metadata = { owners: "not-an-array" } as unknown as PlaidIdvMetadata;
			const params = createParams({ metadata });

			/** Act & Assert */
			await expect(process(params)).rejects.toThrow(
				`No valid owners in metadata for Plaid IDV - business ${businessID}`
			);
		});

		it("should throw error when metadata.owners is empty array", async () => {
			/** Arrange */
			const metadata: PlaidIdvMetadata = { owners: [] };
			const params = createParams({ metadata });

			/** Act & Assert */
			await expect(process(params)).rejects.toThrow(
				`No valid owners in metadata for Plaid IDV - business ${businessID}`
			);
		});

		it("should throw error when all owner enrollments fail", async () => {
			/** Arrange */
			const mockOwners = [
				createMockOwner({ id: "a33e4567-e89b-12d3-a456-426614174001" as UUID }),
				createMockOwner({ id: "b33e4567-e89b-12d3-a456-426614174001" as UUID })
			];
			const metadata: PlaidIdvMetadata = { owners: mockOwners };
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord
				.mockRejectedValueOnce(new Error("Enrollment failed 1"))
				.mockRejectedValueOnce(new Error("Enrollment failed 2"));

			/** Act & Assert */
			await expect(process(params)).rejects.toThrow(
				`Failed to enroll any owners for business ${businessID} in Plaid IDV`
			);

			expect(mockLogger.error).toHaveBeenCalledTimes(2);
		});

		it("should log error details when enrollment throws non-Error object", async () => {
			/** Arrange */
			const mockOwner = createMockOwner();
			const metadata: PlaidIdvMetadata = { owners: [mockOwner] };
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.enrollApplicantOrGetExistingIdvRecord.mockRejectedValue("String error");

			/** Act & Assert */
			await expect(process(params)).rejects.toThrow(
				`Failed to enroll any owners for business ${businessID} in Plaid IDV`
			);

			expect(mockLogger.error).toHaveBeenCalledWith(
				{ trace_id: "mock-trace-id", business_id: businessID, ownerId: mockOwner.id, error: "String error" },
				"Failed to enroll owner in Plaid IDV: Unknown error"
			);
		});

		it("should throw error when PlaidIdv initialization fails", async () => {
			/** Arrange */
			const mockOwner = createMockOwner();
			const metadata: PlaidIdvMetadata = { owners: [mockOwner] };
			const params = createParams({ metadata });
			const mockPlaidIdv = params.platform as jest.Mocked<PlaidIdv>;

			mockPlaidIdv.initializePlaidIdvConnectionConfiguration.mockRejectedValue(
				new Error("Failed to initialize PlaidIdv")
			);

			/** Act & Assert */
			await expect(process(params)).rejects.toThrow("Failed to initialize PlaidIdv");
		});
	});
});
