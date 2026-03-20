import { CASE_STATUS } from "#constants/index";
import { logger } from "#helpers/index";

jest.mock("#helpers/index", () => ({
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	logger: {
		info: jest.fn(),
		error: jest.fn()
	}
}));

import { CaseManager } from "../caseManager";
import { CaseRepository } from "../caseRepository";

jest.mock("../caseRepository");

describe("CaseManager", () => {
	let caseManager: CaseManager;
	let mockCaseRepository: jest.Mocked<CaseRepository>;

	beforeEach(() => {
		jest.clearAllMocks();
		caseManager = new CaseManager();
		mockCaseRepository = (caseManager as any).caseRepository as jest.Mocked<CaseRepository>;
	});

	describe("updateCaseStatus", () => {
		const mockCaseId = "123e4567-e89b-12d3-a456-426614174000";
		const mockUserId = "user-123";

		it("should return previousStatus as string and skipped=false when status is updated successfully", async () => {
			const previousStatusValue = CASE_STATUS.UNDER_MANUAL_REVIEW;

			mockCaseRepository.getCurrentCaseStatus = jest.fn().mockResolvedValue({
				rows: [{ status: previousStatusValue }]
			});
			mockCaseRepository.updateCaseStatusWithHistory = jest.fn().mockResolvedValue(undefined);

			const result = await caseManager.updateCaseStatus(
				{ caseId: mockCaseId, status: CASE_STATUS.SUBMITTED, userId: mockUserId },
				[]
			);

			expect(result).toEqual({
				previousStatus: "UNDER_MANUAL_REVIEW",
				skipped: false
			});
			expect(mockCaseRepository.updateCaseStatusWithHistory).toHaveBeenCalledWith(
				{ caseId: mockCaseId, status: CASE_STATUS.SUBMITTED, userId: mockUserId },
				{ caseId: mockCaseId, status: CASE_STATUS.SUBMITTED, userId: mockUserId }
			);
		});

		it("should return previousStatus as string and skipped=true when current status is in skipStatuses", async () => {
			const previousStatusValue = CASE_STATUS.AUTO_APPROVED;

			mockCaseRepository.getCurrentCaseStatus = jest.fn().mockResolvedValue({
				rows: [{ status: previousStatusValue }]
			});

			const result = await caseManager.updateCaseStatus(
				{ caseId: mockCaseId, status: CASE_STATUS.SUBMITTED, userId: mockUserId },
				[CASE_STATUS.AUTO_APPROVED, CASE_STATUS.AUTO_REJECTED]
			);

			expect(result).toEqual({
				previousStatus: "AUTO_APPROVED",
				skipped: true
			});
			expect(mockCaseRepository.updateCaseStatusWithHistory).not.toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith(`Case with id: ${mockCaseId} is already in AUTO_APPROVED status`);
		});

		it("should use default skipStatuses when not provided", async () => {
			const previousStatusValue = CASE_STATUS.UNDER_MANUAL_REVIEW;

			mockCaseRepository.getCurrentCaseStatus = jest.fn().mockResolvedValue({
				rows: [{ status: previousStatusValue }]
			});

			const result = await caseManager.updateCaseStatus({
				caseId: mockCaseId,
				status: CASE_STATUS.SUBMITTED,
				userId: mockUserId
			});

			expect(result).toEqual({
				previousStatus: "UNDER_MANUAL_REVIEW",
				skipped: true
			});
			expect(mockCaseRepository.updateCaseStatusWithHistory).not.toHaveBeenCalled();
		});

		it("should return undefined previousStatus when case has no status", async () => {
			mockCaseRepository.getCurrentCaseStatus = jest.fn().mockResolvedValue({
				rows: [{}]
			});
			mockCaseRepository.updateCaseStatusWithHistory = jest.fn().mockResolvedValue(undefined);

			const result = await caseManager.updateCaseStatus(
				{ caseId: mockCaseId, status: CASE_STATUS.SUBMITTED, userId: mockUserId },
				[]
			);

			expect(result).toEqual({
				previousStatus: undefined,
				skipped: false
			});
		});

		it("should throw error when repository fails", async () => {
			const error = new Error("Database error");

			mockCaseRepository.getCurrentCaseStatus = jest.fn().mockRejectedValue(error);

			await expect(
				caseManager.updateCaseStatus({ caseId: mockCaseId, status: CASE_STATUS.SUBMITTED, userId: mockUserId }, [])
			).rejects.toThrow("Database error");

			expect(logger.error).toHaveBeenCalled();
		});
	});
});
