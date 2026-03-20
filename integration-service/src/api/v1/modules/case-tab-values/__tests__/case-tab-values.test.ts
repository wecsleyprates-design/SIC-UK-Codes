/**
 * Unit tests for GET /business/:businessId/case/:caseId/values (case tab values endpoint).
 */

import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { CaseTabValuesResult } from "#core/case-tab-values/types";

// catchAsync does not return the promise; mock it so we can await the handler in tests
jest.mock("#utils/catchAsync", () => ({
	catchAsync:
		(fn: (req: unknown, res: unknown, next: unknown) => Promise<unknown>) =>
		(req: unknown, res: unknown, next: unknown) =>
			Promise.resolve(fn(req, res, next)).catch((err: unknown) => (next as (err: unknown) => void)(err)),
}));
jest.mock("#core/case-tab-values", () => ({
	getCaseTabValues: jest.fn(),
}));
jest.mock("#core/case-tab-values/mappers", () => ({
	toApiResponse: jest.fn(),
}));
jest.mock("#api/v1/modules/tasks/taskManager", () => ({
	TaskManager: {
		getLatestTaskForBusiness: jest.fn(),
	},
}));
jest.mock("#common/common-new", () => ({
	fetchIntegrationTasks: jest.fn(),
}));

import { controller } from "../controller";
import { getCaseTabValues } from "#core/case-tab-values";
import { toApiResponse } from "#core/case-tab-values/mappers";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { fetchIntegrationTasks } from "#common/common-new";

const mockGetCaseTabValues = getCaseTabValues as jest.MockedFunction<typeof getCaseTabValues>;
const mockToApiResponse = toApiResponse as jest.MockedFunction<typeof toApiResponse>;
const mockGetLatestTaskForBusiness = TaskManager.getLatestTaskForBusiness as jest.MockedFunction<
	typeof TaskManager.getLatestTaskForBusiness
>;
const mockFetchIntegrationTasks = fetchIntegrationTasks as jest.MockedFunction<
	typeof fetchIntegrationTasks
>;

function createMockDomain(): CaseTabValuesResult {
	return {
		values: {
			tin_business_registration: { value: "12-3456789", description: null },
			idv_verification: { value: "verified", description: "IDV passed.", status: "passed" },
		},
		created_at: "2026-02-18T12:00:00.000Z",
		updated_at: "2026-02-18T12:00:00.000Z",
		has_updates_since_generated: false,
		updates_count: 0,
	};
}

function createMockRequest(overrides?: Partial<Request>): Partial<Request> {
	const businessId = randomUUID();
	const caseId = randomUUID();
	return {
		params: { businessId, caseId },
		...overrides,
	};
}

function createMockResponse(): Partial<Response> {
	const res: Partial<Response> = {
		locals: {} as Response["locals"],
	};
	return res;
}

describe("Case tab values controller", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getCaseTabValues", () => {
		it("calls getCaseTabValues with businessId, caseId, and task IDs when both task fetches succeed", async () => {
			const businessId = randomUUID();
			const caseId = randomUUID();
			const verdataTaskId = randomUUID();
			const adverseTaskId = randomUUID();

			mockGetLatestTaskForBusiness.mockResolvedValue({ id: verdataTaskId } as any);
			mockFetchIntegrationTasks.mockResolvedValue([{ id: adverseTaskId }] as any);
			const domain = createMockDomain();
			mockGetCaseTabValues.mockResolvedValue(domain);
			const apiResponse = { values: {}, created_at: null, has_updates_since_generated: false, updates_count: 0 };
			mockToApiResponse.mockReturnValue(apiResponse as any);

			const req = createMockRequest({ params: { businessId, caseId } }) as Request;
			const res = createMockResponse() as Response;
			const next = jest.fn() as NextFunction;

			await (controller.getCaseTabValues as any)(req, res, next);

			expect(mockGetCaseTabValues).toHaveBeenCalledTimes(1);
			expect(mockGetCaseTabValues).toHaveBeenCalledWith({
				businessId,
				caseId,
				verdataTaskId,
				adverseMediaTaskIds: [adverseTaskId],
			});
			expect(mockToApiResponse).toHaveBeenCalledWith(domain);
			expect(res.locals.cacheOutput).toEqual({
				data: apiResponse,
				message: "Case tab values fetched successfully",
			});
			expect(next).toHaveBeenCalledTimes(1);
		});

		it("calls getCaseTabValues with null task IDs when task fetches fail or return nothing", async () => {
			const businessId = randomUUID();
			const caseId = randomUUID();

			mockGetLatestTaskForBusiness.mockRejectedValue(new Error("DB error"));
			mockFetchIntegrationTasks.mockResolvedValue([]);
			const domain = createMockDomain();
			mockGetCaseTabValues.mockResolvedValue(domain);
			mockToApiResponse.mockReturnValue({ values: {} } as any);

			const req = createMockRequest({ params: { businessId, caseId } }) as Request;
			const res = createMockResponse() as Response;
			const next = jest.fn() as NextFunction;

			await (controller.getCaseTabValues as any)(req, res, next);

			expect(mockGetCaseTabValues).toHaveBeenCalledWith({
				businessId,
				caseId,
				verdataTaskId: null,
				adverseMediaTaskIds: null,
			});
			expect(res.locals.cacheOutput).toBeDefined();
			expect(next).toHaveBeenCalled();
		});

		it("passes null adverseMediaTaskIds when fetch returns empty array", async () => {
			const businessId = randomUUID();
			const caseId = randomUUID();
			const verdataTaskId = randomUUID();

			mockGetLatestTaskForBusiness.mockResolvedValue({ id: verdataTaskId } as any);
			mockFetchIntegrationTasks.mockResolvedValue([]);
			mockGetCaseTabValues.mockResolvedValue(createMockDomain());
			mockToApiResponse.mockReturnValue({ values: {} } as any);

			const req = createMockRequest({ params: { businessId, caseId } }) as Request;
			const res = createMockResponse() as Response;
			const next = jest.fn() as NextFunction;

			await (controller.getCaseTabValues as any)(req, res, next);

			expect(mockGetCaseTabValues).toHaveBeenCalledWith(
				expect.objectContaining({
					adverseMediaTaskIds: null,
				})
			);
		});

		it("maps domain to API response with values, created_at, has_updates_since_generated, updates_count", async () => {
			const domain = createMockDomain();
			mockGetLatestTaskForBusiness.mockResolvedValue(null as any);
			mockFetchIntegrationTasks.mockResolvedValue([]);
			mockGetCaseTabValues.mockResolvedValue(domain);
			const expectedApi = {
				values: { tin_business_registration: { value: "12-3456789" } },
				created_at: domain.created_at,
				has_updates_since_generated: false,
				updates_count: 0,
			};
			mockToApiResponse.mockReturnValue(expectedApi as any);

			const req = createMockRequest() as Request;
			const res = createMockResponse() as Response;
			const next = jest.fn() as NextFunction;

			await (controller.getCaseTabValues as any)(req, res, next);

			expect(mockToApiResponse).toHaveBeenCalledWith(domain);
			expect(res.locals.cacheOutput?.data).toEqual(expectedApi);
		});
	});
});
