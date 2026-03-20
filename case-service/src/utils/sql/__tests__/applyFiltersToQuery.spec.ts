import { applyFiltersToQuery } from "../applyFiltersToQuery";
jest.mock("kafkajs");

describe("applyFiltersToQuery", () => {
	it("should apply filters to the query", () => {
		/** Arrange */
		const mockQuery = {
			whereIn: jest.fn()
		};

		const filters = {
			"data_businesses.status": ["VERIFIED", "UNVERIFIED"],
			"rel_business_customer_monitoring.is_monitoring_enabled": "true"
		};

		/** Act */
		applyFiltersToQuery(mockQuery, filters);

		/** Assert */
		expect(mockQuery.whereIn).toHaveBeenCalledWith("data_businesses.status", ["VERIFIED", "UNVERIFIED"]);
		expect(mockQuery.whereIn).toHaveBeenCalledWith("rel_business_customer_monitoring.is_monitoring_enabled", ["true"]);
	});

	it("should not apply filters for undefined values", () => {
		/** Arrange */
		const mockQuery = {
			whereIn: jest.fn()
		};
		const filters = {
			"data_businesses.status": undefined,
			"rel_business_customer_monitoring.is_monitoring_enabled": "true"
		};
		/** Act */
		applyFiltersToQuery(mockQuery, filters);
		/** Assert */
		expect(mockQuery.whereIn).not.toHaveBeenCalledWith("data_businesses.status", expect.anything());
		expect(mockQuery.whereIn).toHaveBeenCalledWith("rel_business_customer_monitoring.is_monitoring_enabled", ["true"]);
	});
});
