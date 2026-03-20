import { applyPaginationToQuery } from "../applyPaginationToQuery";
jest.mock("kafkajs");

describe("applyPaginationToQuery", () => {
	it("should apply pagination to the query", () => {
		/** Arrange */
		const mockQuery = {
			limit: jest.fn().mockReturnThis(),
			offset: jest.fn().mockReturnThis()
		};
		const queryParams = {
			pagination: "true",
			items_per_page: 10,
			page: 2
		};
		const totalCount = 50;

		/** Act */
		const paginationDetails = applyPaginationToQuery(mockQuery, queryParams, totalCount);

		/** Assert */
		expect(mockQuery.limit).toHaveBeenCalledWith(10);
		expect(mockQuery.offset).toHaveBeenCalledWith(10); // (2 - 1) * 10
		expect(paginationDetails).toEqual({
			totalPages: 5,
			totalItems: 50
		});
	});

	it("should handle pagination with items_per_page and page", () => {
		/** Arrange */
		const mockQuery = {
			limit: jest.fn().mockReturnThis(),
			offset: jest.fn().mockReturnThis()
		};
		const queryParams = {
			pagination: "true",
			items_per_page: 5,
			page: 3
		};
		const totalCount = 50;

		/** Act */
		const paginationDetails = applyPaginationToQuery(mockQuery, queryParams, totalCount);

		/** Assert */
		expect(mockQuery.limit).toHaveBeenCalledWith(5);
		expect(mockQuery.offset).toHaveBeenCalledWith(10); // (3 - 1) * 5
		expect(paginationDetails).toEqual({
			totalPages: 10,
			totalItems: 50
		});
	});

	it("should handle pagination with no total count", () => {
		/** Arrange */
		const mockQuery = {
			limit: jest.fn().mockReturnThis(),
			offset: jest.fn().mockReturnThis()
		};
		const queryParams = {
			pagination: "true",
			items_per_page: 10,
			page: 1
		};
		const totalCount = 0; // No items

		/** Act */
		const paginationDetails = applyPaginationToQuery(mockQuery, queryParams, totalCount);

		/** Assert */
		expect(mockQuery.limit).toHaveBeenCalledWith(10);
		expect(mockQuery.offset).toHaveBeenCalledWith(0); // (1 - 1) * 10
		expect(paginationDetails).toEqual({
			totalPages: 0,
			totalItems: 0
		});
	});
});
