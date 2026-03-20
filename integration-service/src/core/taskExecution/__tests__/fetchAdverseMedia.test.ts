import { fetchAdverseMedia } from "../fetchAdverseMedia";
import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import type { UUID } from "crypto";

jest.mock("#api/v1/modules/adverse-media/adverse-media", () => ({
	adverseMedia: {
		customerSettingsForIntegration: jest.fn(),
		processAdverseMediaAndHandleTasks: jest.fn()
	}
}));

jest.mock("#helpers", () => {
	const actual = jest.requireActual("#helpers");
	return {
		...actual,
		getBusinessDetails: jest.fn(),
		getOrCreateConnection: jest.fn(),
		db: jest.fn(() => ({
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			whereNull: jest.fn().mockReturnThis(),
			whereIn: jest.fn().mockReturnThis(),
			limit: jest.fn().mockReturnThis(),
			first: jest.fn().mockResolvedValue(undefined)
		}))
	};
});

const adverseMedia = jest.requireMock("#api/v1/modules/adverse-media/adverse-media").adverseMedia as {
	customerSettingsForIntegration: jest.Mock;
	processAdverseMediaAndHandleTasks: jest.Mock;
};
const getBusinessDetails = jest.requireMock("#helpers").getBusinessDetails as jest.Mock;
const getOrCreateConnection = jest.requireMock("#helpers").getOrCreateConnection as jest.Mock;

const createMockTask = (overrides: Partial<IBusinessIntegrationTaskEnriched> = {}): IBusinessIntegrationTaskEnriched =>
	({
		id: "00000000-0000-0000-0000-000000000001" as UUID,
		connection_id: "00000000-0000-0000-0000-000000000002" as UUID,
		business_id: "00000000-0000-0000-0000-000000000003" as UUID,
		customer_id: "00000000-0000-0000-0000-000000000005" as UUID,
		case_id: "00000000-0000-0000-0000-000000000006" as UUID,
		platform_id: INTEGRATION_ID.ADVERSE_MEDIA,
		platform_code: "adverse_media",
		task_code: "fetch_adverse_media",
		task_status: TASK_STATUS.CREATED,
		created_at: "2025-01-01T00:00:00.000Z",
		updated_at: "2025-01-01T00:00:00.000Z",
		...overrides
	}) as IBusinessIntegrationTaskEnriched;

const createMockConnection = (overrides: Partial<IDBConnection> = {}): IDBConnection =>
	({
		id: "00000000-0000-0000-0000-000000000002" as UUID,
		business_id: "00000000-0000-0000-0000-000000000003" as UUID,
		platform_id: INTEGRATION_ID.ADVERSE_MEDIA,
		connection_status: "SUCCESS",
		created_at: "2025-01-01T00:00:00.000Z",
		updated_at: "2025-01-01T00:00:00.000Z",
		...overrides
	}) as IDBConnection;

describe("fetchAdverseMedia", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getBusinessDetails.mockResolvedValue({
			status: "success",
			data: {
				name: "Test Business",
				business_names: [{ name: "DBA Name" }],
				owners: [{ first_name: "John", last_name: "Doe" }],
				business_addresses: [{ city: "Austin", state: "TX" }]
			}
		});
		getOrCreateConnection.mockResolvedValue(createMockConnection());
		adverseMedia.customerSettingsForIntegration.mockResolvedValue(true);
		adverseMedia.processAdverseMediaAndHandleTasks.mockResolvedValue(undefined);
	});

	it("should return early when getBusinessDetails status is not success", async () => {
		getBusinessDetails.mockResolvedValue({ status: "error", message: "Not found" });

		const connection = createMockConnection();
		const task = createMockTask();

		await fetchAdverseMedia(connection, task);

		expect(adverseMedia.customerSettingsForIntegration).not.toHaveBeenCalled();
		expect(adverseMedia.processAdverseMediaAndHandleTasks).not.toHaveBeenCalled();
	});

	it("should return early when customer_id is missing", async () => {
		const connection = createMockConnection();
		const task = createMockTask({ customer_id: undefined as any });

		await fetchAdverseMedia(connection, task);

		expect(adverseMedia.processAdverseMediaAndHandleTasks).not.toHaveBeenCalled();
	});

	it("should return early when adverse media is disabled for customer", async () => {
		adverseMedia.customerSettingsForIntegration.mockResolvedValue(false);

		const connection = createMockConnection();
		const task = createMockTask();

		await fetchAdverseMedia(connection, task);

		expect(adverseMedia.customerSettingsForIntegration).toHaveBeenCalledWith(
			task.customer_id,
			"adverse_media"
		);
		expect(adverseMedia.processAdverseMediaAndHandleTasks).not.toHaveBeenCalled();
	});

	it("should call getOrCreateConnection and processAdverseMediaAndHandleTasks when enabled", async () => {
		const connection = createMockConnection();
		const task = createMockTask();

		await fetchAdverseMedia(connection, task);

		expect(getOrCreateConnection).toHaveBeenCalledWith(task.business_id, INTEGRATION_ID.ADVERSE_MEDIA);
		expect(adverseMedia.processAdverseMediaAndHandleTasks).toHaveBeenCalledWith(
			expect.objectContaining({
				customer_id: task.customer_id,
				business_id: task.business_id,
				business_name: "Test Business",
				case_id: task.case_id
			}),
			task
		);
	});

	it("should throw when processAdverseMediaAndHandleTasks throws", async () => {
		adverseMedia.processAdverseMediaAndHandleTasks.mockRejectedValue(new Error("Process failed"));

		const connection = createMockConnection();
		const task = createMockTask();

		await expect(fetchAdverseMedia(connection, task)).rejects.toThrow("Process failed");
	});
});
