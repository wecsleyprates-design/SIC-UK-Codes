import { iterateOverSearch } from "../iterateOverSearch";
jest.mock("kafkajs");

describe("iterateOverSearch", () => {
	it("should call the callback for each column and value", () => {
		/** Arrange */
		const search = {
			"data_businesses.name": "test",
			"data_businesses.description": "'"
		};
		const callback = jest.fn();

		/** Act */
		iterateOverSearch(search, callback);

		/** Assert */
		expect(callback).toHaveBeenCalledWith("data_businesses.name", "test");
		expect(callback).toHaveBeenCalledWith("data_businesses.description", "''");
		expect(callback).toHaveBeenCalledTimes(2);
	});

	it("should not call the callback for undefined values", () => {
		/** Arrange */
		const search = {
			"data_businesses.name": "test",
			"data_businesses.description": undefined
		};
		const callback = jest.fn();

		/** Act */
		iterateOverSearch(search, callback);

		/** Assert */
		expect(callback).toHaveBeenCalledWith("data_businesses.name", "test");
		expect(callback).not.toHaveBeenCalledWith("data_businesses.description", expect.anything());
		expect(callback).toHaveBeenCalledTimes(1);
	});
});
