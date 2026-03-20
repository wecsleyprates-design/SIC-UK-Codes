import { isIntegrationFactEntityMatchingMetadata } from "../isIntegrationFactEntityMatchingMetadata";
import { isObjectWithKeys } from "#utils";

jest.mock("#utils", () => ({
	isObjectWithKeys: jest.fn()
}));

/** Mock constants */
const mockIsObjectWithKeys = isObjectWithKeys as jest.MockedFunction<typeof isObjectWithKeys>;

describe("isIntegrationFactEntityMatchingMetadata", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("valid metadata", () => {
		it("should return true for valid metadata with names and originalAddresses", () => {
			/** Arrange */
			const metadata = {
				names: ["Business Name"],
				originalAddresses: [
					{ line_1: "123 Main St", city: "New York", state: "NY", postal_code: "10001", apartment: null, country: "US" }
				]
			};
			mockIsObjectWithKeys.mockReturnValue(true);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(true);
			expect(mockIsObjectWithKeys).toHaveBeenCalledWith(metadata, "names", "originalAddresses");
		});

		it("should return true for metadata with multiple names", () => {
			/** Arrange */
			const metadata = {
				names: ["Business Name", "DBA Name", "Legal Name"],
				originalAddresses: [
					{ line_1: "123 St", city: "City", state: "ST", postal_code: "12345", apartment: "", country: "US" }
				]
			};
			mockIsObjectWithKeys.mockReturnValue(true);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(true);
		});

		it("should return true for metadata with multiple addresses", () => {
			/** Arrange */
			const metadata = {
				names: ["Business Name"],
				originalAddresses: [
					{
						line_1: "123 Main St",
						city: "New York",
						state: "NY",
						postal_code: "10001",
						apartment: null,
						country: "US"
					},
					{
						line_1: "456 Oak Ave",
						city: "Boston",
						state: "MA",
						postal_code: "02101",
						apartment: "Suite 200",
						country: "US"
					}
				]
			};
			mockIsObjectWithKeys.mockReturnValue(true);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(true);
		});

		it("should return true for metadata with empty arrays", () => {
			/** Arrange */
			const metadata = {
				names: [],
				originalAddresses: []
			};
			mockIsObjectWithKeys.mockReturnValue(true);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(true);
		});

		it("should return true for metadata with extra properties", () => {
			/** Arrange */
			const metadata = {
				names: ["Business Name"],
				originalAddresses: [
					{ line_1: "123 St", city: "City", state: "ST", postal_code: "12345", apartment: "", country: "US" }
				],
				extraProperty: "should not prevent validation",
				anotherExtra: 123
			};
			mockIsObjectWithKeys.mockReturnValue(true);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(true);
		});
	});

	describe("invalid metadata - missing required keys", () => {
		it("should return false when isObjectWithKeys returns false", () => {
			/** Arrange */
			const metadata = { names: ["Name"] };
			mockIsObjectWithKeys.mockReturnValue(false);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(false);
		});

		it("should return false for object missing names", () => {
			/** Arrange */
			const metadata = {
				originalAddresses: [
					{ line_1: "123 St", city: "City", state: "ST", postal_code: "12345", apartment: "", country: "US" }
				]
			};
			mockIsObjectWithKeys.mockReturnValue(false);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(false);
		});

		it("should return false for object missing originalAddresses", () => {
			/** Arrange */
			const metadata = {
				names: ["Business Name"]
			};
			mockIsObjectWithKeys.mockReturnValue(false);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(false);
		});

		it("should return false for empty object", () => {
			/** Arrange */
			const metadata = {};
			mockIsObjectWithKeys.mockReturnValue(false);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(false);
		});
	});

	describe("invalid metadata - wrong types", () => {
		it.each([
			{ metadata: { names: "not an array", originalAddresses: [] }, description: "names is string" },
			{ metadata: { names: 123, originalAddresses: [] }, description: "names is number" },
			{ metadata: { names: {}, originalAddresses: [] }, description: "names is object" },
			{ metadata: { names: null, originalAddresses: [] }, description: "names is null" }
		])("should return false when $description", ({ metadata }) => {
			/** Arrange */
			mockIsObjectWithKeys.mockReturnValue(true);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(false);
		});

		it.each([
			{ metadata: { names: [], originalAddresses: "not an array" }, description: "originalAddresses is string" },
			{ metadata: { names: [], originalAddresses: 123 }, description: "originalAddresses is number" },
			{ metadata: { names: [], originalAddresses: {} }, description: "originalAddresses is object" },
			{ metadata: { names: [], originalAddresses: null }, description: "originalAddresses is null" }
		])("should return false when $description", ({ metadata }) => {
			/** Arrange */
			mockIsObjectWithKeys.mockReturnValue(true);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(false);
		});

		it("should return false when both fields are wrong type", () => {
			/** Arrange */
			const metadata = {
				names: "not an array",
				originalAddresses: "also not an array"
			};
			mockIsObjectWithKeys.mockReturnValue(true);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(metadata);

			/** Assert */
			expect(result).toBe(false);
		});
	});

	describe("invalid metadata - non-object inputs", () => {
		it.each([
			{ input: null, description: "null" },
			{ input: undefined, description: "undefined" },
			{ input: "string", description: "string" },
			{ input: 123, description: "number" },
			{ input: true, description: "boolean" },
			{ input: [], description: "array" },
			{ input: () => {}, description: "function" }
		])("should return false for $description", ({ input }) => {
			/** Arrange */
			mockIsObjectWithKeys.mockReturnValue(false);

			/** Act */
			const result = isIntegrationFactEntityMatchingMetadata(input);

			/** Assert */
			expect(result).toBe(false);
		});
	});
});
