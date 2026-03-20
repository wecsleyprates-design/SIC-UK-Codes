import { zoomInfoAdapter } from "../zoomInfoAdapter";
import { getEntityMatchingMetadata } from "../../../lib/getEntityMatchingMetadata";
import { AddressUtil } from "#utils";
import { ENTITY_MATCHING_FACT_NAMES } from "../../../lib";
import { entityMatchingProcessFunction } from "../../shared/entityMatchingProcessFunction";
import type { IntegrationFactEntityMatchingMetadata } from "../../types";

jest.mock("../../../lib/getEntityMatchingMetadata");
jest.mock("#utils", () => ({
	AddressUtil: {
		partsToString: jest.fn()
	}
}));

/** Mock constants */
const mockGetEntityMatchingMetadata = getEntityMatchingMetadata as jest.MockedFunction<
	typeof getEntityMatchingMetadata
>;
const mockAddressUtilPartsToString = AddressUtil.partsToString as jest.MockedFunction<typeof AddressUtil.partsToString>;

describe("zoomInfoAdapter", () => {
	/** Factory function for base entity matching metadata */
	const createBaseMetadata = (
		overrides: Partial<IntegrationFactEntityMatchingMetadata> = {}
	): IntegrationFactEntityMatchingMetadata => ({
		names: ["Test Business Inc"],
		originalAddresses: [
			{
				line_1: "123 Main St",
				apartment: null,
				city: "New York",
				state: "NY",
				postal_code: "10001",
				country: "US"
			}
		],
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("adapter structure", () => {
		it("should have correct fact names", () => {
			expect(zoomInfoAdapter.factNames).toEqual(ENTITY_MATCHING_FACT_NAMES);
		});

		it("should use entityMatchingProcessFunction", () => {
			expect(zoomInfoAdapter.process).toBe(entityMatchingProcessFunction);
		});

		it("should have getMetadata function", () => {
			expect(zoomInfoAdapter.getMetadata).toBeDefined();
			expect(typeof zoomInfoAdapter.getMetadata).toBe("function");
		});
	});

	describe("getMetadata", () => {
		it("should return extended metadata with ZoomInfo-specific fields", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata();
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("123 Main St, New York, NY 10001, US");

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result).toEqual({
				names: ["Test Business Inc"],
				originalAddresses: baseMetadata.originalAddresses,
				addresses: ["123 Main St, New York, NY 10001, US"],
				zip3: ["100"],
				name2: ["TE"]
			});
		});

		it("should pass business ID to getEntityMatchingMetadata", async () => {
			/** Arrange */
			const businessID = "test-business-456";
			mockGetEntityMatchingMetadata.mockResolvedValue(createBaseMetadata());
			mockAddressUtilPartsToString.mockReturnValue("address");

			/** Act */
			await zoomInfoAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockGetEntityMatchingMetadata).toHaveBeenCalledWith(businessID);
		});

		it("should return undefined when base metadata is not found", async () => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(undefined);

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result).toBeUndefined();
		});

		it("should format addresses using AddressUtil.partsToString", async () => {
			/** Arrange */
			const address = {
				line_1: "123 Main St",
				apartment: "Apt 4",
				city: "New York",
				state: "NY",
				postal_code: "10001",
				country: "US"
			};
			mockGetEntityMatchingMetadata.mockResolvedValue(createBaseMetadata({ originalAddresses: [address] }));
			mockAddressUtilPartsToString.mockReturnValue("Formatted Address String");

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(mockAddressUtilPartsToString).toHaveBeenCalledWith(address);
			expect(result?.addresses).toEqual(["Formatted Address String"]);
		});

		it("should extract zip3 from multiple addresses", async () => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(
				createBaseMetadata({
					originalAddresses: [
						{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" },
						{ line_1: "456 Oak", apartment: null, city: "Boston", state: "MA", postal_code: "02101", country: "US" }
					]
				})
			);
			mockAddressUtilPartsToString.mockReturnValueOnce("123 Main, NYC, NY 10001");
			mockAddressUtilPartsToString.mockReturnValueOnce("456 Oak, Boston, MA 02101");

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.zip3).toEqual(["100", "021"]);
		});

		it("should extract name2 (first 2 chars uppercase) from all names", async () => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(
				createBaseMetadata({ names: ["Acme Corp", "Business LLC", "XYZ Inc"] })
			);
			mockAddressUtilPartsToString.mockReturnValue("address");

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.name2).toEqual(["AC", "BU", "XY"]);
		});

		it("should deduplicate formatted addresses", async () => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(
				createBaseMetadata({
					originalAddresses: [
						{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" },
						{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" }
					]
				})
			);
			mockAddressUtilPartsToString.mockReturnValue("Same Address");

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.addresses).toEqual(["Same Address"]);
		});

		it("should deduplicate zip3 values from duplicate postal codes", async () => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(
				createBaseMetadata({
					originalAddresses: [
						{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" },
						{ line_1: "456 Broadway", apartment: null, city: "NYC", state: "NY", postal_code: "10002", country: "US" }
					]
				})
			);
			mockAddressUtilPartsToString.mockReturnValue("address");

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.zip3).toEqual(["100"]);
		});

		it.each([
			{ postal_code: "", expectedZip3: [] },
			{ postal_code: "12", expectedZip3: ["12"] },
			{ postal_code: "12345", expectedZip3: ["123"] },
			{ postal_code: "123456789", expectedZip3: ["123"] }
		])("should handle postal code '$postal_code' → zip3 $expectedZip3", async ({ postal_code, expectedZip3 }) => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(
				createBaseMetadata({
					originalAddresses: [{ line_1: "A", apartment: null, city: "C", state: "S", postal_code, country: "US" }]
				})
			);
			mockAddressUtilPartsToString.mockReturnValue("address");

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.zip3).toEqual(expectedZip3);
		});

		it.each([
			{ names: ["A"], expectedName2: ["A"] },
			{ names: ["AB"], expectedName2: ["AB"] },
			{ names: ["ABC"], expectedName2: ["AB"] },
			{ names: ["ABC", "DEF"], expectedName2: ["AB", "DE"] },
			{ names: ["ABC", "DEF", "GHI"], expectedName2: ["AB", "DE", "GH"] },
			{ names: [], expectedName2: [] }
		])("should handle names $names → name2 $expectedName2", async ({ names, expectedName2 }) => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(createBaseMetadata({ names }));
			mockAddressUtilPartsToString.mockReturnValue("address");

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.name2).toEqual(expectedName2);
		});

		it("should handle empty originalAddresses array", async () => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(createBaseMetadata({ originalAddresses: [] }));

			/** Act */
			const result = await zoomInfoAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.addresses).toEqual([]);
			expect(result?.zip3).toEqual([]);
		});
	});
});
