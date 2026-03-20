import { fetchAccounting } from "../fetchAccounting";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import type { UUID } from "crypto";

jest.mock("#api/v1/modules/tasks/task", () => ({
	Task: {
		fromId: jest.fn()
	}
}));

jest.mock("#helpers", () => {
	const actual = jest.requireActual("#helpers");
	return {
		...actual,
		platformFactory: jest.fn()
	};
});

const Task = jest.requireMock("#api/v1/modules/tasks/task").Task as { fromId: jest.Mock };
const platformFactory = jest.requireMock("#helpers").platformFactory as jest.Mock;

const createMockTask = (overrides: Partial<IBusinessIntegrationTaskEnriched> = {}): IBusinessIntegrationTaskEnriched =>
	({
		id: "00000000-0000-0000-0000-000000000001" as UUID,
		connection_id: "00000000-0000-0000-0000-000000000002" as UUID,
		business_id: "00000000-0000-0000-0000-000000000003" as UUID,
		platform_id: INTEGRATION_ID.RUTTER_QUICKBOOKS,
		platform_code: "rutter_quickbooks",
		task_code: "fetch_balance_sheet",
		task_status: "CREATED",
		created_at: "2025-01-01T00:00:00.000Z",
		updated_at: "2025-01-01T00:00:00.000Z",
		...overrides
	}) as IBusinessIntegrationTaskEnriched;

const createMockConnection = (overrides: Partial<IDBConnection> = {}): IDBConnection =>
	({
		id: "00000000-0000-0000-0000-000000000002" as UUID,
		business_id: "00000000-0000-0000-0000-000000000003" as UUID,
		platform_id: INTEGRATION_ID.RUTTER_QUICKBOOKS,
		connection_status: CONNECTION_STATUS.SUCCESS,
		created_at: "2025-01-01T00:00:00.000Z",
		updated_at: "2025-01-01T00:00:00.000Z",
		...overrides
	}) as IDBConnection;

describe("fetchAccounting", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should call platformFactory and processTask when platform is MANUAL_ACCOUNTING", async () => {
		const processTask = jest.fn().mockResolvedValue(undefined);
		platformFactory.mockReturnValue({ processTask });

		const connection = createMockConnection({ platform_id: INTEGRATION_ID.MANUAL_ACCOUNTING });
		const task = createMockTask();

		await fetchAccounting(connection, task);

		expect(platformFactory).toHaveBeenCalledWith({ dbConnection: connection });
		expect(processTask).toHaveBeenCalledWith({ taskId: task.id });
		expect(Task.fromId).not.toHaveBeenCalled();
	});

	it("should call Task.fromId and process when platform is not MANUAL_ACCOUNTING and not QuickBooks (2) and status is SUCCESS", async () => {
		const processFn = jest.fn().mockResolvedValue(undefined);
		Task.fromId.mockResolvedValue({ process: processFn });

		const connection = createMockConnection({
			platform_id: INTEGRATION_ID.RUTTER_QUICKBOOKS,
			connection_status: CONNECTION_STATUS.SUCCESS
		});
		const task = createMockTask();

		await fetchAccounting(connection, task);

		expect(Task.fromId).toHaveBeenCalledWith(task.id);
		expect(processFn).toHaveBeenCalled();
	});

	it("should not call Task.fromId when connection status is CREATED (platform not 2)", async () => {
		const connection = createMockConnection({
			platform_id: INTEGRATION_ID.RUTTER_XERO,
			connection_status: CONNECTION_STATUS.CREATED
		});
		const task = createMockTask();

		await fetchAccounting(connection, task);

		expect(Task.fromId).not.toHaveBeenCalled();
	});

	it("should catch and log when processTask throws (does not rethrow)", async () => {
		platformFactory.mockReturnValue({
			processTask: jest.fn().mockRejectedValue(new Error("processTask failed"))
		});

		const connection = createMockConnection({ platform_id: INTEGRATION_ID.MANUAL_ACCOUNTING });
		const task = createMockTask();

		await expect(fetchAccounting(connection, task)).resolves.toBeUndefined();
	});
});
