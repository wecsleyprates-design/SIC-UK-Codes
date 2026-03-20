import { applySearchToQuery } from "../applySearchToQuery";
jest.mock("kafkajs");

describe("applySearchToQuery", () => {
	it("should apply a single where clause for a single word", () => {
		/** Arrange */
		const mockQuery = {
			orWhereRaw: jest.fn().mockReturnThis()
		};
		const searchConditions = {
			"data_businesses.name::text": "test"
		};

		/** Act */
		applySearchToQuery(mockQuery, searchConditions);

		/** Assert */

		expect(mockQuery.orWhereRaw).toHaveBeenCalledTimes(1);
		expect(mockQuery.orWhereRaw).toHaveBeenCalledWith("data_businesses.name::text ILIKE ?", "%test%");
	});

	it("should apply both a full phrase where clause and individual words where clauses for multiple words", () => {
		/** Arrange */
		const mockQuery = {
			orWhereRaw: jest.fn().mockReturnThis()
		};
		const searchConditions = {
			"data_businesses.name::text": "test 123 456"
		};

		/** Act */
		applySearchToQuery(mockQuery, searchConditions);

		/** Assert */
		expect(mockQuery.orWhereRaw).toHaveBeenCalledWith("data_businesses.name::text ILIKE ?", "%test 123 456%");
		expect(mockQuery.orWhereRaw).toHaveBeenCalledWith("data_businesses.name::text ILIKE ?", "%test%");
		expect(mockQuery.orWhereRaw).toHaveBeenCalledWith("data_businesses.name::text ILIKE ?", "%123%");
		expect(mockQuery.orWhereRaw).toHaveBeenCalledWith("data_businesses.name::text ILIKE ?", "%456%");
	});
});
