import type { UUID } from "crypto";
import type * as Verdata from "../types";

let mockDbQueryBuilder: jest.Mock;
let mockDbRaw: jest.Mock;
let mockGetEnrichedTask: jest.Mock;
let mockUpdateTaskStatus: jest.Mock;
let mockGetRequestResponseByTaskId: jest.Mock;
let mockSaveTaskRequestResponse: jest.Mock;
let mockPrepareIntegrationDataForScore: jest.Mock;

jest.mock("#helpers/knex", () => {
	const mockReturning = jest.fn();
	const mockUpdate = jest.fn().mockReturnValue({ returning: mockReturning });

	const builderMethods: Record<string, jest.Mock> = {};

	const mockAndWhere = jest.fn().mockImplementation(function (this: typeof builderMethods) {
		return this;
	});
	const mockWhere = jest.fn().mockImplementation(function (this: typeof builderMethods) {
		return this;
	});
	const mockWhereNull = jest.fn().mockImplementation(function (this: typeof builderMethods) {
		return this;
	});
	const mockOrWhereRaw = jest.fn().mockImplementation(function (this: typeof builderMethods) {
		return this;
	});

	builderMethods.where = mockWhere;
	builderMethods.andWhere = mockAndWhere;
	builderMethods.whereNull = mockWhereNull;
	builderMethods.orWhereRaw = mockOrWhereRaw;
	builderMethods.update = mockUpdate;
	builderMethods.returning = mockReturning;

	mockWhere.mockReturnValue(builderMethods);
	mockAndWhere.mockImplementation(function (arg) {
		if (typeof arg === "function") {
			arg.call(builderMethods);
		}
		return builderMethods;
	});
	mockWhereNull.mockReturnValue(builderMethods);
	mockOrWhereRaw.mockReturnValue(builderMethods);

	const mockQueryBuilder = jest.fn().mockReturnValue(builderMethods) as jest.Mock & { raw: jest.Mock };
	const mockRawFn = jest.fn().mockImplementation(sql => sql);

	mockQueryBuilder.raw = mockRawFn;

	return {
		db: mockQueryBuilder,
		__getMockQueryBuilder: () => mockQueryBuilder,
		__getMockReturning: () => mockReturning,
		__getMockDbRaw: () => mockRawFn
	};
});

jest.mock("#configs", () => ({
	envConfig: {
		VERDATA_CALLBACK_SECRET: "test-secret",
		SERVICE_MODE: "API",
		REDIS_HOST: "localhost",
		REDIS_PORT: 6379
	}
}));

jest.mock("#configs/index", () => ({
	envConfig: {
		VERDATA_CALLBACK_SECRET: "test-secret",
		SERVICE_MODE: "API"
	}
}));

jest.mock("#helpers", () => {
	const knexMock = jest.requireMock("#helpers/knex") as { db: jest.Mock & { raw: jest.Mock } };
	return {
		db: knexMock.db,
		logger: {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			child: jest.fn().mockReturnThis()
		},
		producer: {
			send: jest.fn().mockResolvedValue(undefined)
		}
	};
});

jest.mock("#helpers/index", () => {
	const knexMock = jest.requireMock("#helpers/knex") as { db: jest.Mock & { raw: jest.Mock } };
	return {
		db: knexMock.db,
		logger: {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			debug: jest.fn(),
			child: jest.fn().mockReturnThis()
		},
		producer: {
			send: jest.fn().mockResolvedValue(undefined)
		}
	};
});

jest.mock("#constants", () => ({
	DIRECTORIES: { PUBLIC_RECORDS: "public_records" },
	EVENTS: { FETCH_PUBLIC_RECORDS: "FETCH_PUBLIC_RECORDS" },
	INTEGRATION_ID: { VERDATA: 4, PLAID: 1 },
	QUEUES: { VERDATA: "verdata" },
	TASK_STATUS: {
		SUCCESS: "SUCCESS",
		IN_PROGRESS: "IN_PROGRESS",
		FAILED: "FAILED",
		INITIALIZED: "INITIALIZED"
	},
	kafkaEvents: { INTEGRATION_DATA_READY: "INTEGRATION_DATA_READY" },
	kafkaTopics: { BUSINESS: "business", SCORES: "scores" },
	SERVICE_MODES: { API: "API", JOB: "JOB", ALL: "ALL" },
	IDV_STATUS: {
		SUCCESS: 1,
		PENDING: 2,
		CANCELED: 3,
		FAILED: 4,
		EXPIRED: 5
	},
	CONNECTION_STATUS: {
		ACTIVE: "active",
		INACTIVE: "inactive"
	},
	GIACT_VERIFICATION_STATUS: {},
	GIACT_VERIFICATION_TYPE: {},
	PUBLIC_RECORDS_TYPES: {}
}));

jest.mock("#helpers/bull-queue", () => {
	return jest.fn().mockImplementation(() => ({
		addJob: jest.fn().mockResolvedValue({ id: "mock-job-id" })
	}));
});

jest.mock("#common/index", () => {
	const mock = jest.fn();
	return {
		updateTask: jest.fn(),
		uploadRawIntegrationDataToS3: jest.fn().mockResolvedValue(undefined),
		prepareIntegrationDataForScore: mock,
		__getMockPrepareIntegrationDataForScore: () => mock
	};
});

jest.mock("#helpers/businessLookupHelper", () => jest.fn());

jest.mock("#helpers/platformHelper", () => ({
	getConnectionById: jest.fn().mockResolvedValue({
		id: "mock-connection-id",
		business_id: "mock-business-id",
		platform_id: 4
	}),
	getConnectionForBusinessAndPlatform: jest.fn(),
	platformFactory: jest.fn()
}));

jest.mock("../verdata", () => {
	const mockGetEnriched = jest.fn();
	const mockUpdateStatus = jest.fn();
	const mockGetReqRes = jest.fn();
	const mockSaveReqRes = jest.fn();

	return {
		Verdata: Object.assign(
			jest.fn().mockImplementation(() => ({
				updateTaskStatus: mockUpdateStatus,
				getRequestResponseByTaskId: mockGetReqRes,
				saveTaskRequestResponse: mockSaveReqRes
			})),
			{
				getEnrichedTask: mockGetEnriched
			}
		),
		__getMocks: () => ({
			getEnrichedTask: mockGetEnriched,
			updateTaskStatus: mockUpdateStatus,
			getRequestResponseByTaskId: mockGetReqRes,
			saveTaskRequestResponse: mockSaveReqRes
		})
	};
});

import { VerdataUtil } from "../verdataUtil";

const knexModule = jest.requireMock("#helpers/knex") as {
	__getMockQueryBuilder: () => jest.Mock;
	__getMockReturning: () => jest.Mock;
	__getMockDbRaw: () => jest.Mock;
};
const commonModule = jest.requireMock("#common/index") as { __getMockPrepareIntegrationDataForScore: () => jest.Mock };
const verdataModule = jest.requireMock("../verdata") as {
	__getMocks: () => {
		getEnrichedTask: jest.Mock;
		updateTaskStatus: jest.Mock;
		getRequestResponseByTaskId: jest.Mock;
		saveTaskRequestResponse: jest.Mock;
	};
};

let mockReturning: jest.Mock;

describe("VerdataUtil.handleVerdataWebhook - Atomic Claim Logic", () => {
	const mockTaskId = "b7124d87-bfec-46c1-92b3-0d40a4a8636c" as UUID;
	const mockBusinessId = "1e3a2bdd-f569-430e-85c0-0f065c41ae8a" as UUID;
	const mockConnectionId = "c1234567-89ab-cdef-0123-456789abcdef" as UUID;

	const mockQuery = {
		task_id: mockTaskId,
		business_id: mockBusinessId
	};

	const mockBody = {
		seller_id: "seller-123",
		feature_store: [],
		ThirdPartyData: []
	} as unknown as Verdata.Record;

	const mockEnrichedTask = {
		id: mockTaskId,
		connection_id: mockConnectionId,
		business_id: mockBusinessId,
		task_status: "IN_PROGRESS",
		platform_id: 4,
		trigger_type: "ONBOARDING_INVITE"
	};

	beforeAll(() => {
		mockDbQueryBuilder = knexModule.__getMockQueryBuilder();
		mockReturning = knexModule.__getMockReturning();
		mockDbRaw = knexModule.__getMockDbRaw();
		mockPrepareIntegrationDataForScore = commonModule.__getMockPrepareIntegrationDataForScore();
		const verdataMocks = verdataModule.__getMocks();
		mockGetEnrichedTask = verdataMocks.getEnrichedTask;
		mockUpdateTaskStatus = verdataMocks.updateTaskStatus;
		mockGetRequestResponseByTaskId = verdataMocks.getRequestResponseByTaskId;
		mockSaveTaskRequestResponse = verdataMocks.saveTaskRequestResponse;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockUpdateTaskStatus.mockResolvedValue(undefined);
		mockGetRequestResponseByTaskId.mockResolvedValue(null);
		mockSaveTaskRequestResponse.mockResolvedValue(undefined);
		mockPrepareIntegrationDataForScore.mockResolvedValue(undefined);

		jest.spyOn(VerdataUtil, "upsertRecord").mockResolvedValue({} as any);
	});

	describe("Atomic Claim Query Structure", () => {
		it("should execute atomic UPDATE with correct Knex query builder for race condition prevention", async () => {
			mockReturning.mockResolvedValueOnce([{ id: mockTaskId, connection_id: mockConnectionId }]);
			mockGetEnrichedTask.mockResolvedValue(mockEnrichedTask);

			await VerdataUtil.handleVerdataWebhook(mockBody, mockQuery);

			expect(mockDbQueryBuilder).toHaveBeenCalledWith("integrations.data_business_integrations_tasks");

			expect(mockDbRaw).toHaveBeenCalledWith(
				"COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object('webhook_claimed_at', to_jsonb(now()::text))"
			);
		});
	});

	describe("Claim Success/Failure Handling", () => {
		it("should process webhook when claim succeeds (rows returned)", async () => {
			mockReturning.mockResolvedValueOnce([{ id: mockTaskId, connection_id: mockConnectionId }]);
			mockGetEnrichedTask.mockResolvedValue(mockEnrichedTask);

			await VerdataUtil.handleVerdataWebhook(mockBody, mockQuery);

			expect(mockGetEnrichedTask).toHaveBeenCalledWith(mockTaskId);

			expect(mockUpdateTaskStatus).toHaveBeenCalled();
		});

		it("should skip processing when claim fails (no rows - already claimed)", async () => {
			mockReturning.mockResolvedValueOnce([]);

			await VerdataUtil.handleVerdataWebhook(mockBody, mockQuery);

			expect(mockGetEnrichedTask).not.toHaveBeenCalled();
			expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
		});

		it("should skip processing when claim fails (no rows - task SUCCESS)", async () => {
			mockReturning.mockResolvedValueOnce([]);

			await VerdataUtil.handleVerdataWebhook(mockBody, mockQuery);

			expect(mockGetEnrichedTask).not.toHaveBeenCalled();
			expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
		});
	});

	describe("Race Condition Prevention", () => {
		it("should only process first webhook when multiple arrive for same task", async () => {
			mockReturning.mockResolvedValueOnce([{ id: mockTaskId, connection_id: mockConnectionId }]);
			mockGetEnrichedTask.mockResolvedValue(mockEnrichedTask);

			await VerdataUtil.handleVerdataWebhook(mockBody, mockQuery);
			expect(mockUpdateTaskStatus).toHaveBeenCalledTimes(1);

			mockUpdateTaskStatus.mockClear();
			mockReturning.mockResolvedValueOnce([]);

			await VerdataUtil.handleVerdataWebhook(mockBody, mockQuery);
			expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
		});

		it("should prevent duplicate score calculations", async () => {
			mockReturning.mockResolvedValueOnce([{ id: mockTaskId, connection_id: mockConnectionId }]);
			mockGetEnrichedTask.mockResolvedValue(mockEnrichedTask);

			await VerdataUtil.handleVerdataWebhook(mockBody, mockQuery);
			expect(mockPrepareIntegrationDataForScore).toHaveBeenCalledTimes(1);

			mockReturning.mockResolvedValueOnce([]);

			await VerdataUtil.handleVerdataWebhook(mockBody, mockQuery);
			expect(mockPrepareIntegrationDataForScore).toHaveBeenCalledTimes(1);
		});
	});

	describe("Edge Cases", () => {
		it("should return early when task_id is missing", async () => {
			await VerdataUtil.handleVerdataWebhook(mockBody, { business_id: mockBusinessId });

			expect(mockDbQueryBuilder).not.toHaveBeenCalled();
		});

		it("should return early when task_id is 'undefined' string", async () => {
			await VerdataUtil.handleVerdataWebhook(mockBody, {
				task_id: "undefined",
				business_id: mockBusinessId
			});

			expect(mockDbQueryBuilder).not.toHaveBeenCalled();
		});

		it("should handle database errors gracefully", async () => {
			mockReturning.mockRejectedValueOnce(new Error("Database error"));

			await expect(VerdataUtil.handleVerdataWebhook(mockBody, mockQuery)).resolves.not.toThrow();
		});
	});
});
