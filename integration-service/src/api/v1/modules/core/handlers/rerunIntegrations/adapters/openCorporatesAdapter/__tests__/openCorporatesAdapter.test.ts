import { openCorporatesAdapter } from "../openCorporatesAdapter";
import { getEntityMatchingMetadata } from "../../../lib/getEntityMatchingMetadata";
import { AddressUtil, isCanadianAddress } from "#utils";
import { ENTITY_MATCHING_FACT_NAMES } from "../../../lib";
import { entityMatchingProcessFunction } from "../../shared/entityMatchingProcessFunction";
import type { IntegrationFactEntityMatchingMetadata } from "../../types";
import type { OpenCorporatesIntegrationFactMetadata } from "../types";

jest.mock("../../../lib/getEntityMatchingMetadata");
jest.mock("#utils", () => ({
	AddressUtil: {
		partsToString: jest.fn()
	},
	isCanadianAddress: jest.fn()
}));

/** Mock constants */
const mockGetEntityMatchingMetadata = getEntityMatchingMetadata as jest.MockedFunction<
	typeof getEntityMatchingMetadata
>;
const mockAddressUtilPartsToString = AddressUtil.partsToString as jest.MockedFunction<typeof AddressUtil.partsToString>;
const mockIsCanadianAddress = isCanadianAddress as jest.MockedFunction<typeof isCanadianAddress>;

describe("openCorporatesAdapter", () => {
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
			/** Assert */
			expect(openCorporatesAdapter.factNames).toEqual(ENTITY_MATCHING_FACT_NAMES);
		});

		it("should use entityMatchingProcessFunction", () => {
			/** Assert */
			expect(openCorporatesAdapter.process).toBe(entityMatchingProcessFunction);
		});

		it("should have getMetadata function", () => {
			/** Assert */
			expect(openCorporatesAdapter.getMetadata).toBeDefined();
			expect(typeof openCorporatesAdapter.getMetadata).toBe("function");
		});
	});

	describe("getMetadata - successful metadata generation", () => {
		it("should return extended metadata with OpenCorporates-specific fields", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata();
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("123 Main St, New York, NY 10001, US");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result).toEqual({
				names: ["Test Business Inc"],
				originalAddresses: baseMetadata.originalAddresses,
				addresses: ["123 Main St, New York, NY 10001, US"],
				zip3: ["100"],
				name2: ["TE"],
				country: ["US"],
				hasCanadianAddress: false
			});
		});

		it("should extract zip3 from postal codes", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				originalAddresses: [
					{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" },
					{ line_1: "456 Oak", apartment: null, city: "Boston", state: "MA", postal_code: "02101", country: "US" }
				]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValueOnce("123 Main, NYC, NY 10001");
			mockAddressUtilPartsToString.mockReturnValueOnce("456 Oak, Boston, MA 02101");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.zip3).toEqual(["100", "021"]);
		});

		it("should extract name2 (first 2 chars uppercase) from all names", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				names: ["Acme Corp", "Business LLC", "XYZ Inc"]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.name2).toEqual(["AC", "BU", "XY"]);
		});

		it("should collect unique countries from addresses", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				originalAddresses: [
					{ line_1: "US Addr", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" },
					{ line_1: "CA Addr", apartment: null, city: "Toronto", state: "ON", postal_code: "M5H", country: "CA" },
					{ line_1: "US Addr 2", apartment: null, city: "LA", state: "CA", postal_code: "90001", country: "US" }
				]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.country).toEqual(["US", "CA"]);
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
			const baseMetadata = createBaseMetadata({ originalAddresses: [address] });
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("Formatted Address String");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(mockAddressUtilPartsToString).toHaveBeenCalledWith(address);
			expect(result?.addresses).toEqual(["Formatted Address String"]);
		});

		it("should deduplicate formatted addresses", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				originalAddresses: [
					{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" },
					{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" }
				]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("Same Address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.addresses).toEqual(["Same Address"]);
		});
	});

	describe("getMetadata - Canadian address detection", () => {
		it("should set hasCanadianAddress to true when Canadian address found", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata();
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("123 Main St, Toronto, ON M5H 2N2, CA");
			mockIsCanadianAddress.mockReturnValue(true);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.hasCanadianAddress).toBe(true);
		});

		it("should set hasCanadianAddress to false when no Canadian addresses", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata();
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("123 Main St, New York, NY 10001, US");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.hasCanadianAddress).toBe(false);
		});

		it("should set hasCanadianAddress to true if any address is Canadian", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				originalAddresses: [
					{ line_1: "US Addr", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "US" },
					{ line_1: "CA Addr", apartment: null, city: "Toronto", state: "ON", postal_code: "M5H", country: "CA" }
				]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValueOnce("US Address");
			mockAddressUtilPartsToString.mockReturnValueOnce("CA Address");
			mockIsCanadianAddress.mockReturnValueOnce(false);
			mockIsCanadianAddress.mockReturnValueOnce(true);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.hasCanadianAddress).toBe(true);
		});
	});

	describe("getMetadata - edge cases", () => {
		it("should return undefined when base metadata is not found", async () => {
			/** Arrange */
			mockGetEntityMatchingMetadata.mockResolvedValue(undefined);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result).toBeUndefined();
		});

		it("should handle addresses without postal codes", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				originalAddresses: [
					{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "", country: "US" }
				]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.zip3).toEqual([]);
		});

		it("should handle addresses without country", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				originalAddresses: [
					{ line_1: "123 Main", apartment: null, city: "NYC", state: "NY", postal_code: "10001", country: "" }
				]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.country).toEqual([]);
		});

		it("should handle names with less than 2 characters", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				names: ["A", "AB", "ABC"]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.name2).toEqual(["A", "AB", "AB"]);
		});

		it("should handle empty names array", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({ names: [] });
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.name2).toEqual([]);
		});

		it("should handle empty originalAddresses array", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({ originalAddresses: [] });
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.addresses).toEqual([]);
			expect(result?.zip3).toEqual([]);
			expect(result?.country).toEqual([]);
			expect(result?.hasCanadianAddress).toBe(false);
		});
	});

	describe("getMetadata - business ID parameter", () => {
		it("should pass business ID to getEntityMatchingMetadata", async () => {
			/** Arrange */
			const businessID = "test-business-456";
			const baseMetadata = createBaseMetadata();
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			await openCorporatesAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockGetEntityMatchingMetadata).toHaveBeenCalledWith(businessID);
		});
	});

	describe("getMetadata - data transformation", () => {
		it("should handle postal codes of various lengths", async () => {
			/** Arrange */
			const baseMetadata = createBaseMetadata({
				originalAddresses: [
					{ line_1: "A", apartment: null, city: "C", state: "S", postal_code: "12", country: "US" },
					{ line_1: "B", apartment: null, city: "C", state: "S", postal_code: "12345", country: "US" },
					{ line_1: "C", apartment: null, city: "C", state: "S", postal_code: "123456789", country: "US" }
				]
			});
			mockGetEntityMatchingMetadata.mockResolvedValue(baseMetadata);
			mockAddressUtilPartsToString.mockReturnValue("address");
			mockIsCanadianAddress.mockReturnValue(false);

			/** Act */
			const result = await openCorporatesAdapter.getMetadata("business-123");

			/** Assert */
			expect(result?.zip3).toEqual(["12", "123"]);
		});
	});
});
