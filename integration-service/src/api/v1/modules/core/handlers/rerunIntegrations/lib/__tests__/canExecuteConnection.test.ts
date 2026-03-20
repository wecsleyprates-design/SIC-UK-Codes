import { canExecuteConnection } from "../canExecuteConnection";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";

describe("canExecuteConnection", () => {
	it("should return true for SUCCESS status", () => {
		/** Arrange */
		const platformId = INTEGRATION_ID.PLAID;
		const connectionStatus = CONNECTION_STATUS.SUCCESS;

		/** Act */
		const result = canExecuteConnection(platformId, connectionStatus);

		/** Assert */
		expect(result).toBe(true);
	});

	it("should return false for FAILED status when no override exists", () => {
		/** Arrange */
		const platformId = INTEGRATION_ID.PLAID;
		const connectionStatus = CONNECTION_STATUS.FAILED;

		/** Act */
		const result = canExecuteConnection(platformId, connectionStatus);

		/** Assert */
		expect(result).toBe(false);
	});

	it("should return true for CREATED status when override exists", () => {
		/** Arrange */
		const platformId = INTEGRATION_ID.SERP_GOOGLE_PROFILE;
		const connectionStatus = CONNECTION_STATUS.CREATED;

		/** Act */
		const result = canExecuteConnection(platformId, connectionStatus);

		/** Assert */
		expect(result).toBe(true);
	});

	it("should return true for SUCCESS status even when override exists", () => {
		/** Arrange */
		const platformId = INTEGRATION_ID.SERP_GOOGLE_PROFILE;
		const connectionStatus = CONNECTION_STATUS.SUCCESS;

		/** Act */
		const result = canExecuteConnection(platformId, connectionStatus);

		/** Assert */
		expect(result).toBe(true);
	});

	it("should return true for FAILED status when override includes FAILED", () => {
		/** Arrange */
		const platformId = INTEGRATION_ID.VERDATA;
		const connectionStatus = CONNECTION_STATUS.FAILED;

		/** Act */
		const result = canExecuteConnection(platformId, connectionStatus);

		/** Assert */
		expect(result).toBe(true);
	});

	it("should return false for REVOKED status when no override exists", () => {
		/** Arrange */
		const platformId = INTEGRATION_ID.PLAID;
		const connectionStatus = CONNECTION_STATUS.REVOKED;

		/** Act */
		const result = canExecuteConnection(platformId, connectionStatus);

		/** Assert */
		expect(result).toBe(false);
	});

	it("should return false for NEEDS_ACTION status when no override exists", () => {
		/** Arrange */
		const platformId = INTEGRATION_ID.PLAID;
		const connectionStatus = CONNECTION_STATUS.NEEDS_ACTION;

		/** Act */
		const result = canExecuteConnection(platformId, connectionStatus);

		/** Assert */
		expect(result).toBe(false);
	});
});
