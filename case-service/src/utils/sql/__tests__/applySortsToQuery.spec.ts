import { applySortsToQuery } from "../applySortsToQuery";
jest.mock("kafkajs");

describe("applySortsToQuery", () => {
	it("should apply a single sort to the query", () => {
		/** Arrange */
		const mockQuery = {
			orderBy: jest.fn().mockReturnThis(),
			clearOrder: jest.fn().mockReturnThis()
		};
		const sorts = {
			"data_businesses.name": "ASC"
		} as Parameters<typeof applySortsToQuery>[1];

		/** Act */
		applySortsToQuery(mockQuery, sorts);

		/** Assert */
		expect(mockQuery.orderBy).toHaveBeenCalledWith("data_businesses.name", "asc");
	});

	it('should, given multiple sorts, apply multiple sorts to the query with the "combine" strategy', () => {
		/** Arrange */
		const mockQuery = {
			orderBy: jest.fn().mockReturnThis(),
			clearOrder: jest.fn().mockReturnThis()
		};
		const sorts = {
			"data_businesses.name": "ASC",
			"data_businesses.created_at": "DESC"
		} as Parameters<typeof applySortsToQuery>[1];

		/** Act */
		applySortsToQuery(mockQuery, sorts, "combine");

		/** Assert */
		expect(mockQuery.orderBy).toHaveBeenCalledWith("data_businesses.name", "asc");
		expect(mockQuery.orderBy).toHaveBeenCalledWith("data_businesses.created_at", "desc");
	});

	it('should, given multiple sorts, clear other sorts and apply only a single sort to the query with the "override" strategy', () => {
		/** Arrange */
		const mockQuery = {
			orderBy: jest.fn().mockReturnThis(),
			clearOrder: jest.fn().mockReturnThis()
		};
		const sorts = {
			"data_businesses.name": "ASC",
			"data_businesses.created_at": "DESC"
		} as Parameters<typeof applySortsToQuery>[1];

		/** Act */
		applySortsToQuery(mockQuery, sorts, "override");

		/** Assert */
		expect(mockQuery.orderBy).toHaveBeenNthCalledWith(1, "data_businesses.name", "asc");
		expect(mockQuery.clearOrder).toHaveBeenCalled();
		expect(mockQuery.orderBy).toHaveBeenNthCalledWith(2, "data_businesses.created_at", "desc");
	});
});
