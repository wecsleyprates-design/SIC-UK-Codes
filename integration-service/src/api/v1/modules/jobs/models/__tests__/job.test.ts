import { Job } from "../job";
import { State } from "../../types";
import { encryptData, decryptData } from "#utils";
import type { IJob } from "../../types";
import type { Stored } from "#types/eggPattern";
import type { UUID } from "crypto";

// Mock dependencies
jest.mock("#utils", () => ({
	encryptData: jest.fn(data => `encrypted_${JSON.stringify(data)}`),
	decryptData: jest.fn(data => JSON.parse(data.replace("encrypted_", "")))
}));

jest.mock("#helpers/knex", () => {
	const mockDb = jest.fn() as any;
	mockDb.raw = jest.fn();
	return { db: mockDb };
});

describe("Job Model - Encryption/Decryption", () => {
	const mockJobRecord = {
		id: "123e4567-e89b-12d3-a456-426614174000" as UUID,
		request_id: "223e4567-e89b-12d3-a456-426614174000" as UUID,
		customer_id: "323e4567-e89b-12d3-a456-426614174000" as UUID,
		state: State.CREATED,
		metadata: {
			data: "sensitive data",
			response: "api response",
			_encrypted: false
		},
		created_at: new Date(),
		business_id: null,
		started_at: null,
		completed_at: null,
		errored_at: null
	} as Stored<IJob>;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("encrypt()", () => {
		it("should encrypt metadata.data when not already encrypted", () => {
			const job = new Job(mockJobRecord);

			const encryptedJob = job.encrypt();

			expect(encryptData).toHaveBeenCalledWith("sensitive data");
			expect(encryptedJob.getRecord().metadata?._encrypted).toBe(true);
			expect(encryptedJob.getRecord().metadata?.data).toBe('encrypted_"sensitive data"');
		});

		it("should encrypt metadata.response when not already encrypted", () => {
			const job = new Job(mockJobRecord);

			const encryptedJob = job.encrypt();

			expect(encryptData).toHaveBeenCalledWith("api response");
			expect(encryptedJob.getRecord().metadata?.response).toBe('encrypted_"api response"');
		});

		it("should not encrypt if already encrypted", () => {
			const encryptedRecord = {
				...mockJobRecord,
				metadata: { ...mockJobRecord.metadata, _encrypted: true }
			};
			const job = new Job(encryptedRecord);

			const encryptedJob = job.encrypt();

			expect(encryptData).not.toHaveBeenCalled();
			expect(encryptedJob.getRecord().metadata?._encrypted).toBe(true);
		});

		it("should handle job without metadata", () => {
			const jobWithoutMetadata: Stored<IJob> = {
				...mockJobRecord,
				metadata: undefined
			};
			const job = new Job(jobWithoutMetadata);

			const encryptedJob = job.encrypt();

			expect(encryptData).not.toHaveBeenCalled();
			expect(encryptedJob.getRecord().metadata?._encrypted).toBe(true);
		});

		it("should only encrypt metadata.data if metadata.response is missing", () => {
			const jobWithOnlyData: Stored<IJob> = {
				...mockJobRecord,
				metadata: { data: "only data", _encrypted: false }
			};
			const job = new Job(jobWithOnlyData);

			void job.encrypt();

			expect(encryptData).toHaveBeenCalledWith("only data");
			expect(encryptData).toHaveBeenCalledTimes(1);
		});
	});

	describe("decrypt()", () => {
		it("should decrypt metadata.data when encrypted", () => {
			const encryptedJobRecord: Stored<IJob> = {
				...mockJobRecord,
				metadata: {
					data: 'encrypted_"sensitive data"',
					response: 'encrypted_"api response"',
					_encrypted: true
				}
			};
			const job = new Job(encryptedJobRecord);

			const decryptedJob = job.decrypt();

			expect(decryptData).toHaveBeenCalledWith('encrypted_"sensitive data"');
			expect(decryptedJob.getRecord().metadata?._encrypted).toBe(false);
			expect(decryptedJob.getRecord().metadata?.data).toBe("sensitive data");
		});

		it("should decrypt metadata.response when encrypted", () => {
			const encryptedJobRecord: Stored<IJob> = {
				...mockJobRecord,
				metadata: {
					data: 'encrypted_"sensitive data"',
					response: 'encrypted_"api response"',
					_encrypted: true
				}
			};
			const job = new Job(encryptedJobRecord);

			const decryptedJob = job.decrypt();

			expect(decryptData).toHaveBeenCalledWith('encrypted_"api response"');
			expect(decryptedJob.getRecord().metadata?.response).toBe("api response");
		});

		it("should not decrypt if already decrypted", () => {
			const job = new Job(mockJobRecord);

			const decryptedJob = job.decrypt();

			expect(decryptData).not.toHaveBeenCalled();
			expect(decryptedJob.getRecord().metadata?._encrypted).toBe(false);
		});
	});

	describe("transformMetadata", () => {
		it("should not modify metadata fields other than data and response", () => {
			const jobWithExtraFields: Stored<IJob> = {
				...mockJobRecord,
				metadata: {
					data: "sensitive",
					response: "result",
					otherField: "should not change",
					nestedField: { value: "unchanged" },
					_encrypted: false
				}
			};
			const job = new Job(jobWithExtraFields);

			const encryptedJob = job.encrypt();

			expect((encryptedJob.getRecord().metadata as any)?.otherField).toBe("should not change");
			expect((encryptedJob.getRecord().metadata as any)?.nestedField).toEqual({ value: "unchanged" });
		});

		it("should create a new Job instance without mutating the original", () => {
			const job = new Job(mockJobRecord);
			const originalData = job.getRecord().metadata?.data;

			const encryptedJob = job.encrypt();

			// Original job should not be mutated
			expect(job.getRecord().metadata?.data).toBe(originalData);
			// Encrypted job should have different data
			expect(encryptedJob.getRecord().metadata?.data).not.toBe(originalData);
		});
	});
});
