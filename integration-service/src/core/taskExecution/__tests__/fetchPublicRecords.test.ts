import { fetchPublicRecords } from "../fetchPublicRecords";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import type { UUID } from "crypto";

jest.mock("#api/v1/modules/tasks/task", () => ({
	Task: {
		fromId: jest.fn()
	}
}));

jest.mock("#lib/entityMatching/entityMatching", () => ({
	EntityMatching: {
		isEnabled: jest.fn()
	}
}));

jest.mock("#helpers", () => {
	const actual = jest.requireActual("#helpers");
	return {
		...actual,
		updateConnectionByConnectionId: jest.fn().mockResolvedValue(undefined)
	};
});

const Task = jest.requireMock("#api/v1/modules/tasks/task").Task as { fromId: jest.Mock };
const EntityMatching = jest.requireMock("#lib/entityMatching/entityMatching").EntityMatching as {
	isEnabled: jest.Mock;
};
const updateConnectionByConnectionId = jest.requireMock("#helpers").updateConnectionByConnectionId as jest.Mock;

const createMockTask = (overrides: Partial<IBusinessIntegrationTaskEnriched> = {}): IBusinessIntegrationTaskEnriched =>
	({
		id: "00000000-0000-0000-0000-000000000001" as UUID,
		connection_id: "00000000-0000-0000-0000-000000000002" as UUID,
		business_id: "00000000-0000-0000-0000-000000000003" as UUID,
		platform_id: INTEGRATION_ID.EQUIFAX,
		platform_code: "equifax",
		task_code: "fetch_public_records",
		task_status: "CREATED",
		created_at: "2025-01-01T00:00:00.000Z",
		updated_at: "2025-01-01T00:00:00.000Z",
		...overrides
	}) as IBusinessIntegrationTaskEnriched;

const createMockConnection = (overrides: Partial<IDBConnection> = {}): IDBConnection =>
	({
		id: "00000000-0000-0000-0000-000000000002" as UUID,
		business_id: "00000000-0000-0000-0000-000000000003" as UUID,
		platform_id: INTEGRATION_ID.EQUIFAX,
		connection_status: CONNECTION_STATUS.SUCCESS,
		created_at: "2025-01-01T00:00:00.000Z",
		updated_at: "2025-01-01T00:00:00.000Z",
		...overrides
	}) as IDBConnection;

describe("fetchPublicRecords", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should update connection to SUCCESS when platform is VERDATA and status is not SUCCESS", async () => {
		EntityMatching.isEnabled.mockResolvedValue(false);
		Task.fromId.mockResolvedValue({ process: jest.fn().mockResolvedValue(undefined) });

		const connection = createMockConnection({
			platform_id: INTEGRATION_ID.VERDATA,
			connection_status: CONNECTION_STATUS.CREATED
		});
		const task = createMockTask();

		await fetchPublicRecords(connection, task);

		expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
			connection.id,
			CONNECTION_STATUS.SUCCESS,
			{}
		);
	});

	it("should not call updateConnectionByConnectionId when platform is not VERDATA", async () => {
		EntityMatching.isEnabled.mockResolvedValue(false);
		Task.fromId.mockResolvedValue({ process: jest.fn().mockResolvedValue(undefined) });

		const connection = createMockConnection({ platform_id: INTEGRATION_ID.EQUIFAX });
		const task = createMockTask();

		await fetchPublicRecords(connection, task);

		expect(updateConnectionByConnectionId).not.toHaveBeenCalled();
	});

	it("should return early without calling Task when EntityMatching.isEnabled is true", async () => {
		EntityMatching.isEnabled.mockResolvedValue(true);

		const connection = createMockConnection();
		const task = createMockTask();

		await fetchPublicRecords(connection, task);

		expect(EntityMatching.isEnabled).toHaveBeenCalledWith(connection.platform_id);
		expect(Task.fromId).not.toHaveBeenCalled();
	});

	it("should call Task.fromId and process when EntityMatching.isEnabled is false", async () => {
		const processFn = jest.fn().mockResolvedValue(undefined);
		EntityMatching.isEnabled.mockResolvedValue(false);
		Task.fromId.mockResolvedValue({ process: processFn });

		const connection = createMockConnection();
		const task = createMockTask();

		await fetchPublicRecords(connection, task);

		expect(Task.fromId).toHaveBeenCalledWith(task.id);
		expect(processFn).toHaveBeenCalled();
	});

	it("should not throw when process throws (error is logged)", async () => {
		EntityMatching.isEnabled.mockResolvedValue(false);
		Task.fromId.mockResolvedValue({ process: jest.fn().mockRejectedValue(new Error("process failed")) });

		const connection = createMockConnection();
		const task = createMockTask();

		await expect(fetchPublicRecords(connection, task)).resolves.not.toThrow();
	});
});
