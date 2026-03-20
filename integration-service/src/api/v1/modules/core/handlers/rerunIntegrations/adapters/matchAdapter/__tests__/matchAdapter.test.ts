import { matchAdapter } from "../matchAdapter";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import type { BusinessAddress } from "#helpers/api";
import { Match } from "#lib/match/match";
import { AddressUtil } from "#utils";
import { matchConnection } from "#api/v1/modules/match-pro/matchConnection";
import { BusinessScoreTriggerRepository } from "#core/scoreTrigger";
import type { OwnerData } from "#lib/facts/kyc";

jest.mock("#helpers", () => ({
	db: jest.fn(),
	logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));
jest.mock("#helpers/logger", () => ({
	logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));
jest.mock("#lib/facts");
jest.mock("#lib/match/match");
jest.mock("#utils", () => ({
	AddressUtil: {
		stringToParts: jest.fn()
	}
}));
jest.mock("#utils/addressUtil", () => ({
	normalizeCountryCode: jest.fn((code: string) => code || "US")
}));
jest.mock("#utils/normalizer", () => ({
	normalizePhoneNumber: jest.fn((phone: string | null | undefined) => phone?.replace(/\D/g, "") ?? ""),
	removeSpecialCharacters: jest.fn((str: string) => str)
}));
jest.mock("#api/v1/modules/match-pro/matchConnection");
jest.mock("#core/scoreTrigger");
jest.mock("#configs", () => ({
	envConfig: {
		MATCH_ENV: "sandbox"
	}
}));

/** Mock constants */
const mockAllFacts = allFacts as any;
const mockFactEngineWithDefaultOverrides = FactEngineWithDefaultOverrides as jest.MockedClass<
	typeof FactEngineWithDefaultOverrides
>;
const mockMatch = Match as jest.MockedClass<typeof Match>;
const mockAddressUtilStringToParts = AddressUtil.stringToParts as jest.MockedFunction<typeof AddressUtil.stringToParts>;
const mockMatchConnection = matchConnection as jest.Mocked<typeof matchConnection>;
const mockBusinessScoreTriggerRepository = BusinessScoreTriggerRepository as jest.MockedClass<
	typeof BusinessScoreTriggerRepository
>;

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

const createMockGetResolvedFact = (overrides: Record<string, any> = {}) =>
	jest.fn((factName: string) => {
		const facts: Record<string, any> = {
			business_name: { value: undefined },
			dba: { value: undefined },
			primary_address: { value: undefined },
			addresses: { value: undefined },
			business_addresses_submitted: { value: undefined },
			tin: { value: undefined },
			website: { value: undefined },
			business_phone: { value: undefined },
			mcc_code: { value: undefined },
			mcc_code_found: { value: undefined },
			mcc_code_from_naics: { value: undefined },
			owners_submitted: { value: undefined },
			...overrides
		};
		return facts[factName];
	});

describe("matchAdapter", () => {
	const businessID = "test-business-id";

	beforeEach(() => {
		jest.clearAllMocks();
		mockAllFacts.filter = jest.fn().mockReturnValue([]);
		mockMatch.resolveMccCode = jest.fn().mockReturnValue("5999");
		mockMatch.transformOwnersToPrincipals = jest.fn().mockReturnValue([]);
	});

	describe("getMetadata", () => {
		describe("successful metadata generation", () => {
			it("should generate metadata with business name and primary address", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress() }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result).toEqual({
					merchant: expect.objectContaining({
						name: "Test Business Inc",
						address: expect.objectContaining({
							addressLineOne: "123 Main St",
							city: "Anytown",
							countrySubdivision: "NY",
							postalCode: "12345",
							country: "US"
						})
					})
				});
			});

			it("should fall back to dba when business_name is missing", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					dba: { value: ["My DBA Name"] },
					primary_address: { value: createMockBusinessAddress() }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.name).toBe("My DBA Name");
				expect(result?.merchant?.doingBusinessAsName).toBe("My DBA Name");
			});

			it("should set doingBusinessAsName from dba when both business_name and dba are present", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Legal Name LLC" },
					dba: { value: ["Trade Name"] },
					primary_address: { value: createMockBusinessAddress() }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.name).toBe("Legal Name LLC");
				expect(result?.merchant?.doingBusinessAsName).toBe("Trade Name");
			});

			it("should use business_addresses_submitted primary address when primary_address is missing", async () => {
				/** Arrange */
				const submittedAddresses = [
					createMockBusinessAddress({ line_1: "999 Alt St", is_primary: false }),
					createMockBusinessAddress({ line_1: "456 Primary Rd", city: "Chicago", state: "IL", is_primary: true })
				];

				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					business_addresses_submitted: { value: submittedAddresses }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.address.addressLineOne).toBe("456 Primary Rd");
				expect(result?.merchant?.address.city).toBe("Chicago");
			});

			it("should use first submitted address when none is primary", async () => {
				/** Arrange */
				const submittedAddresses = [
					createMockBusinessAddress({ line_1: "First St", is_primary: false }),
					createMockBusinessAddress({ line_1: "Second St", is_primary: false })
				];

				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					business_addresses_submitted: { value: submittedAddresses }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.address.addressLineOne).toBe("First St");
			});

			it("should parse address from addresses string array as last resort", async () => {
				/** Arrange */
				mockAddressUtilStringToParts.mockReturnValue({
					line_1: "789 String St",
					line_2: "",
					line_3: "",
					city: "Boston",
					state: "MA",
					postal_code: "02101",
					country: "US"
				});

				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					addresses: { value: ["789 String St, Boston, MA 02101, US"] }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(mockAddressUtilStringToParts).toHaveBeenCalledWith("789 String St, Boston, MA 02101, US");
				expect(result?.merchant?.address.addressLineOne).toBe("789 String St");
				expect(result?.merchant?.address.city).toBe("Boston");
			});

			it("should include apartment in addressLineTwo", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress({ apartment: "Suite 200" }) }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.address.addressLineTwo).toBe("Suite 200");
			});

			it("should truncate postal code to 5 digits", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress({ postal_code: "12345-6789" }) }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.address.postalCode).toBe("12345");
			});

			it("should set urls from website when available", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress() },
					website: { value: "https://example.com" }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.urls).toEqual(["https://example.com"]);
			});

			it("should set urls to an empty array when website is not available", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress() }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.urls).toEqual([]);
			});

			it("should include nationalTaxId when MATCH_ENV is production and TIN is available", async () => {
				/** Arrange */
				const { envConfig } = await import("#configs");
				const originalEnv = envConfig.MATCH_ENV;
				envConfig.MATCH_ENV = "production";

				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress() },
					tin: { value: "123456789" }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				try {
					/** Act */
					const result = await matchAdapter.getMetadata(businessID);

					/** Assert */
					expect(result?.merchant?.nationalTaxId).toBe("123456789");
				} finally {
					envConfig.MATCH_ENV = originalEnv;
				}
			});

			it("should set nationalTaxId to empty string when MATCH_ENV is not production", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress() },
					tin: { value: "123456789" }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(result?.merchant?.nationalTaxId).toBe("");
			});

			it("should delegate principal transformation to Match.transformOwnersToPrincipals", async () => {
				/** Arrange */
				const mockOwners: OwnerData[] = [
					{ first_name: "Jane", last_name: "Doe", email: "jane@example.com" } as OwnerData
				];
				const mockPrincipals = [{ firstName: "Jane", lastName: "Doe" }];
				mockMatch.transformOwnersToPrincipals = jest.fn().mockReturnValue(mockPrincipals);

				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress() },
					business_phone: { value: "5551234567" },
					owners_submitted: { value: mockOwners }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				const result = await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(mockMatch.transformOwnersToPrincipals).toHaveBeenCalledWith(mockOwners, "5551234567");
				expect(result?.merchant?.principals).toBe(mockPrincipals);
			});

			it("should pass empty owners array when owners_submitted is undefined", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress() }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(mockMatch.transformOwnersToPrincipals).toHaveBeenCalledWith([], null);
			});

			it("should call Match.resolveMccCode with business fact values", async () => {
				/** Arrange */
				const mockGetResolvedFact = createMockGetResolvedFact({
					business_name: { value: "Test Business Inc" },
					primary_address: { value: createMockBusinessAddress() },
					business_phone: { value: "5551234567" },
					mcc_code: { value: "5411" },
					mcc_code_found: { value: "5411" },
					mcc_code_from_naics: { value: "5411" }
				});

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: mockGetResolvedFact
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(mockMatch.resolveMccCode).toHaveBeenCalledWith(
					expect.objectContaining({
						mcc_code: { value: "5411" },
						mcc_code_found: { value: "5411" },
						mcc_code_from_naics: { value: "5411" }
					}),
					null
				);
			});
		});

		describe("error cases", () => {
			it.each([
				{
					description: "should return undefined when business name and dba are both missing",
					factOverrides: { primary_address: { value: createMockBusinessAddress() } }
				},
				{
					description: "should return undefined when address is missing",
					factOverrides: { business_name: { value: "Test Business Inc" } }
				},
				{
					description: "should return undefined when both name and address are missing",
					factOverrides: {}
				},
				{
					description: "should return undefined when addresses array is empty",
					factOverrides: {
						business_name: { value: "Test Business Inc" },
						addresses: { value: [] }
					}
				},
				{
					description: "should return undefined when business_addresses_submitted is empty",
					factOverrides: {
						business_name: { value: "Test Business Inc" },
						business_addresses_submitted: { value: [] }
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
				const result = await matchAdapter.getMetadata(businessID);

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
				await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(mockFactEngineWithDefaultOverrides).toHaveBeenCalledWith([], { business: businessID });
				expect(mockApplyRules).toHaveBeenCalledWith(FactRules.factWithHighestConfidence);
			});

			it("should filter for required fact names", async () => {
				/** Arrange */
				const mockFilter = jest.fn().mockReturnValue([]);
				mockAllFacts.filter = mockFilter;

				mockFactEngineWithDefaultOverrides.mockImplementation(
					() =>
						({
							applyRules: jest.fn(),
							getResolvedFact: jest.fn(() => ({ value: undefined }))
						}) as unknown as FactEngineWithDefaultOverrides
				);

				/** Act */
				await matchAdapter.getMetadata(businessID);

				/** Assert */
				expect(mockFilter).toHaveBeenCalled();
				const filterFn = mockFilter.mock.calls[0][0];
				expect(filterFn({ name: "business_name" })).toBe(true);
				expect(filterFn({ name: "dba" })).toBe(true);
				expect(filterFn({ name: "primary_address" })).toBe(true);
				expect(filterFn({ name: "addresses" })).toBe(true);
				expect(filterFn({ name: "business_addresses_submitted" })).toBe(true);
				expect(filterFn({ name: "tin" })).toBe(true);
				expect(filterFn({ name: "website" })).toBe(true);
				expect(filterFn({ name: "business_phone" })).toBe(true);
				expect(filterFn({ name: "mcc_code" })).toBe(true);
				expect(filterFn({ name: "mcc_code_found" })).toBe(true);
				expect(filterFn({ name: "mcc_code_from_naics" })).toBe(true);
				expect(filterFn({ name: "owners_submitted" })).toBe(true);
				expect(filterFn({ name: "other_fact" })).toBe(false);
			});
		});
	});

	describe("checkRunnable", () => {
		const businessScoreTriggerMock = { customer_id: "customer-123" };

		beforeEach(() => {
			mockBusinessScoreTriggerRepository.mockImplementation(
				() =>
					({
						getBusinessScoreTriggerByBusinessId: jest.fn().mockResolvedValue(businessScoreTriggerMock)
					}) as any
			);
			mockMatchConnection.getCustomerCredentials = jest.fn().mockResolvedValue({ isActive: true });
		});

		it("should return false when business_id is missing", async () => {
			/** Act */
			const result = await matchAdapter.checkRunnable({});

			/** Assert */
			expect(result).toBe(false);
		});

		it("should return false when MATCH credentials are inactive", async () => {
			/** Arrange */
			mockMatchConnection.getCustomerCredentials = jest.fn().mockResolvedValue({ isActive: false });

			/** Act */
			const result = await matchAdapter.checkRunnable({ business_id: "biz-123" });

			/** Assert */
			expect(result).toBe(false);
		});

		it("should return false when MATCH credentials are null", async () => {
			/** Arrange */
			mockMatchConnection.getCustomerCredentials = jest.fn().mockResolvedValue(null);

			/** Act */
			const result = await matchAdapter.checkRunnable({ business_id: "biz-123" });

			/** Assert */
			expect(result).toBe(false);
		});

		it("should return true when business_id is present and credentials are active", async () => {
			/** Act */
			const result = await matchAdapter.checkRunnable({ business_id: "biz-123" });

			/** Assert */
			expect(result).toBe(true);
		});

		it("should look up the score trigger using the provided business_id", async () => {
			/** Arrange */
			const mockGetTrigger = jest.fn().mockResolvedValue(businessScoreTriggerMock);
			mockBusinessScoreTriggerRepository.mockImplementation(
				() => ({ getBusinessScoreTriggerByBusinessId: mockGetTrigger }) as any
			);

			/** Act */
			await matchAdapter.checkRunnable({ business_id: "biz-123" });

			/** Assert */
			expect(mockGetTrigger).toHaveBeenCalledWith("biz-123");
		});

		it("should fetch credentials using the customer_id from the score trigger", async () => {
			/** Act */
			await matchAdapter.checkRunnable({ business_id: "biz-123" });

			/** Assert */
			expect(mockMatchConnection.getCustomerCredentials).toHaveBeenCalledWith("customer-123");
		});
	});
});
