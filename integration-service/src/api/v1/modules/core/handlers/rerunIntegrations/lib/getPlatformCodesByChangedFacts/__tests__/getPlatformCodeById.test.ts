import { getPlatformCodeById } from "../getPlatformCodeById";
import { INTEGRATION_ID, IntegrationPlatformId } from "#constants";

describe("getPlatformCodeById", () => {
	it("should return the platform code for a given platform ID", () => {
		/** Arrange */
		const platformId = INTEGRATION_ID.SERP_GOOGLE_PROFILE;

		/** Act */
		const result = getPlatformCodeById(platformId);

		/** Assert */
		expect(result).toBe("SERP_GOOGLE_PROFILE");
	});

	it("should return undefined for an unknown platform ID", () => {
		/** Arrange */
		const platformId = 9999 as IntegrationPlatformId;

		/** Act */
		const result = getPlatformCodeById(platformId);

		/** Assert */
		expect(result).toBeUndefined();
	});
});
