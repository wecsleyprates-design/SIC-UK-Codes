import { getTaskCodesToRun } from "../getTaskCodesToRun";
import { sqlQuery } from "#helpers/database";

jest.mock("#helpers/database", () => ({
	sqlQuery: jest.fn()
}));

const mockSqlQuery = sqlQuery as jest.MockedFunction<typeof sqlQuery>;

describe("getTaskCodesToRun", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should return connection task codes when available", async () => {
		/** Arrange */
		const connectionTaskCodes = ["task1", "task2"];

		/** Act */
		const result = await getTaskCodesToRun({ connectionTaskCodes, platformId: 1, requestedTaskCodes: undefined });

		/** Assert */
		expect(result).toEqual(["task1", "task2"]);
		expect(mockSqlQuery).not.toHaveBeenCalled();
	});

	it("should return connection task codes even when requestedTaskCodes provided", async () => {
		/** Arrange */
		const connectionTaskCodes = ["task1", "task2"];

		/** Act */
		const result = await getTaskCodesToRun({ connectionTaskCodes, platformId: 1, requestedTaskCodes: ["task3"] });

		/** Assert */
		expect(result).toEqual(["task1", "task2"]);
		expect(mockSqlQuery).not.toHaveBeenCalled();
	});

	it("should fetch all task codes for platform when connection has no task codes and no requested codes", async () => {
		/** Arrange */
		mockSqlQuery.mockResolvedValue({
			rows: [{ code: "task1" }, { code: "task2" }, { code: "task3" }]
		} as any);

		/** Act */
		const result = await getTaskCodesToRun({ connectionTaskCodes: [], platformId: 1, requestedTaskCodes: undefined });

		/** Assert */
		expect(result).toEqual(["task1", "task2", "task3"]);
		expect(mockSqlQuery).toHaveBeenCalledWith({ sql: expect.stringContaining("SELECT ct.code"), values: [1] });
	});

	it("should fetch all task codes for platform when connection has no task codes and empty requested codes", async () => {
		/** Arrange */
		mockSqlQuery.mockResolvedValue({ rows: [{ code: "task1" }] } as any);

		/** Act */
		const result = await getTaskCodesToRun({ connectionTaskCodes: [], platformId: 2, requestedTaskCodes: [] });

		/** Assert */
		expect(result).toEqual(["task1"]);
		expect(mockSqlQuery).toHaveBeenCalledWith({ sql: expect.stringContaining("SELECT ct.code"), values: [2] });
	});

	it("should return empty array when connection has no task codes and requested codes provided", async () => {
		/** Arrange / Act */
		const result = await getTaskCodesToRun({ connectionTaskCodes: [], platformId: 1, requestedTaskCodes: ["task1"] });

		/** Assert */
		expect(result).toEqual([]);
		expect(mockSqlQuery).not.toHaveBeenCalled();
	});

	it("should handle empty query result", async () => {
		/** Arrange */
		mockSqlQuery.mockResolvedValue({ rows: [] } as any);

		/** Act */
		const result = await getTaskCodesToRun({ connectionTaskCodes: [], platformId: 1, requestedTaskCodes: undefined });

		/** Assert */
		expect(result).toEqual([]);
	});
});
