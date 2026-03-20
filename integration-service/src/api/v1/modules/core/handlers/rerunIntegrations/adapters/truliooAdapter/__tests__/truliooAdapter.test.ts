import { truliooAdapter } from "../truliooAdapter";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import type { BusinessAddress } from "#helpers/api";

jest.mock("#lib/facts");

const mockAllFacts = allFacts;
const mockFactEngineWithDefaultOverrides = FactEngineWithDefaultOverrides as jest.MockedClass<
	typeof FactEngineWithDefaultOverrides
>;

const createMockBusinessAddress = (overrides: Partial<BusinessAddress> = {}): BusinessAddress => ({
	line_1: "123 Main St",
	apartment: null,
	city: "London",
	state: "England",
	postal_code: "SW1A 1AA",
	country: "GB",
	mobile: null,
	is_primary: true,
	...overrides
});

const createMockGetResolvedFact = (overrides: Record<string, any> = {}) => {
	return jest.fn((factName: string) => {
		const facts: Record<string, any> = {
			business_name: { value: undefined },
			dba: { value: undefined },
			primary_address: { value: undefined },
			addresses: { value: undefined },
			tin: { value: undefined },
			...overrides
		};
		return facts[factName];
	});
};

describe("truliooAdapter", () => {
	const businessID = "test-business-id";

	beforeEach(() => {
		jest.clearAllMocks();
		mockAllFacts.filter = jest.fn().mockReturnValue([]);
	});

	describe("successful metadata generation", () => {
		it.each([
			{
				description: "should generate metadata with business name and primary address",
				factOverrides: {
					business_name: { value: "Test Business Ltd" },
					primary_address: { value: createMockBusinessAddress() }
				},
				expected: {
					name: "Test Business Ltd",
					tin: undefined,
					business_addresses: [
						{
							line_1: "123 Main St",
							city: "London",
							state: "England",
							postal_code: "SW1A 1AA",
							country: "GB",
							is_primary: true
						}
					]
				}
			},
			{
				description: "should include TIN when available",
				factOverrides: {
					business_name: { value: "Test Business Ltd" },
					primary_address: { value: createMockBusinessAddress() },
					tin: { value: "GB123456789" }
				},
				expected: {
					name: "Test Business Ltd",
					tin: "GB123456789",
					business_addresses: [
						{
							line_1: "123 Main St",
							city: "London",
							state: "England",
							postal_code: "SW1A 1AA",
							country: "GB",
							is_primary: true
						}
					]
				}
			},
			{
				description: "should truncate postal code to 10 characters when longer",
				factOverrides: {
					business_name: { value: "Test Business Ltd" },
					primary_address: { value: createMockBusinessAddress({ postal_code: "SW1A 1AA-EXTRA-LONG" }) }
				},
				expected: {
					name: "Test Business Ltd",
					tin: undefined,
					business_addresses: [
						{
							line_1: "123 Main St",
							city: "London",
							state: "England",
							postal_code: "SW1A 1AA-E",
							country: "GB",
							is_primary: true
						}
					]
				}
			},
			{
				description: "should default to US when country is not provided",
				factOverrides: {
					business_name: { value: "Test Business Inc" },
					primary_address: {
						value: createMockBusinessAddress({ country: "" })
					}
				},
				expected: {
					name: "Test Business Inc",
					tin: undefined,
					business_addresses: [
						{
							line_1: "123 Main St",
							city: "London",
							state: "England",
							postal_code: "SW1A 1AA",
							country: "US",
							is_primary: true
						}
					]
				}
			}
		])("$description", async ({ factOverrides, expected }) => {
			/** Arrange */
			const mockGetResolvedFact = createMockGetResolvedFact(factOverrides);

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			/** Act */
			const result = await truliooAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual(expected);
		});

		it("should use first address from addresses array when primary_address is not available", async () => {
			/** Arrange */
			const mockGetResolvedFact = createMockGetResolvedFact({
				business_name: { value: "Test Business Ltd" },
				addresses: { value: ["123 Main St, Chicago, IL, 60614, US"] }
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			/** Act */
			const result = await truliooAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({
				name: "Test Business Ltd",
				tin: undefined,
				business_addresses: [
					{
						line_1: "123 Main St",
						city: "Chicago",
						state: "IL",
						postal_code: "60614",
						country: "US",
						is_primary: true
					}
				]
			});
		});

		it("should handle Canadian address", async () => {
			/** Arrange */
			const mockGetResolvedFact = createMockGetResolvedFact({
				business_name: { value: "Test Business Inc" },
				primary_address: {
					value: createMockBusinessAddress({
						line_1: "100 Queen St",
						city: "Toronto",
						state: "ON",
						postal_code: "M5H 2N2",
						country: "CA"
					})
				}
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			/** Act */
			const result = await truliooAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({
				name: "Test Business Inc",
				tin: undefined,
				business_addresses: [
					{
						line_1: "100 Queen St",
						city: "Toronto",
						state: "ON",
						postal_code: "M5H 2N2",
						country: "CA",
						is_primary: true
					}
				]
			});
		});
	});

	describe("error cases", () => {
		it.each([
			{
				description: "should return undefined when business name is missing",
				factOverrides: {
					primary_address: { value: createMockBusinessAddress() }
				}
			},
			{
				description: "should return undefined when address is missing",
				factOverrides: {
					business_name: { value: "Test Business Ltd" }
				}
			},
			{
				description: "should return undefined when both business name and address are missing",
				factOverrides: {}
			},
			{
				description: "should return undefined when addresses array is empty",
				factOverrides: {
					business_name: { value: "Test Business Ltd" },
					addresses: { value: [] }
				}
			},
			{
				description: "should return undefined when postal code is missing",
				factOverrides: {
					business_name: { value: "Test Business Ltd" },
					primary_address: { value: createMockBusinessAddress({ postal_code: null as unknown as string }) }
				}
			}
		])("$description", async ({ factOverrides }) => {
			/** Arrange */
			const mockGetResolvedFact = createMockGetResolvedFact(factOverrides);

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			/** Act */
			const result = await truliooAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
		});
	});

	describe("FactEngine integration", () => {
		it("should initialize FactEngine with correct parameters", async () => {
			/** Arrange */
			const mockApplyRules = jest.fn();
			const mockGetResolvedFact = jest.fn(() => ({ value: undefined }));

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: mockApplyRules,
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			mockAllFacts.filter = jest.fn().mockReturnValue([]);

			/** Act */
			await truliooAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockFactEngineWithDefaultOverrides).toHaveBeenCalledWith([], { business: businessID });
			expect(mockApplyRules).toHaveBeenCalledWith(FactRules.factWithHighestConfidence);
		});

		it("should filter for required fact names", async () => {
			/** Arrange */
			const mockFilteredFacts = [{ name: "business_name" }, { name: "primary_address" }];
			const mockFilter = jest.fn().mockReturnValue(mockFilteredFacts);
			mockAllFacts.filter = mockFilter;

			const mockApplyRules = jest.fn();
			const mockGetResolvedFact = jest.fn(() => ({ value: undefined }));

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: mockApplyRules,
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			/** Act */
			await truliooAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockFilter).toHaveBeenCalled();
			const filterFn = mockFilter.mock.calls[0][0];
			expect(filterFn({ name: "business_name" })).toBe(true);
			expect(filterFn({ name: "dba" })).toBe(true);
			expect(filterFn({ name: "primary_address" })).toBe(true);
			expect(filterFn({ name: "addresses" })).toBe(true);
			expect(filterFn({ name: "tin" })).toBe(true);
			expect(filterFn({ name: "other_fact" })).toBe(false);
		});
	});
});
