import {
	getIntegrationTasks,
	getGroupsWithIntegrations,
	createGroup,
	updateGroup,
	deleteGroup,
	addIntegrationToGroup,
	removeIntegrationFromGroup,
	type IntegrationGroupItem
} from "../integrationGroups";
import { db } from "#helpers/knex";
import { CoreApiError } from "../error";

/** State the knex mock reads at call time (set in beforeEach/tests). Use global to avoid jest.mock hoisting/TDZ. */
const mockKnexState = {
	queryRows: [] as unknown[],
	updateCount: 1,
	delCount: 1
};
(globalThis as any).__integrationGroupsMockKnexState = mockKnexState;

jest.mock("#helpers/knex", () => {
	const getState = () => (globalThis as any).__integrationGroupsMockKnexState;
	const mockDb = jest.fn((_table: string) => ({
			select: jest.fn().mockReturnThis(),
			from: jest.fn().mockReturnThis(),
			leftJoin: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			insert: jest.fn().mockResolvedValue(undefined),
			update: jest.fn().mockImplementation(() =>
				Promise.resolve(getState().updateCount)
			),
			del: jest.fn().mockImplementation(() =>
				Promise.resolve(getState().delCount)
			),
			then(resolve: (v: unknown) => void) {
				return Promise.resolve(resolve(getState().queryRows));
			}
		}));
	(mockDb as any).fn = { now: jest.fn() };
	return { db: mockDb };
});

const mockDb = db as jest.MockedFunction<typeof db>;

describe("integrationGroups", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockKnexState.queryRows = [];
		mockKnexState.updateCount = 1;
		mockKnexState.delCount = 1;
	});

	describe("getIntegrationTasks", () => {
		it("returns task rows from rel_tasks_integrations with task and platform fields", async () => {
			const rows: IntegrationGroupItem[] = [
				{
					integration_task_id: 46,
					task_category_id: 14,
					task_code: "fetch_google_reviews",
					task_label: "Fetch reviews from google",
					platform_id: 20,
					platform_code: "google_business_reviews",
					platform_label: "Google Business Reviews"
				}
			];
			mockKnexState.queryRows = rows;

			const result = await getIntegrationTasks();

			expect(mockDb).toHaveBeenCalledWith("rel_tasks_integrations");
			expect(result).toEqual(rows);
		});

		it("returns empty array when no rows", async () => {
			mockKnexState.queryRows = [];

			const result = await getIntegrationTasks();

			expect(result).toEqual([]);
		});
	});

	describe("getGroupsWithIntegrations", () => {
		it("groups rows by group_id and includes integrations when withIntegrations is true", async () => {
			const rows = [
				{
					group_id: 1,
					group_name: "Verification",
					integration_task_id: 42,
					task_category_id: 12,
					task_code: "fetch_business_entity_verification",
					task_label: "Fetch Business Entity Verification",
					platform_id: 16,
					platform_code: "middesk",
					platform_label: "Middesk"
				},
				{
					group_id: 1,
					group_name: "Verification",
					integration_task_id: 78,
					task_category_id: 12,
					task_code: "fetch_business_entity_verification",
					task_label: "Fetch Business Entity Verification",
					platform_id: 38,
					platform_code: "trulioo",
					platform_label: "Trulioo"
				}
			];
			mockKnexState.queryRows = rows;

			const result = await getGroupsWithIntegrations(true);

			expect(mockDb).toHaveBeenCalledWith("core_integration_groups");
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				id: 1,
				name: "Verification",
				integrations: [
					{
						integration_task_id: 42,
						task_category_id: 12,
						task_code: "fetch_business_entity_verification",
						task_label: "Fetch Business Entity Verification",
						platform_id: 16,
						platform_code: "middesk",
						platform_label: "Middesk"
					},
					{
						integration_task_id: 78,
						task_category_id: 12,
						task_code: "fetch_business_entity_verification",
						task_label: "Fetch Business Entity Verification",
						platform_id: 38,
						platform_code: "trulioo",
						platform_label: "Trulioo"
					}
				]
			});
		});

		it("returns groups with empty integrations when withIntegrations is false", async () => {
			const rows = [
				{
					group_id: 1,
					group_name: "Verification",
					integration_task_id: 42,
					task_category_id: 12,
					task_code: "fetch_business_entity_verification",
					task_label: "Fetch Business Entity Verification",
					platform_id: 16,
					platform_code: "middesk",
					platform_label: "Middesk"
				}
			];
			mockKnexState.queryRows = rows;

			const result = await getGroupsWithIntegrations(false);

			expect(result).toHaveLength(1);
			expect(result[0].integrations).toEqual([]);
		});
	});

	describe("createGroup", () => {
		it("inserts group and returns id and name", async () => {
			const result = await createGroup({ id: 1, name: "Verification" });

			expect(mockDb).toHaveBeenCalledWith("core_integration_groups");
			const chain = mockDb.mock.results[0].value;
			expect(chain.insert).toHaveBeenCalledWith({ id: 1, name: "Verification" });
			expect(result).toEqual({ id: 1, name: "Verification" });
		});
	});

	describe("updateGroup", () => {
		it("updates group name and returns id and name", async () => {
			const result = await updateGroup(1, { name: "Updated Name" });

			const chain = mockDb.mock.results[0].value;
			expect(chain.where).toHaveBeenCalledWith({ id: 1 });
			expect(chain.update).toHaveBeenCalledWith({ name: "Updated Name" });
			expect(result).toEqual({ id: 1, name: "Updated Name" });
		});

		it("throws CoreApiError when group not found", async () => {
			mockKnexState.updateCount = 0;

			await expect(updateGroup(999, { name: "Missing" })).rejects.toThrow(CoreApiError);
			await expect(updateGroup(999, { name: "Missing" })).rejects.toThrow(
				"Integration group not found"
			);
		});
	});

	describe("deleteGroup", () => {
		it("deletes group and returns deleted id", async () => {
			const result = await deleteGroup(1);

			const chain = mockDb.mock.results[0].value;
			expect(chain.where).toHaveBeenCalledWith({ id: 1 });
			expect(result).toEqual({ deleted: 1 });
		});

		it("throws when group not found", async () => {
			mockKnexState.delCount = 0;

			await expect(deleteGroup(999)).rejects.toThrow("Integration group not found");
		});
	});

	describe("addIntegrationToGroup", () => {
		it("inserts into rel table and returns ids", async () => {
			const result = await addIntegrationToGroup(1, 42);

			expect(mockDb).toHaveBeenCalledWith("rel_integration_integration_groups");
			const chain = mockDb.mock.results[0].value;
			expect(chain.insert).toHaveBeenCalledWith({ integration_group: 1, integration_task: 42 });
			expect(result).toEqual({ integration_group: 1, integration_task: 42 });
		});
	});

	describe("removeIntegrationFromGroup", () => {
		it("deletes association and returns removed true", async () => {
			const result = await removeIntegrationFromGroup(1, 42);

			const chain = mockDb.mock.results[0].value;
			expect(chain.where).toHaveBeenCalledWith({
				integration_group: 1,
				integration_task: 42
			});
			expect(result).toEqual({ removed: true });
		});

		it("throws CoreApiError when association not found", async () => {
			mockKnexState.delCount = 0;

			await expect(removeIntegrationFromGroup(1, 999)).rejects.toThrow(CoreApiError);
			await expect(removeIntegrationFromGroup(1, 999)).rejects.toThrow("Association not found");
		});
	});
});
