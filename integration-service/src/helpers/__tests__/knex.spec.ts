import { applyConditionToQuery, applyWhereClausesFromFilter, getTotalRecordCount } from "../knex";
jest.resetModules();
jest.unmock("#helpers/knex");
jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	}
}));

jest.mock("#constants/displayed-columns-map.constant", () => ({
	columnToActualMap: {
		IBusinessIntegrationTaskEnriched: {
			task_code: "core_tasks.code",
			platform_id: "core_integrations_platforms.id::text",
			platform_code: "core_integrations_platforms.code",
			platform_category_code: "core_categories.code",
			trigger_type: "business_score_triggers.trigger_type",
			trigger_version: "business_score_triggers.version::text",
			task_label: "core_tasks.label",
			id: "data_business_integrations_tasks.id::text"
		},
		IRequestResponse: { id: "request_id::text" },
		business_info: { id: "id::text" }
	}
}));

describe("addConditionToQuery", () => {
	it("should add condition to query", () => {
		const queryMock = {
			whereIn: jest.fn(),
			whereNotIn: jest.fn(),
			where: jest.fn()
		} as any;

		const condition = {
			column: "name",
			in: ["John", "Jane"]
		};

		const result = applyConditionToQuery({
			query: queryMock,
			condition
		});

		expect(result).toBe(queryMock);
		expect(queryMock.whereNotIn).not.toHaveBeenCalled();
		expect(queryMock.where).not.toHaveBeenCalled();
	});

	it("should skip an invalid column", () => {
		const queryMock = {
			whereIn: jest.fn()
		} as any;

		const condition = {
			column: "age",
			in: ["50", "20"]
		};

		const result = applyConditionToQuery({
			query: queryMock,
			condition,
			validColumns: ["name"]
		});
		expect(result).toBe(queryMock);
		expect(queryMock.whereIn).not.toHaveBeenCalled();
	});
});

describe("generateWhereClausesFromFilter", () => {
	it("should generate where clauses from filter", () => {
		const filter = "name = matt and gender != female and color in red,blue or age < 100";

		const validColumns = ["name", "gender", "color", "age"];
		const queryBuilderMock = {
			where: jest.fn(),
			whereIn: jest.fn(),
			orWhere: jest.fn()
		} as any;

		const result = applyWhereClausesFromFilter<any>({
			filter,
			validColumns,
			queryBuilder: queryBuilderMock
		});

		expect(result).toBe(queryBuilderMock);
		expect(queryBuilderMock.where).toHaveBeenCalledWith("name", "=", "matt");
		expect(queryBuilderMock.where).toHaveBeenCalledWith("gender", "!=", "female");
		expect(queryBuilderMock.whereIn).toHaveBeenCalledWith("color", ["red", "blue"]);
		expect(queryBuilderMock.orWhere).toHaveBeenCalledWith("age", "<", "100");
	});

	it("should ignore invalid column in filter criteria", () => {
		const filter = "age = 30";
		const validColumns = ["name"];
		const queryBuilderMock = {
			where: jest.fn()
		} as any;

		const result = applyWhereClausesFromFilter<any>({
			filter,
			validColumns,
			queryBuilder: queryBuilderMock
		});

		expect(result).toBe(queryBuilderMock);
		expect(queryBuilderMock.where).not.toHaveBeenCalled();
	});

	it("should map column where conditions based upon the columnToActualMap", () => {
		const filter = "task_code = 123";
		const validColumns = ["task_code"];
		const columnToActualMap = { task_code: "core_tasks.code" };

		const queryBuilderMock = {
			where: jest.fn()
		} as any;

		const result = applyWhereClausesFromFilter<any>({
			filter,
			validColumns,
			queryBuilder: queryBuilderMock,
			columnToActualMap
		});

		expect(result).toBe(queryBuilderMock);
		expect(queryBuilderMock.where).toHaveBeenCalledWith("core_tasks.code", "=", "123");
	});
	describe("getTotalRecordCount", () => {
		it("should return total record count", async () => {
			const queryBuilderMock = {
				clone: jest.fn().mockReturnThis(),
				clearSelect: jest.fn().mockReturnThis(),
				clearOrder: jest.fn().mockReturnThis(),
				clearGroup: jest.fn().mockReturnThis(),
				clearHaving: jest.fn().mockReturnThis(),
				offset: jest.fn().mockReturnThis(),
				count: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({ count: 10 })
			} as any;
			const result = await getTotalRecordCount(queryBuilderMock);
			expect(result).toBe(10);
		});
	});
});
