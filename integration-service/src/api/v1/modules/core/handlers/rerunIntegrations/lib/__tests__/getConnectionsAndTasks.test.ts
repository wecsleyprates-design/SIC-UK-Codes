import { getConnectionsAndTasks } from "../getConnectionsAndTasks";
import { db } from "#helpers/knex";
import { INTEGRATION_ID, INTEGRATION_CATEGORIES } from "#constants";

jest.mock("#helpers/knex", () => ({
	db: Object.assign(jest.fn(), {
		raw: jest.fn((sql: string) => ({ toString: () => sql }))
	})
}));

const mockDb = db as jest.MockedFunction<typeof db>;

describe("getConnectionsAndTasks", () => {
	const businessID = "test-business-id";

	const createMockQuery = () => {
		const query = {
			distinct: jest.fn().mockReturnThis(),
			from: jest.fn().mockReturnThis(),
			innerJoin: jest.fn().mockReturnThis(),
			leftJoin: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			whereIn: jest.fn().mockReturnThis(),
			whereRaw: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			then: jest.fn(resolve => Promise.resolve(resolve([])))
		};
		mockDb.mockReturnValue(query as any);
		return query;
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should return empty array when no connections found", async () => {
		/** Arrange */
		const query = createMockQuery();
		query.then = jest.fn(resolve => Promise.resolve(resolve([])));

		/** Act */
		const result = await getConnectionsAndTasks(businessID, [], [], []);

		/** Assert */
		expect(result).toEqual([]);
		expect(query.where).toHaveBeenCalledWith("data_connections.business_id", businessID);
	});

	it("should group connections and collect task codes", async () => {
		/** Arrange */
		const query = createMockQuery();
		query.then = jest.fn(resolve =>
			Promise.resolve(
				resolve([
					{
						connection_id: "conn-1",
						platform_id: INTEGRATION_ID.SERP_GOOGLE_PROFILE,
						platform_code: "serp_google_profile",
						task_code: "task1"
					},
					{
						connection_id: "conn-1",
						platform_id: INTEGRATION_ID.SERP_GOOGLE_PROFILE,
						platform_code: "serp_google_profile",
						task_code: "task2"
					},
					{
						connection_id: "conn-2",
						platform_id: INTEGRATION_ID.MANUAL,
						platform_code: "manual",
						task_code: "task3"
					}
				])
			)
		);

		/** Act */
		const result = await getConnectionsAndTasks(businessID, [], [], []);

		/** Assert */
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			connection_id: "conn-1",
			platform_id: INTEGRATION_ID.SERP_GOOGLE_PROFILE,
			platform_code: "serp_google_profile",
			task_codes: ["task1", "task2"]
		});
		expect(result[1]).toEqual({
			connection_id: "conn-2",
			platform_id: INTEGRATION_ID.MANUAL,
			platform_code: "manual",
			task_codes: ["task3"]
		});
	});

	it("should handle connections with no task codes", async () => {
		/** Arrange */
		const query = createMockQuery();
		query.then = jest.fn(resolve =>
			Promise.resolve(
				resolve([
					{
						connection_id: "conn-1",
						platform_id: INTEGRATION_ID.SERP_GOOGLE_PROFILE,
						platform_code: "serp_google_profile",
						task_code: null
					}
				])
			)
		);

		/** Act */
		const result = await getConnectionsAndTasks(businessID, [], [], []);

		/** Assert */
		expect(result).toHaveLength(1);
		expect(result[0].task_codes).toEqual([]);
	});

	it("should filter by platform_codes", async () => {
		/** Arrange */
		const query = createMockQuery();
		query.then = jest.fn(resolve => Promise.resolve(resolve([])));

		/** Act */
		await getConnectionsAndTasks(businessID, ["SERP_GOOGLE_PROFILE"], [], []);

		/** Assert */
		expect(query.whereIn).toHaveBeenCalledWith("data_connections.platform_id", [INTEGRATION_ID.SERP_GOOGLE_PROFILE]);
	});

	it("should filter by category_codes", async () => {
		/** Arrange */
		const query = createMockQuery();
		query.then = jest.fn(resolve => Promise.resolve(resolve([])));

		/** Act */
		await getConnectionsAndTasks(businessID, [], ["PUBLIC_RECORDS"]);

		/** Assert */
		expect(query.whereIn).toHaveBeenCalledWith("core_integrations_platforms.category_id", [
			INTEGRATION_CATEGORIES.PUBLIC_RECORDS
		]);
	});

	it("should filter by task_codes", async () => {
		/** Arrange */
		const query = createMockQuery();
		query.then = jest.fn(resolve => Promise.resolve(resolve([])));

		/** Act */
		await getConnectionsAndTasks(businessID, [], [], ["TASK1", "TASK2"]);

		/** Assert */
		expect(query.whereIn).toHaveBeenCalledWith("core_tasks.code", ["task1", "task2"]);
	});

	it("should handle invalid platform codes gracefully", async () => {
		/** Arrange */
		const query = createMockQuery();
		query.then = jest.fn(resolve => Promise.resolve(resolve([])));

		/** Act */
		await getConnectionsAndTasks(businessID, ["INVALID_PLATFORM", "SERP_GOOGLE_PROFILE"], [], []);

		/** Assert */
		expect(query.whereIn).toHaveBeenCalledWith("data_connections.platform_id", [INTEGRATION_ID.SERP_GOOGLE_PROFILE]);
	});

	it("should handle invalid category codes gracefully", async () => {
		/** Arrange */
		const query = createMockQuery();
		query.then = jest.fn(resolve => Promise.resolve(resolve([])));

		/** Act */
		await getConnectionsAndTasks(businessID, [], ["INVALID_CATEGORY", "PUBLIC_RECORDS"]);

		/** Assert */
		expect(query.whereIn).toHaveBeenCalledWith("core_integrations_platforms.category_id", [
			INTEGRATION_CATEGORIES.PUBLIC_RECORDS
		]);
	});
});
