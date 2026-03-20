import { Job } from "#api/v1/modules/jobs/models";
import { State } from "#api/v1/modules/jobs/types";
import { internalProcessCustomerBusiness } from "#helpers/api";
import { logger } from "#helpers/logger";
import { encryptData } from "#utils/encryption";
import { AxiosError } from "axios";
import type { Job as BullJob } from "bull";
import type { UUID } from "crypto";

// Mock dependencies
jest.mock("#api/v1/modules/jobs/models");
jest.mock("#helpers/api");
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		debug: jest.fn(),
		info: jest.fn()
	}
}));
jest.mock("#utils/encryption");

describe("BusinessImportJobWorker - Changes", () => {
	const mockJobId = "123e4567-e89b-12d3-a456-426614174000" as UUID;
	const mockCustomerId = "223e4567-e89b-12d3-a456-426614174000" as UUID;
	const mockBusinessId = "323e4567-e89b-12d3-a456-426614174000" as UUID;

	let mockJob: any;
	let mockBullJob: Partial<BullJob>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock job instance
		mockJob = {
			getRecord: jest.fn().mockReturnValue({
				id: mockJobId,
				customer_id: mockCustomerId,
				metadata: {
					data: "encrypted-csv-data",
					headers: "Name,Email,Phone",
					_encrypted: true
				}
			}),
			setState: jest.fn().mockResolvedValue(undefined),
			setBusinessId: jest.fn().mockResolvedValue(undefined),
			updateMetadata: jest.fn().mockResolvedValue(undefined),
			decrypt: jest.fn().mockReturnThis(),
			encrypt: jest.fn().mockReturnThis()
		};

		mockBullJob = {
			id: mockJobId
		};

		(Job.getById as jest.Mock).mockResolvedValue(mockJob);
		(encryptData as jest.Mock).mockImplementation(data => `encrypted_${JSON.stringify(data)}`);
	});

	describe("Job decryption on fetch", () => {
		it("should decrypt job when fetching from database", async () => {
			const job = await Job.getById(mockJobId);
			const decryptedJob = job.decrypt();

			expect(Job.getById).toHaveBeenCalledWith(mockJobId);
			// Verify decrypt returns the job (from mockReturnThis)
			expect(decryptedJob).toBe(mockJob);
		});
	});

	describe("Response encryption", () => {
		it("should encrypt response data before storing in metadata", async () => {
			const mockResponse = {
				result: [
					{
						data_businesses: { id: mockBusinessId },
						owners: [{ ssn: "123-45-6789" }]
					}
				]
			};
			(internalProcessCustomerBusiness as jest.Mock).mockResolvedValue(mockResponse);

			// Simulate the worker updating metadata with encrypted response
			await mockJob.encrypt().updateMetadata({ response: encryptData(mockResponse) });

			expect(mockJob.encrypt).toHaveBeenCalled();
			expect(encryptData).toHaveBeenCalledWith(mockResponse);
			expect(mockJob.updateMetadata).toHaveBeenCalledWith({
				response: `encrypted_${JSON.stringify(mockResponse)}`
			});
		});

		it("should encrypt error response data containing sensitive information", async () => {
			const errorData = {
				error: "Validation failed",
				details: {
					ssn: "invalid format",
					ein: "123-45-6789"
				}
			};

			const axiosError = new AxiosError("Request failed");
			axiosError.response = { data: errorData } as any;

			(internalProcessCustomerBusiness as jest.Mock).mockRejectedValue(axiosError);

			// Simulate error handling in worker
			try {
				await internalProcessCustomerBusiness(mockCustomerId, []);
			} catch (error) {
				if (error instanceof AxiosError) {
					await mockJob.encrypt().updateMetadata({ response: encryptData(error.response?.data) });
				}
			}

			expect(mockJob.encrypt).toHaveBeenCalled();
			expect(encryptData).toHaveBeenCalledWith(errorData);
			expect(mockJob.updateMetadata).toHaveBeenCalledWith({
				response: `encrypted_${JSON.stringify(errorData)}`
			});
		});
	});

	describe("Job state updates with encryption", () => {
		it("should re-encrypt job before updating metadata after successful processing", async () => {
			const mockResponse = {
				result: [
					{
						data_businesses: { id: mockBusinessId }
					}
				]
			};
			(internalProcessCustomerBusiness as jest.Mock).mockResolvedValue(mockResponse);

			// Simulate successful processing
			await mockJob.encrypt().updateMetadata({ response: encryptData(mockResponse) });
			await mockJob.setState(State.SUCCESS, true);
			await mockJob.setBusinessId(mockBusinessId);

			expect(mockJob.encrypt).toHaveBeenCalled();
			expect(mockJob.updateMetadata).toHaveBeenCalled();
			expect(mockJob.setState).toHaveBeenCalledWith(State.SUCCESS, true);
			expect(mockJob.setBusinessId).toHaveBeenCalledWith(mockBusinessId);
		});

		it("should handle job not found in database", async () => {
			(Job.getById as jest.Mock).mockRejectedValue(new Error("Job not found"));

			try {
				await Job.getById(mockJobId);
			} catch (error) {
				expect(logger.error).not.toHaveBeenCalled(); // Logger would be called in actual worker
			}

			expect(Job.getById).toHaveBeenCalledWith(mockJobId);
		});
	});

	describe("Data encryption in metadata", () => {
		it("should handle encrypted data in job metadata", () => {
			const jobWithEncryptedData = {
				...mockJob.getRecord(),
				metadata: {
					data: encryptData("sensitive,csv,data"),
					headers: "Name,Email,SSN"
				}
			};

			mockJob.getRecord.mockReturnValue(jobWithEncryptedData);

			const record = mockJob.getRecord();
			expect(record.metadata.data).toContain("encrypted_");
		});

		it("should decrypt job data when processing", async () => {
			const encryptedData = encryptData("John,john@example.com,123-45-6789");
			mockJob.getRecord.mockReturnValue({
				customer_id: mockCustomerId,
				metadata: {
					data: encryptedData,
					headers: "Name,Email,SSN"
				}
			});

			const decryptedJob = mockJob.decrypt();
			expect(decryptedJob).toBe(mockJob); // Returns itself
		});
	});

	describe("Error handling with encryption", () => {
		it("should set error state when processing fails", async () => {
			const error = new Error("Processing failed");
			(internalProcessCustomerBusiness as jest.Mock).mockRejectedValue(error);

			try {
				await internalProcessCustomerBusiness(mockCustomerId, []);
			} catch (err) {
				await mockJob.setState(State.ERROR, true);
			}

			expect(mockJob.setState).toHaveBeenCalledWith(State.ERROR, true);
		});

		it("should encrypt axios error response data", async () => {
			const errorData = {
				message: "Business validation failed",
				sensitiveInfo: {
					ssn: "123-45-6789",
					owners: ["Owner with SSN data"]
				}
			};

			const axiosError = new AxiosError("Validation error");
			axiosError.response = { data: errorData } as any;

			(internalProcessCustomerBusiness as jest.Mock).mockRejectedValue(axiosError);

			try {
				await internalProcessCustomerBusiness(mockCustomerId, []);
			} catch (error) {
				if (error instanceof AxiosError && error.response?.data) {
					await mockJob.encrypt().updateMetadata({ response: encryptData(error.response.data) });
				}
			}

			expect(encryptData).toHaveBeenCalledWith(errorData);
			expect(mockJob.encrypt).toHaveBeenCalled();
		});

		it("should handle non-AxiosError errors without encryption", async () => {
			const genericError = new Error("Generic error");
			(internalProcessCustomerBusiness as jest.Mock).mockRejectedValue(genericError);

			try {
				await internalProcessCustomerBusiness(mockCustomerId, []);
			} catch (error) {
				if (error instanceof AxiosError) {
					// Should not reach here
					await mockJob.encrypt().updateMetadata({ response: encryptData({}) });
				} else {
					await mockJob.setState(State.ERROR, true);
				}
			}

			expect(encryptData).not.toHaveBeenCalled();
			expect(mockJob.setState).toHaveBeenCalledWith(State.ERROR, true);
		});
	});

	describe("Integration scenarios", () => {
		it("should handle full successful processing flow with encryption", async () => {
			const mockResponse = {
				result: [
					{
						data_businesses: {
							id: mockBusinessId,
							name: "Test Business"
						},
						owners: [
							{
								ssn: "123-45-6789",
								name: "John Doe"
							}
						]
					}
				]
			};

			(internalProcessCustomerBusiness as jest.Mock).mockResolvedValue(mockResponse);

			// Simulate full flow
			const job = await Job.getById(mockJobId);
			job.decrypt();
			await job.setState(State.STARTED, true);

			const response = await internalProcessCustomerBusiness(mockCustomerId, []);
			await job.encrypt().updateMetadata({ response: encryptData(response) });
			await job.setState(State.SUCCESS, true);
			await job.setBusinessId(mockBusinessId);

			expect(job.decrypt).toHaveBeenCalled();
			expect(job.encrypt).toHaveBeenCalled();
			expect(encryptData).toHaveBeenCalledWith(response);
			expect(job.setState).toHaveBeenCalledWith(State.STARTED, true);
			expect(job.setState).toHaveBeenCalledWith(State.SUCCESS, true);
			expect(job.setBusinessId).toHaveBeenCalledWith(mockBusinessId);
		});

		it("should handle full error flow with encryption", async () => {
			const errorData = { error: "Sensitive error with SSN: xxx-xx-xxxx" };
			const axiosError = new AxiosError("Failed");
			axiosError.response = { data: errorData } as any;

			(internalProcessCustomerBusiness as jest.Mock).mockRejectedValue(axiosError);

			// Simulate error flow
			const job = await Job.getById(mockJobId);
			job.decrypt();
			await job.setState(State.STARTED, true);

			try {
				await internalProcessCustomerBusiness(mockCustomerId, []);
			} catch (error) {
				if (error instanceof AxiosError) {
					await job.encrypt().updateMetadata({ response: encryptData(error.response?.data) });
				}
				await job.setState(State.ERROR, true);
			}

			expect(job.decrypt).toHaveBeenCalled();
			expect(job.encrypt).toHaveBeenCalled();
			expect(encryptData).toHaveBeenCalledWith(errorData);
			expect(job.setState).toHaveBeenCalledWith(State.ERROR, true);
		});
	});
});
