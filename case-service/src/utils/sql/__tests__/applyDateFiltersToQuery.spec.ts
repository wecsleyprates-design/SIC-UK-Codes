import { applyDateFiltersToQuery } from "../applyDateFiltersToQuery";
jest.mock("kafkajs");

describe("applyDateFiltersToQuery", () => {
	it("should, given a valid date filter value, apply the filters to the query", () => {
		/** Arrange */
		const mockQuery = { whereBetween: jest.fn() };

		const dateFilters = {
			created_at: ["2023-01-01", "2023-12-31"]
		};

		/** Act */
		applyDateFiltersToQuery(mockQuery, dateFilters);

		/** Assert */
		expect(mockQuery.whereBetween).toHaveBeenCalledWith("created_at", ["2023-01-01", "2023-12-31"]);
	});

	it("should, given multiple valid date filter values, apply all filters to the query", () => {
		/** Arrange */
		const mockQuery = { whereBetween: jest.fn() };

		const dateFilters = {
			created_at: ["2023-01-01", "2023-12-31"],
			updated_at: ["2024-01-01", "2024-12-31"]
		};

		/** Act */
		applyDateFiltersToQuery(mockQuery, dateFilters);

		/** Assert */
		expect(mockQuery.whereBetween).toHaveBeenCalledWith("created_at", ["2023-01-01", "2023-12-31"]);
		expect(mockQuery.whereBetween).toHaveBeenCalledWith("updated_at", ["2024-01-01", "2024-12-31"]);
	});

	it("should, given a date filter with an empty value, not apply the filters to the query", () => {
		/** Arrange */
		const mockQuery = { whereBetween: jest.fn() };

		const dateFilters = {
			created_at: []
		};

		/** Act */
		applyDateFiltersToQuery(mockQuery, dateFilters);

		/** Assert */
		expect(mockQuery.whereBetween).not.toHaveBeenCalled();
	});

	it("should, given a date filter with an invalid value, not apply the filters to the query", () => {
		/** Arrange */
		const mockQuery = { whereBetween: jest.fn() };

		const dateFilters = {
			created_at: null as unknown as string[]
		};

		/** Act */
		applyDateFiltersToQuery(mockQuery, dateFilters);

		/** Assert */
		expect(mockQuery.whereBetween).not.toHaveBeenCalled();
	});

	it("should, given a date filter with a single value, not apply the filters to the query", () => {
		/** Arrange */
		const mockQuery = { whereBetween: jest.fn() };

		const dateFilters = {
			created_at: ["2023-01-01"]
		};

		/** Act */
		applyDateFiltersToQuery(mockQuery, dateFilters);

		/** Assert */
		expect(mockQuery.whereBetween).not.toHaveBeenCalled();
	});
});
