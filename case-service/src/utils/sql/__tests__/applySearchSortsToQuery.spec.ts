import { applySearchSortsToQuery } from "../applySearchSortsToQuery";
jest.mock("kafkajs");

describe("applySearchSortsToQuery", () => {
	it("should apply a single search sort to the query", () => {
		/** Arrange */
		const mockQuery = {
			orderByRaw: jest.fn().mockReturnThis()
		};
		const search = {
			"data_businesses.name": "test"
		};

		/** Act */
		applySearchSortsToQuery(mockQuery, search);

		/** Assert */
		expect(mockQuery.orderByRaw).toHaveBeenCalledWith(`CASE WHEN data_businesses.name ILIKE ? THEN 0 ELSE 1 END`, [
			"%test%"
		]);
	});

	it("should apply multiple search sorts to the query", () => {
		/** Arrange */
		const mockQuery = {
			orderByRaw: jest.fn().mockReturnThis()
		};
		const search = {
			"data_businesses.name": "test",
			"data_businesses.description": "example"
		};

		/** Act */
		applySearchSortsToQuery(mockQuery, search);

		/** Assert */
		expect(mockQuery.orderByRaw).toHaveBeenCalledWith(`CASE WHEN data_businesses.name ILIKE ? THEN 0 ELSE 1 END`, [
			"%test%"
		]);
		expect(mockQuery.orderByRaw).toHaveBeenCalledWith(
			`CASE WHEN data_businesses.description ILIKE ? THEN 0 ELSE 1 END`,
			["%example%"]
		);
	});
});
