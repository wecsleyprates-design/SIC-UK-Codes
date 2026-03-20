import { middeskAdapter } from "../middeskAdapter";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import type { BusinessAddress } from "#helpers/api";
import { fetchBusinessDetailsPeople } from "../fetchBusinessDetailsPeople";
import { FactName } from "#lib/facts/types";

jest.mock("#lib/facts");
jest.mock("#lib/facts/businessDetails");
jest.mock("../fetchBusinessDetailsPeople");

const mockAllFacts = allFacts as any;
const mockFactEngineWithDefaultOverrides = FactEngineWithDefaultOverrides as jest.MockedClass<
	typeof FactEngineWithDefaultOverrides
>;
const mockFetchBusinessDetailsPeople = fetchBusinessDetailsPeople as jest.MockedFunction<
	typeof fetchBusinessDetailsPeople
>;

describe("middeskAdapter", () => {
	const businessID = "test-business-id";

	const createMockBusinessAddress = (overrides: Partial<BusinessAddress> = {}): BusinessAddress => ({
		line_1: "123 Main St",
		apartment: null,
		city: "Anytown",
		state: "NY",
		postal_code: "12345",
		country: "US",
		mobile: null,
		is_primary: true,
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockAllFacts.filter = jest.fn().mockReturnValue([]);
		mockFetchBusinessDetailsPeople.mockResolvedValue(undefined);
	});

	describe("successful metadata generation", () => {
		it("should generate metadata with business name and primary address", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "123 Main St",
						address_line2: undefined,
						city: "Anytown",
						state: "NY",
						postal_code: "12345"
					}
				],
				forceRun: true
			});
		});

		it("should include DBA name when available", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: ["Test DBA"] },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as unknown as FactEngineWithDefaultOverrides
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "123 Main St",
						address_line2: undefined,
						city: "Anytown",
						state: "NY",
						postal_code: "12345"
					}
				],
				names: [{ name: "Test DBA", name_type: "dba" }],
				forceRun: true
			});
		});

		it("should include TIN when available", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Partial<Record<FactName, any>> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: "12-3456789" },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "123 Main St",
						address_line2: undefined,
						city: "Anytown",
						state: "NY",
						postal_code: "12345"
					}
				],
				tin: { tin: "12-3456789" },
				forceRun: true
			});
		});

		it("should include website when available", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: "https://example.com" }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "123 Main St",
						address_line2: undefined,
						city: "Anytown",
						state: "NY",
						postal_code: "12345"
					}
				],
				website: { url: "https://example.com" },
				forceRun: true
			});
		});

		it("should include all optional fields when all are available", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: ["Test DBA"] },
					primary_address: { value: createMockBusinessAddress({ apartment: "Suite 100" }) },
					addresses: { value: undefined },
					tin: { value: "12-3456789" },
					website: { value: "https://example.com" }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "123 Main St",
						address_line2: "Suite 100",
						city: "Anytown",
						state: "NY",
						postal_code: "12345"
					}
				],
				names: [{ name: "Test DBA", name_type: "dba" }],
				tin: { tin: "12-3456789" },
				website: { url: "https://example.com" },
				forceRun: true
			});
		});

		it("should truncate postal code to 5 digits when longer", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress({ postal_code: "12345-6789" }) },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result?.addresses[0].postal_code).toBe("12345");
		});

		it("should use first address from addresses array when primary_address is not available", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: undefined },
					addresses: { value: ["456 Secondary St, Springfield, IL, 62701"] },
					tin: { value: undefined },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "456 Secondary St",
						address_line2: undefined,
						city: "Springfield",
						state: "IL",
						postal_code: "62701"
					}
				],
				forceRun: true
			});
		});

		it("should include people from fetchBusinessDetailsPeople when available", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined },
					people: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			mockFetchBusinessDetailsPeople.mockResolvedValue([
				{ name: "John Doe", dob: "1990-01-01" },
				{ name: "Jane Smith" }
			]);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockFetchBusinessDetailsPeople).toHaveBeenCalledWith(businessID);
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "123 Main St",
						address_line2: undefined,
						city: "Anytown",
						state: "NY",
						postal_code: "12345"
					}
				],
				people: [{ name: "John Doe", dob: "1990-01-01" }, { name: "Jane Smith" }],
				forceRun: true
			});
		});

		it("should fall back to facts people when fetchBusinessDetailsPeople returns undefined", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined },
					people: { value: [{ name: "Fact Person" }] }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			mockFetchBusinessDetailsPeople.mockResolvedValue(undefined);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockFetchBusinessDetailsPeople).toHaveBeenCalledWith(businessID);
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "123 Main St",
						address_line2: undefined,
						city: "Anytown",
						state: "NY",
						postal_code: "12345"
					}
				],
				people: [{ name: "Fact Person" }],
				forceRun: true
			});
		});

		it("should not include people when both fetchBusinessDetailsPeople and facts return undefined", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined },
					people: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			mockFetchBusinessDetailsPeople.mockResolvedValue(undefined);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockFetchBusinessDetailsPeople).toHaveBeenCalledWith(businessID);
			expect(result).toEqual({
				name: "Test Business Inc",
				addresses: [
					{
						address_line1: "123 Main St",
						address_line2: undefined,
						city: "Anytown",
						state: "NY",
						postal_code: "12345"
					}
				],
				forceRun: true
			});
			expect(result?.people).toBeUndefined();
		});
	});

	describe("error cases", () => {
		it("should return undefined when business name is missing", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: undefined },
					dba: { value: undefined },
					primary_address: { value: createMockBusinessAddress() },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
		});

		it("should return undefined when address is missing", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: undefined },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
		});

		it("should return undefined when both business name and address are missing", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: undefined },
					dba: { value: undefined },
					primary_address: { value: undefined },
					addresses: { value: undefined },
					tin: { value: undefined },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(result).toBeUndefined();
		});

		it("should return undefined when addresses array is empty", async () => {
			/** Arrange */
			const mockGetResolvedFact = jest.fn((factName: string) => {
				const facts: Record<string, any> = {
					business_name: { value: "Test Business Inc" },
					dba: { value: undefined },
					primary_address: { value: undefined },
					addresses: { value: [] },
					tin: { value: undefined },
					website: { value: undefined }
				};
				return facts[factName];
			});

			mockFactEngineWithDefaultOverrides.mockImplementation(
				() =>
					({
						applyRules: jest.fn(),
						getResolvedFact: mockGetResolvedFact
					}) as any
			);

			/** Act */
			const result = await middeskAdapter.getMetadata(businessID);

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
			await middeskAdapter.getMetadata(businessID);

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
			await middeskAdapter.getMetadata(businessID);

			/** Assert */
			expect(mockFilter).toHaveBeenCalled();
			const filterFn = mockFilter.mock.calls[0][0];
			expect(filterFn({ name: "business_name" })).toBe(true);
			expect(filterFn({ name: "dba" })).toBe(true);
			expect(filterFn({ name: "primary_address" })).toBe(true);
			expect(filterFn({ name: "addresses" })).toBe(true);
			expect(filterFn({ name: "tin" })).toBe(true);
			expect(filterFn({ name: "website" })).toBe(true);
			expect(filterFn({ name: "other_fact" })).toBe(false);
		});
	});
});
