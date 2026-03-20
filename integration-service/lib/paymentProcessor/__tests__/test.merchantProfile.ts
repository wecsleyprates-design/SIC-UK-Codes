import { IntegrationPlatformId } from "#constants";
import { MerchantProfile } from "../merchantProfile";
import { MerchantProfileConverter } from "../merchantProfileConverter";
import { CreateMerchantProfileParams } from "../types/merchantProfile";
import { Banking } from "#api/v1/modules/banking/banking";
import { INTEGRATION_ID } from "#constants";
import { getBusinessDetails, getBusinessFactsByKeys, getInternalCaseByBusinessId } from "#helpers";
import { randomUUID } from "crypto";
import {
	generateBankingInfo,
	generateBusinessDetails,
	generateCaseStatusDetails,
	generateFacts,
	generateMerchantProfiles
} from "./test.utils";

// Mock encryption so tests don't depend on CRYPTO_SECRET_KEY/CRYPTO_IV (e.g. in GHA)
jest.mock("#utils/encryption", () => ({
	encryptData: jest.fn((data: unknown) => JSON.stringify(data)),
	decryptData: jest.fn((ciphertext: string) => JSON.parse(ciphertext))
}));

// Mock all external dependencies
jest.mock("#api/v1/modules/banking/banking");
jest.mock("#helpers", () => ({
	getBusinessDetails: jest.fn(),
	getBusinessFactsByKeys: jest.fn(),
	getInternalCaseByBusinessId: jest.fn(),
	logger: {
		error: jest.fn()
	}
}));

const MockedBanking = Banking as jest.MockedClass<typeof Banking>;
const mockedGetBusinessDetails = getBusinessDetails as jest.MockedFunction<typeof getBusinessDetails>;
const mockedGetBusinessFactsByKeys = getBusinessFactsByKeys as jest.MockedFunction<typeof getBusinessFactsByKeys>;
const mockedGetInternalCaseByBusinessId = getInternalCaseByBusinessId as jest.MockedFunction<
	typeof getInternalCaseByBusinessId
>;

describe("MerchantProfile", () => {
	let mockBankingInstance: jest.Mocked<Banking>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup Banking mock
		mockBankingInstance = {
			getAllBankingAccounts: jest.fn()
		} as any;
		MockedBanking.mockImplementation(() => mockBankingInstance);
	});

	describe("Constructor", () => {
		it("should create a MerchantProfile instance with all required properties", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			expect(merchantProfile).toBeInstanceOf(MerchantProfile);
			expect(merchantProfile.customerId).toBeDefined();
			expect(merchantProfile.businessId).toBeDefined();
			expect(merchantProfile.platformId).toBe(INTEGRATION_ID.STRIPE);
			expect(merchantProfile.profile).toBeDefined();
			expect(merchantProfile.profileId).toBeDefined();
			expect(merchantProfile.createdAt).toBeDefined();
			expect(merchantProfile.updatedAt).toBeDefined();
		});

		it("should create a MerchantProfile instance without optional properties", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, false, false);

			expect(merchantProfile).toBeInstanceOf(MerchantProfile);
			expect(merchantProfile.profileId).toBeUndefined();
			expect(merchantProfile.createdAt).toBeUndefined();
			expect(merchantProfile.updatedAt).toBeUndefined();
		});
	});

	describe("fromDb", () => {
		it("should create MerchantProfile from database record", () => {
			const dbRecord = {
				customer_id: randomUUID(),
				business_id: "test-business",
				platform_id: INTEGRATION_ID.STRIPE,
				id: 1,
				profile: {
					business_name: "Test Business",
					business_website: "https://test.com",
					address_line_1: "123 Test St",
					address_city: "Test City",
					address_state: "TS",
					address_postal_code: "12345",
					country: "US",
					tin: "123456789",
					mcc_code: "5734",
					business_phone: "555-0000",
					people: { owners: [] },
					banking_info: null
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			const merchantProfile = MerchantProfile.fromDb(dbRecord) as MerchantProfile;

			expect(merchantProfile).toBeInstanceOf(MerchantProfile);
			expect(merchantProfile.customerId).toBe(dbRecord.customer_id);
			expect(merchantProfile.businessId).toBe(dbRecord.business_id);
			expect(merchantProfile.platformId).toBe(dbRecord.platform_id);
		});
	});

	describe("toApiResponse", () => {
		it("should convert MerchantProfile to API response format", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			const apiResponse = merchantProfile.toApiResponse();

			expect(apiResponse).toEqual({
				profile_id: merchantProfile.profileId,
				business_id: merchantProfile.businessId,
				customer_id: merchantProfile.customerId,
				platform_id: merchantProfile.platformId,
				created_at: merchantProfile.createdAt,
				updated_at: merchantProfile.updatedAt,
				profile: merchantProfile.profile,
				accounts: merchantProfile.accounts
			});
		});
	});

	describe("toDbRecord", () => {
		it("should convert MerchantProfile to database record format", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			const dbRecord = merchantProfile.toDbRecord();

			expect(dbRecord).toEqual({
				id: merchantProfile.profileId,
				customer_id: merchantProfile.customerId,
				business_id: merchantProfile.businessId,
				platform_id: merchantProfile.platformId,
				profile: merchantProfile.profile,
				created_at: merchantProfile.createdAt,
				updated_at: merchantProfile.updatedAt
			});
		});
	});

	describe("toStripeCreateAccountFormat", () => {
		it("should convert MerchantProfile to Stripe create account format", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			const stripeFormat = merchantProfile.toStripeCreateAccountFormat();

			expect(stripeFormat).toHaveProperty("profileId", merchantProfile.profileId);
			expect(stripeFormat).toHaveProperty("customerId", merchantProfile.customerId);
			expect(stripeFormat).toHaveProperty("businessId", merchantProfile.businessId);
			expect(stripeFormat).toHaveProperty("payload");
			expect(stripeFormat.payload).toHaveProperty("business_profile");
			expect(stripeFormat.payload).toHaveProperty("company");
			expect(stripeFormat.payload.business_profile?.name).toBe(merchantProfile.profile.business_name);
		});

		it("should use real bank account when testMode is false", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const realAccountNumber = merchantProfile.profile.banking_info?.account_number;
			const realRoutingNumber = merchantProfile.profile.banking_info?.routing_number;

			const stripeFormat = merchantProfile.toStripeCreateAccountFormat(false);

			expect(stripeFormat.payload.external_account).toBeDefined();
			expect(stripeFormat.payload.external_account).toHaveProperty("account_number", realAccountNumber);
			expect(stripeFormat.payload.external_account).toHaveProperty("routing_number", realRoutingNumber);
		});

		it("should use sandbox bank account when testMode is true", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			const stripeFormat = merchantProfile.toStripeCreateAccountFormat(true);

			expect(stripeFormat.payload.external_account).toBeDefined();
			expect(stripeFormat.payload.external_account).toHaveProperty("account_number", "000123456789");
			expect(stripeFormat.payload.external_account).toHaveProperty("routing_number", "110000000");
		});
	});

	describe("toStripePersonsContext", () => {
		it("should convert business owners to Stripe persons context", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			const personsContext = merchantProfile.toStripePersonsContext();

			expect(personsContext).toBeInstanceOf(Array);
			expect(personsContext.length).toBe(merchantProfile.profile.people.owners.length);

			if (personsContext.length > 0) {
				const person = personsContext[0];
				expect(person).toHaveProperty("first_name");
				expect(person).toHaveProperty("last_name");
				expect(person).toHaveProperty("address");
				expect(person).toHaveProperty("dob");
				expect(person).toHaveProperty("phone");
				expect(person).toHaveProperty("relationship");
				expect(person).toHaveProperty("ssn_last_4");
			}
		});
	});

	describe("createOne", () => {
		it("should create a single MerchantProfile with mocked dependencies", async () => {
			const customerId = randomUUID();
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			const facts = generateFacts(false, false);
			const bankingInfo = generateBankingInfo(1);

			const params: CreateMerchantProfileParams = {
				customerId,
				params: {
					businessId,
					platformId: INTEGRATION_ID.STRIPE,
					banking: {
						bankId,
						bankType: "deposits"
					}
				}
			};

			// Mock the dependencies
			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			mockBankingInstance.getAllBankingAccounts.mockResolvedValue({
				accounts: [
					{
						id: bankId,
						bank_account: bankingInfo[0].account_number,
						routing_number: bankingInfo[0].routing_number
					}
				]
			} as any);

			const merchantProfile = await MerchantProfile.createOne(params, undefined);

			expect(merchantProfile).toBeInstanceOf(MerchantProfile);
			expect(merchantProfile.customerId).toBe(customerId);
			expect(merchantProfile.businessId).toBe(businessDetails.id);
			expect(merchantProfile.platformId).toBe(INTEGRATION_ID.STRIPE);

			// Verify fact-populated fields are set correctly
			expect(merchantProfile.profile.mcc_code).toBe(facts.mcc_code);
			expect(merchantProfile.profile.business_website).toBe(facts.business_website);
			expect(merchantProfile.profile.business_phone).toBe(facts.business_phone);
			// TIN can come from either facts or business details, should fallback correctly
			expect(merchantProfile.profile.tin).toBe(businessDetails.tin || facts.tin);

			expect(mockedGetBusinessDetails).toHaveBeenCalledWith(businessId);
			expect(mockedGetBusinessFactsByKeys).toHaveBeenCalledWith(
				businessId,
				MerchantProfileConverter.MERCHANT_PROFILE_FACTS
			);
			expect(mockBankingInstance.getAllBankingAccounts).toHaveBeenCalledWith(
				{ businessID: businessId },
				{ case_id: undefined }
			);
		});

		it("should create a merchant profile with stripe context", async () => {
			const customerId = randomUUID();
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			const facts = generateFacts(false, false);
			const bankingInfo = generateBankingInfo(1);

			const stripeContext = {
				capabilities: {
					card_payments: { requested: true },
					transfers: { requested: true },
					us_bank_account_ach_payments: { requested: true }
				}
			};

			const params: CreateMerchantProfileParams = {
				customerId,
				params: {
					businessId,
					platformId: INTEGRATION_ID.STRIPE,
					banking: {
						bankId,
						bankType: "deposits"
					}
				}
			};

			// Mock the dependencies
			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			mockBankingInstance.getAllBankingAccounts.mockResolvedValue({
				accounts: [
					{
						id: bankId,
						bank_account: bankingInfo[0].account_number,
						routing_number: bankingInfo[0].routing_number
					}
				]
			} as any);

			const merchantProfile = await MerchantProfile.createOne(params, stripeContext);

			expect(merchantProfile).toBeInstanceOf(MerchantProfile);
			expect(merchantProfile.profile.stripe).toBeDefined();
			expect(merchantProfile.profile.stripe?.capabilities).toEqual(stripeContext.capabilities);
			// TODO: Uncomment when payment groups are implemented
			// expect(merchantProfile.profile.stripe?.groups).toEqual(stripeContext.groups);
		});

		it("should handle missing banking accounts", async () => {
			const customerId = randomUUID();
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			const facts = generateFacts(false, false);

			const params: CreateMerchantProfileParams = {
				customerId,
				params: {
					businessId,
					platformId: INTEGRATION_ID.STRIPE,
					banking: {
						bankId,
						bankType: "deposits"
					}
				}
			};

			// Mock the dependencies
			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			mockBankingInstance.getAllBankingAccounts.mockResolvedValue({
				accounts: null
			} as any);

			const merchantProfile = await MerchantProfile.createOne(params, undefined);

			expect(merchantProfile.profile.banking_info).toBeNull();
			// Verify fact-populated fields are still set correctly even without banking
			expect(merchantProfile.profile.mcc_code).toBe(facts.mcc_code);
			expect(merchantProfile.profile.business_website).toBe(facts.business_website);
			expect(merchantProfile.profile.business_phone).toBe(facts.business_phone);
		});

		it("should handle failed business details fetch", async () => {
			const customerId = randomUUID();
			const businessId = randomUUID();
			const bankId = randomUUID();

			const params: CreateMerchantProfileParams = {
				customerId,
				params: {
					businessId,
					platformId: INTEGRATION_ID.STRIPE,
					banking: {
						bankId,
						bankType: "deposits"
					}
				}
			};

			mockedGetBusinessDetails.mockResolvedValue({
				status: "error",
				message: "Business not found"
			} as any);

			await expect(MerchantProfile.createOne(params, undefined)).rejects.toThrow();
		});

		it("should set mcc_code when it is a valid Stripe MCC code", async () => {
			const customerId = randomUUID();
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			const validMccCode = "5734"; // Valid Stripe MCC code for computer software stores
			const facts = {
				...generateFacts(false, false),
				mcc_code: validMccCode
			};
			const bankingInfo = generateBankingInfo(1);

			const params: CreateMerchantProfileParams = {
				customerId,
				params: {
					businessId,
					platformId: INTEGRATION_ID.STRIPE,
					banking: {
						bankId,
						bankType: "deposits"
					}
				}
			};

			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			mockBankingInstance.getAllBankingAccounts.mockResolvedValue({
				accounts: [
					{
						id: bankId,
						bank_account: bankingInfo[0].account_number,
						routing_number: bankingInfo[0].routing_number
					}
				]
			} as any);

			const merchantProfile = await MerchantProfile.createOne(params, undefined);

			expect(merchantProfile.profile.mcc_code).toBe(validMccCode);
		});

		it("should set mcc_code to null when it is an invalid Stripe MCC code", async () => {
			const customerId = randomUUID();
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			const invalidMccCode = "9999"; // Invalid Stripe MCC code
			const facts = {
				...generateFacts(false, false),
				mcc_code: invalidMccCode
			};
			const bankingInfo = generateBankingInfo(1);

			const params: CreateMerchantProfileParams = {
				customerId,
				params: {
					businessId,
					platformId: INTEGRATION_ID.STRIPE,
					banking: {
						bankId,
						bankType: "deposits"
					}
				}
			};

			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			mockBankingInstance.getAllBankingAccounts.mockResolvedValue({
				accounts: [
					{
						id: bankId,
						bank_account: bankingInfo[0].account_number,
						routing_number: bankingInfo[0].routing_number
					}
				]
			} as any);

			const merchantProfile = await MerchantProfile.createOne(params, undefined);

			expect(merchantProfile.profile.mcc_code).toBeNull();
		});

		it("should set mcc_code to null when it is not provided in facts", async () => {
			const customerId = randomUUID();
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			const facts = generateFacts(false, true); // This generates facts with null values
			const bankingInfo = generateBankingInfo(1);

			const params: CreateMerchantProfileParams = {
				customerId,
				params: {
					businessId,
					platformId: INTEGRATION_ID.STRIPE,
					banking: {
						bankId,
						bankType: "deposits"
					}
				}
			};

			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			mockBankingInstance.getAllBankingAccounts.mockResolvedValue({
				accounts: [
					{
						id: bankId,
						bank_account: bankingInfo[0].account_number,
						routing_number: bankingInfo[0].routing_number
					}
				]
			} as any);

			const merchantProfile = await MerchantProfile.createOne(params, undefined);

			expect(merchantProfile.profile.mcc_code).toBeNull();
		});
	});

	describe("createMany", () => {
		it("should create multiple MerchantProfiles", async () => {
			const customerId = randomUUID();
			const businessDetails1 = generateBusinessDetails();
			const businessDetails2 = generateBusinessDetails();
			const facts = generateFacts(false, false);
			const bankingInfo = generateBankingInfo(2);

			const params: CreateMerchantProfileParams[] = [
				{
					customerId,
					params: {
						businessId: randomUUID(),
						platformId: INTEGRATION_ID.STRIPE,
						banking: {
							bankId: randomUUID(),
							bankType: "deposits"
						}
					}
				},
				{
					customerId,
					params: {
						businessId: randomUUID(),
						platformId: INTEGRATION_ID.STRIPE,
						banking: {
							bankId: randomUUID(),
							bankType: "deposits"
						}
					}
				}
			];

			// Mock the dependencies
			mockedGetBusinessDetails
				.mockResolvedValueOnce({
					status: "success",
					data: businessDetails1
				} as any)
				.mockResolvedValueOnce({
					status: "success",
					data: businessDetails2
				} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			mockBankingInstance.getAllBankingAccounts
				.mockResolvedValueOnce({
					accounts: [
						{
							id: params[0].params.banking.bankId,
							bank_account: bankingInfo[0].account_number,
							routing_number: bankingInfo[0].routing_number
						}
					]
				} as any)
				.mockResolvedValueOnce({
					accounts: [
						{
							id: params[1].params.banking.bankId,
							bank_account: bankingInfo[1].account_number,
							routing_number: bankingInfo[1].routing_number
						}
					]
				} as any);

			const merchantProfiles = await MerchantProfile.createMany(params, undefined);

			expect(merchantProfiles).toHaveLength(2);
			expect(merchantProfiles[0]).toBeInstanceOf(MerchantProfile);
			expect(merchantProfiles[1]).toBeInstanceOf(MerchantProfile);
		});

		it("should return empty array when no params provided", async () => {
			const result = await MerchantProfile.createMany([], undefined);
			expect(result).toEqual([]);
		});
	});
});

describe("MerchantProfileConverter", () => {
	let converter: MerchantProfileConverter;
	const customerId = randomUUID();

	beforeEach(() => {
		jest.clearAllMocks();
		converter = new MerchantProfileConverter(customerId);
	});

	describe("Constructor", () => {
		it("should create MerchantProfileConverter with customerId", () => {
			expect(converter.customerId).toBe(customerId);
		});
	});

	describe("MERCHANT_PROFILE_FACTS", () => {
		it("should have correct facts array", () => {
			expect(MerchantProfileConverter.MERCHANT_PROFILE_FACTS).toEqual([
				"mcc_code",
				"business_website",
				"business_phone",
				"tin"
			]);
		});
	});

	describe("createMerchantProfile", () => {
		it("should create merchant profile with all data", async () => {
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			const facts = generateFacts(false, false);
			const bankingInfo = generateBankingInfo(1);

			const params = {
				businessId,
				platformId: INTEGRATION_ID.STRIPE,
				banking: {
					bankId,
					bankType: "deposits"
				}
			};

			// Mock dependencies
			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			const mockBanking = {
				getAllBankingAccounts: jest.fn().mockResolvedValue({
					accounts: [
						{
							id: bankId,
							bank_account: bankingInfo[0].account_number,
							routing_number: bankingInfo[0].routing_number
						}
					]
				})
			};
			MockedBanking.mockImplementation(() => mockBanking as any);

			const result = await converter.createMerchantProfile(params, undefined);

			expect(result).toBeInstanceOf(MerchantProfile);
			expect(result.customerId).toBe(customerId);
			expect(result.businessId).toBe(businessDetails.id);
			expect(result.profile.business_name).toBe(businessDetails.name);

			// Verify all fact-populated fields are correctly set
			expect(result.profile.mcc_code).toBe(facts.mcc_code);
			expect(result.profile.business_website).toBe(facts.business_website);
			expect(result.profile.business_phone).toBe(facts.business_phone);
			expect(result.profile.tin).toBe(businessDetails.tin || facts.tin);
		});

		it("should handle null/empty facts", async () => {
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			const facts = generateFacts(false, true); // null facts
			const bankingInfo = generateBankingInfo(1);

			const params = {
				businessId,
				platformId: INTEGRATION_ID.STRIPE,
				banking: {
					bankId,
					bankType: "deposits"
				}
			};

			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			const mockBanking = {
				getAllBankingAccounts: jest.fn().mockResolvedValue({
					accounts: [
						{
							id: bankId,
							bank_account: bankingInfo[0].account_number,
							routing_number: bankingInfo[0].routing_number
						}
					]
				})
			};
			MockedBanking.mockImplementation(() => mockBanking as any);

			const result = await converter.createMerchantProfile(params, undefined);

			expect(result.profile.business_website).toBeNull();
			expect(result.profile.business_phone).toBeNull();
			expect(result.profile.mcc_code).toBeNull();
			// TIN should fallback to business details when facts are null
			expect(result.profile.tin).toBe(businessDetails.tin);
		});

		it("should handle fact field precedence correctly", async () => {
			const businessId = randomUUID();
			const bankId = randomUUID();
			const businessDetails = generateBusinessDetails();
			// Set business details TIN to null to test facts precedence
			(businessDetails as any).tin = null;
			const facts = generateFacts(false, false); // Has TIN
			const bankingInfo = generateBankingInfo(1);

			const params = {
				businessId,
				platformId: INTEGRATION_ID.STRIPE,
				banking: {
					bankId,
					bankType: "deposits"
				}
			};

			mockedGetBusinessDetails.mockResolvedValue({
				status: "success",
				data: businessDetails
			} as any);

			mockedGetBusinessFactsByKeys.mockResolvedValue(facts);

			const mockBanking = {
				getAllBankingAccounts: jest.fn().mockResolvedValue({
					accounts: [
						{
							id: bankId,
							bank_account: bankingInfo[0].account_number,
							routing_number: bankingInfo[0].routing_number
						}
					]
				})
			};
			MockedBanking.mockImplementation(() => mockBanking as any);

			const result = await converter.createMerchantProfile(params, undefined);

			// Should use facts TIN when business details TIN is null
			expect(result.profile.tin).toBe(facts.tin);
			// Other fact fields should be populated correctly
			expect(result.profile.mcc_code).toBe(facts.mcc_code);
			expect(result.profile.business_website).toBe(facts.business_website);
			expect(result.profile.business_phone).toBe(facts.business_phone);
		});
	});

	describe("toStripeCreateAccountFormat", () => {
		it("should convert merchant profile to Stripe format", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			const result = converter.toStripeCreateAccountFormat(merchantProfile);

			expect(result).toHaveProperty("profileId");
			expect(result).toHaveProperty("customerId");
			expect(result).toHaveProperty("businessId");
			expect(result).toHaveProperty("payload");
			expect(result.payload).toHaveProperty("business_profile");
			expect(result.payload).toHaveProperty("company");
			expect(result.payload).toHaveProperty("business_type", "company");
			expect(result.payload).toHaveProperty("country", "US");
		});

		it("should throw error when stripe context is missing", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			// Remove stripe context
			merchantProfile.profile.stripe = undefined;

			expect(() => converter.toStripeCreateAccountFormat(merchantProfile)).toThrow(
				"Cannot convert to Stripe CreateAccountContext when MerchantProfile does not have Stripe context."
			);
		});

		it("should use real bank account when testMode is false", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const realAccountNumber = merchantProfile.profile.banking_info?.account_number;
			const realRoutingNumber = merchantProfile.profile.banking_info?.routing_number;

			const result = converter.toStripeCreateAccountFormat(merchantProfile, false);

			expect(result.payload.external_account).toBeDefined();
			expect(result.payload.external_account).toHaveProperty("account_number", realAccountNumber);
			expect(result.payload.external_account).toHaveProperty("routing_number", realRoutingNumber);
		});

		it("should use sandbox bank account when testMode is true", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			const result = converter.toStripeCreateAccountFormat(merchantProfile, true);

			expect(result.payload.external_account).toBeDefined();
			expect(result.payload.external_account).toHaveProperty("account_number", "000123456789");
			expect(result.payload.external_account).toHaveProperty("routing_number", "110000000");
			expect(result.payload.external_account).toHaveProperty("object", "bank_account");
			expect(result.payload.external_account).toHaveProperty("country", "US");
			expect(result.payload.external_account).toHaveProperty("currency", "USD");
		});

		it("should not include external_account when banking_info is null", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			merchantProfile.profile.banking_info = null;

			const result = converter.toStripeCreateAccountFormat(merchantProfile, false);

			expect(result.payload.external_account).toBeUndefined();
		});
	});

	describe("toStripeExternalAccountFormat", () => {
		it("should return real bank account details when testMode is false", () => {
			const bankingInfo = generateBankingInfo(1)[0];

			const result = converter.toStripeExternalAccountFormat(bankingInfo, false);

			expect(result).toBeDefined();
			expect(result).toHaveProperty("object", "bank_account");
			expect(result).toHaveProperty("country", "US");
			expect(result).toHaveProperty("currency", "USD");
			expect(result).toHaveProperty("account_number", bankingInfo.account_number);
			expect(result).toHaveProperty("routing_number", bankingInfo.routing_number);
		});

		it("should return sandbox bank account when testMode is true", () => {
			const bankingInfo = generateBankingInfo(1)[0];

			const result = converter.toStripeExternalAccountFormat(bankingInfo, true);

			expect(result).toBeDefined();
			expect(result).toHaveProperty("object", "bank_account");
			expect(result).toHaveProperty("country", "US");
			expect(result).toHaveProperty("currency", "USD");
			expect(result).toHaveProperty("account_number", "000123456789");
			expect(result).toHaveProperty("routing_number", "110000000");
		});

		it("should return null when bankInfo is null", () => {
			const result = converter.toStripeExternalAccountFormat(null, false);

			expect(result).toBeNull();
		});

		it("should return null when account_number and routing_number are missing", () => {
			const bankingInfo = {
				bank_id: randomUUID(),
				account_number: undefined,
				routing_number: undefined,
				country: "US",
				currency: "USD",
				metadata: { bank_type: "checking" }
			} as any;

			const result = converter.toStripeExternalAccountFormat(bankingInfo, false);

			expect(result).toBeNull();
		});

		it("should return null in testMode when bank details are completely missing", () => {
			const bankingInfo = {
				bank_id: randomUUID(),
				account_number: undefined,
				routing_number: undefined,
				country: "US",
				currency: "USD",
				metadata: { bank_type: "checking" }
			} as any;

			const result = converter.toStripeExternalAccountFormat(bankingInfo, true);

			// Even in test mode, if banking info is missing, we return null
			expect(result).toBeNull();
		});
	});

	describe("toStripePersonsContext", () => {
		it("should convert business owners to Stripe persons format", () => {
			const businessDetails = generateBusinessDetails();

			const result = converter.toStripePersonsContext(businessDetails.owners);

			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBe(businessDetails.owners.length);

			const person = result[0];
			expect(person).toHaveProperty("first_name", businessDetails.owners[0].first_name);
			expect(person).toHaveProperty("last_name", businessDetails.owners[0].last_name);
			expect(person).toHaveProperty("address");
			expect(person).toHaveProperty("dob");
			expect(person).toHaveProperty("phone", businessDetails.owners[0].mobile);
			expect(person).toHaveProperty("relationship", {
				owner: true,
				representative: true,
				percent_ownership: businessDetails.owners[0].ownership_percentage,
				title: businessDetails.owners[0].title?.title
			});
			expect(person).toHaveProperty("email", businessDetails.owners[0].email);
			expect(person).toHaveProperty("ssn_last_4", businessDetails.owners[0].ssn?.slice(-4));
		});

		it("should handle empty owners array", () => {
			const result = converter.toStripePersonsContext([]);
			expect(result).toEqual([]);
		});
	});

	describe("toProtectedProfile", () => {
		it("should encrypt banking account number", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const originalAccountNumber = merchantProfile.profile.banking_info!.account_number;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

			expect(protectedProfile.banking_info!.account_number).not.toBe(originalAccountNumber);
			expect(protectedProfile.banking_info!.account_number).toBeTruthy();
		});

		it("should encrypt banking routing number", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const originalRoutingNumber = merchantProfile.profile.banking_info!.routing_number;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

			expect(protectedProfile.banking_info!.routing_number).not.toBe(originalRoutingNumber);
			expect(protectedProfile.banking_info!.routing_number).toBeTruthy();
		});

		it("should encrypt SSN of all owners", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const originalSsn = merchantProfile.profile.people.owners[0].ssn;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

			expect(protectedProfile.people.owners[0].ssn).not.toBe(originalSsn);
			expect(protectedProfile.people.owners[0].ssn).toBeTruthy();
		});

		it("should handle profile with null banking_info", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			merchantProfile.profile.banking_info = null;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

			expect(protectedProfile.banking_info).toBeNull();
		});

		it("should handle profile with empty owners array", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			merchantProfile.profile.people.owners = [];

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

			expect(protectedProfile.people.owners).toEqual([]);
		});

		it("should handle banking_info without account_number", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			delete (merchantProfile.profile.banking_info as any).account_number;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

			expect(protectedProfile.banking_info).toBeDefined();
			expect((protectedProfile.banking_info as any).account_number).toBeUndefined();
		});

		it("should handle banking_info without routing_number", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			delete (merchantProfile.profile.banking_info as any).routing_number;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

			expect(protectedProfile.banking_info).toBeDefined();
			expect((protectedProfile.banking_info as any).routing_number).toBeUndefined();
		});

		it("should handle owners without ssn", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			delete (merchantProfile.profile.people.owners[0] as any).ssn;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

			expect(protectedProfile.people.owners[0]).toBeDefined();
			expect((protectedProfile.people.owners[0] as any).ssn).toBeUndefined();
		});

		it("should encrypt multiple owners SSNs", () => {
			const businessDetails = generateBusinessDetails();
			const profile = {
				business_name: "Test",
				business_website: null,
				business_phone: null,
				address_line_1: "123 Test St",
				address_city: "Test City",
				address_state: "TS",
				address_postal_code: "12345",
				country: "US",
				tin: null,
				mcc_code: null,
				banking_info: null,
				people: { owners: businessDetails.owners }
			};

			const originalSsns = profile.people.owners.map(owner => owner.ssn);

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(profile);

			protectedProfile.people.owners.forEach((owner, index) => {
				expect(owner.ssn).not.toBe(originalSsns[index]);
				expect(owner.ssn).toBeTruthy();
			});
		});
	});

	describe("fromProtectedProfile", () => {
		it("should decrypt banking account number", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const originalAccountNumber = merchantProfile.profile.banking_info!.account_number;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			expect(decryptedProfile.banking_info!.account_number).toBe(originalAccountNumber);
		});

		it("should decrypt banking routing number", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const originalRoutingNumber = merchantProfile.profile.banking_info!.routing_number;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			expect(decryptedProfile.banking_info!.routing_number).toBe(originalRoutingNumber);
		});

		it("should decrypt SSN of all owners", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const originalSsn = merchantProfile.profile.people.owners[0].ssn;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			expect(decryptedProfile.people.owners[0].ssn).toBe(originalSsn);
		});

		it("should handle profile with null banking_info", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			merchantProfile.profile.banking_info = null;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			expect(decryptedProfile.banking_info).toBeNull();
		});

		it("should handle profile with empty owners array", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			merchantProfile.profile.people.owners = [];

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			expect(decryptedProfile.people.owners).toEqual([]);
		});

		it("should handle banking_info without account_number", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			delete (merchantProfile.profile.banking_info as any).account_number;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			expect(decryptedProfile.banking_info).toBeDefined();
			expect((decryptedProfile.banking_info as any).account_number).toBeUndefined();
		});

		it("should handle banking_info without routing_number", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			delete (merchantProfile.profile.banking_info as any).routing_number;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			expect(decryptedProfile.banking_info).toBeDefined();
			expect((decryptedProfile.banking_info as any).routing_number).toBeUndefined();
		});

		it("should handle owners without ssn", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			delete (merchantProfile.profile.people.owners[0] as any).ssn;

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			expect(decryptedProfile.people.owners[0]).toBeDefined();
			expect((decryptedProfile.people.owners[0] as any).ssn).toBeUndefined();
		});

		it("should decrypt multiple owners SSNs", () => {
			const businessDetails = generateBusinessDetails();
			const profile = {
				business_name: "Test",
				business_website: null,
				business_phone: null,
				address_line_1: "123 Test St",
				address_city: "Test City",
				address_state: "TS",
				address_postal_code: "12345",
				country: "US",
				tin: null,
				mcc_code: null,
				banking_info: null,
				people: { owners: businessDetails.owners }
			};

			const originalSsns = profile.people.owners.map(owner => owner.ssn);

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			decryptedProfile.people.owners.forEach((owner, index) => {
				expect(owner.ssn).toBe(originalSsns[index]);
			});
		});

		it("should fully roundtrip encrypt and decrypt profile with all sensitive data", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const originalProfile = JSON.parse(JSON.stringify(merchantProfile.profile)); // Deep clone

			const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);
			const decryptedProfile = MerchantProfileConverter.fromProtectedProfile(protectedProfile);

			// Verify non-sensitive data remains unchanged
			expect(decryptedProfile.business_name).toBe(originalProfile.business_name);
			expect(decryptedProfile.business_website).toBe(originalProfile.business_website);
			expect(decryptedProfile.address_line_1).toBe(originalProfile.address_line_1);

			// Verify sensitive banking data is correctly decrypted
			expect(decryptedProfile.banking_info!.account_number).toBe(originalProfile.banking_info.account_number);
			expect(decryptedProfile.banking_info!.routing_number).toBe(originalProfile.banking_info.routing_number);

			// Verify sensitive owner data is correctly decrypted
			expect(decryptedProfile.people.owners[0].ssn).toBe(originalProfile.people.owners[0].ssn);
		});
	});

	describe("prepareStripeContext", () => {
		it("should prepare stripe context for Stripe platform", () => {
			const capabilities = {
				card_payments: { requested: true },
				transfers: { requested: true },
				us_bank_account_ach_payments: { requested: true }
			};
			const paymentGroupId = "pricing_group_123";

			const result = MerchantProfileConverter.prepareStripeContext(INTEGRATION_ID.STRIPE, capabilities, paymentGroupId);

			expect(result).toBeDefined();
			expect(result?.capabilities).toEqual(capabilities);
			// TODO: Uncomment when payment groups are implemented
			// expect(result?.groups.payments_pricing).toBe(paymentGroupId);
		});

		it("should return undefined for non-Stripe platform", () => {
			const capabilities = {
				card_payments: { requested: true },
				transfers: { requested: true },
				us_bank_account_ach_payments: { requested: true }
			};
			const paymentGroupId = "pricing_group_123";
			const nonStripePlatformId = 999 as IntegrationPlatformId; // Some non-Stripe platform ID

			const result = MerchantProfileConverter.prepareStripeContext(nonStripePlatformId, capabilities, paymentGroupId);

			expect(result).toBeUndefined();
		});

		it("should use default capabilities when not provided", () => {
			const paymentGroupId = "pricing_group_123";

			const result = MerchantProfileConverter.prepareStripeContext(
				INTEGRATION_ID.STRIPE,
				undefined as any,
				paymentGroupId
			);

			expect(result).toBeDefined();
			expect(result?.capabilities).toBeDefined();
			// TODO: Uncomment when payment groups are implemented
			// expect(result?.groups.payments_pricing).toBe(paymentGroupId);
		});
	});

	describe("fromDbWithRelationships", () => {
		it("should create MerchantProfile with accounts from multiple db records", () => {
			const baseRecord = {
				customer_id: randomUUID(),
				business_id: randomUUID(),
				platform_id: INTEGRATION_ID.STRIPE,
				id: randomUUID(),
				profile: {
					business_name: "Test Business",
					business_website: "https://test.com",
					address_line_1: "123 Test St",
					address_city: "Test City",
					address_state: "TS",
					address_postal_code: "12345",
					country: "US",
					tin: "123456789",
					mcc_code: "5734",
					business_phone: "555-0000",
					people: { owners: [] },
					banking_info: null
				},
				created_at: new Date(),
				updated_at: new Date(),
				account: { id: "acct_test1", status: "active" },
				account_id: randomUUID(),
				processor_account_id: "acct_test1",
				status: "active"
			};

			const record2 = {
				...baseRecord,
				account: { id: "acct_test2", status: "pending" },
				account_id: randomUUID(),
				processor_account_id: "acct_test2",
				status: "pending"
			};

			const dbRecords = [baseRecord, record2];

			const merchantProfile = MerchantProfile.fromDbWithRelationships(dbRecords);

			expect(merchantProfile).toBeInstanceOf(MerchantProfile);
			expect(merchantProfile?.customerId).toBe(baseRecord.customer_id);
			expect(merchantProfile?.accounts).toHaveLength(2);
			expect((merchantProfile?.accounts[0] as any).processor_account_id).toBe("acct_test1");
			expect((merchantProfile?.accounts[0] as any).status).toBe("active");
			expect((merchantProfile?.accounts[1] as any).processor_account_id).toBe("acct_test2");
			expect((merchantProfile?.accounts[1] as any).status).toBe("pending");
		});

		it("should return null when dbRecord is undefined", () => {
			const merchantProfile = MerchantProfile.fromDbWithRelationships(undefined);
			expect(merchantProfile).toBeNull();
		});

		it("should return null when dbRecord is empty array", () => {
			const merchantProfile = MerchantProfile.fromDbWithRelationships([]);
			expect(merchantProfile).toBeNull();
		});

		it("should create MerchantProfile without accounts when account property is missing", () => {
			const dbRecord = {
				customer_id: randomUUID(),
				business_id: randomUUID(),
				platform_id: INTEGRATION_ID.STRIPE,
				id: randomUUID(),
				profile: {
					business_name: "Test Business",
					business_website: "https://test.com",
					address_line_1: "123 Test St",
					address_city: "Test City",
					address_state: "TS",
					address_postal_code: "12345",
					country: "US",
					tin: "123456789",
					mcc_code: "5734",
					business_phone: "555-0000",
					people: { owners: [] },
					banking_info: null
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			const merchantProfile = MerchantProfile.fromDbWithRelationships([dbRecord]);

			expect(merchantProfile).toBeInstanceOf(MerchantProfile);
			expect(merchantProfile?.accounts).toHaveLength(0);
		});
	});

	describe("MerchantProfile with accounts", () => {
		it("should initialize MerchantProfile with empty accounts array by default", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, false, false);

			expect(merchantProfile.accounts).toBeDefined();
			expect(merchantProfile.accounts).toEqual([]);
		});

		it("should initialize MerchantProfile with provided accounts", () => {
			const customerId = randomUUID();
			const businessId = randomUUID();
			const accounts = [
				{
					account_id: randomUUID(),
					processor_account_id: "acct_test1",
					status: "active",
					account: { id: "acct_test1" }
				}
			];

			const merchantProfile = new MerchantProfile(
				customerId,
				businessId,
				INTEGRATION_ID.STRIPE,
				{
					business_name: "Test Business",
					business_website: "https://test.com",
					address_line_1: "123 Test St",
					address_city: "Test City",
					address_state: "TS",
					address_postal_code: "12345",
					country: "US",
					tin: "123456789",
					mcc_code: "5734",
					business_phone: "555-0000",
					people: { owners: [] },
					banking_info: null
				},
				randomUUID(),
				new Date(),
				new Date(),
				accounts
			);

			expect(merchantProfile.accounts).toEqual(accounts);
			expect(merchantProfile.accounts).toHaveLength(1);
		});

		it("should include accounts in toApiResponse", () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			merchantProfile.accounts = [
				{
					account_id: randomUUID(),
					processor_account_id: "acct_test1",
					status: "active",
					account: { id: "acct_test1" }
				}
			];

			const apiResponse = merchantProfile.toApiResponse();

			expect(apiResponse.accounts).toBeDefined();
			expect(apiResponse.accounts).toHaveLength(1);
			expect((apiResponse.accounts[0] as any).processor_account_id).toBe("acct_test1");
		});
	});

	describe("isReadyToOnboard", () => {
		it("should return ready true when case status is not in NOT_READY_TO_ONBOARD_STATUSES", async () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const caseStatusDetails = generateCaseStatusDetails("APPROVED");

			mockedGetInternalCaseByBusinessId.mockResolvedValue([caseStatusDetails]);

			const result = await merchantProfile.isReadyToOnboard();

			expect(result.ready).toBe(true);
			expect(result.reason).toBeNull();
			expect(mockedGetInternalCaseByBusinessId).toHaveBeenCalledWith(merchantProfile.businessId);
		});

		it("should return ready false when case status is INVITED", async () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const caseStatusDetails = generateCaseStatusDetails("INVITED");

			mockedGetInternalCaseByBusinessId.mockResolvedValue([caseStatusDetails]);

			const result = await merchantProfile.isReadyToOnboard();

			expect(result.ready).toBe(false);
			expect(result.reason).toBe("INVITED");
		});

		it("should return ready false when case status is ONBOARDING", async () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const caseStatusDetails = generateCaseStatusDetails("ONBOARDING");

			mockedGetInternalCaseByBusinessId.mockResolvedValue([caseStatusDetails]);

			const result = await merchantProfile.isReadyToOnboard();

			expect(result.ready).toBe(false);
			expect(result.reason).toBe("ONBOARDING");
		});

		it("should return ready false when case status is CREATED", async () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const caseStatusDetails = generateCaseStatusDetails("CREATED");

			mockedGetInternalCaseByBusinessId.mockResolvedValue([caseStatusDetails]);

			const result = await merchantProfile.isReadyToOnboard();

			expect(result.ready).toBe(false);
			expect(result.reason).toBe("CREATED");
		});

		it("should return ready false when no case found for business", async () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			mockedGetInternalCaseByBusinessId.mockResolvedValue([]);

			const result = await merchantProfile.isReadyToOnboard();

			expect(result.ready).toBe(false);
			expect(result.reason).toBe("No case found for business");
		});

		it("should handle errors gracefully when case status fetch fails", async () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			mockedGetInternalCaseByBusinessId.mockRejectedValue(new Error("API error"));

			const result = await merchantProfile.isReadyToOnboard();

			expect(result.ready).toBe(false);
			expect(result.reason).toBe("No case found for business");
		});

		it("should return the most recent case when multiple cases are returned", async () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			// Create cases with different timestamps
			const olderCase = generateCaseStatusDetails("INVITED");
			olderCase.created_at = new Date("2024-01-01").toISOString() as any;

			const newerCase = generateCaseStatusDetails("APPROVED");
			newerCase.created_at = new Date("2024-12-01").toISOString() as any;

			const oldestCase = generateCaseStatusDetails("CREATED");
			oldestCase.created_at = new Date("2023-01-01").toISOString() as any;

			// Return cases in non-chronological order to test the reduce logic
			mockedGetInternalCaseByBusinessId.mockResolvedValue([olderCase, newerCase, oldestCase]);

			const result = await merchantProfile.isReadyToOnboard();

			// Verify the function was called
			expect(mockedGetInternalCaseByBusinessId).toHaveBeenCalledWith(merchantProfile.businessId);

			// Should use the most recent case (APPROVED from 2024-12-01), not the older ones
			// If it used olderCase (INVITED) or oldestCase (CREATED), ready would be false
			expect(result.ready).toBe(true);
			expect(result.reason).toBeNull();
		});

		it("should return not ready when most recent case has restricted status", async () => {
			const [merchantProfile] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			// Create cases with different timestamps
			const olderCase = generateCaseStatusDetails("APPROVED");
			olderCase.created_at = new Date("2024-01-01").toISOString() as any;

			const newerCase = generateCaseStatusDetails("ONBOARDING");
			newerCase.created_at = new Date("2024-12-01").toISOString() as any;

			mockedGetInternalCaseByBusinessId.mockResolvedValue([olderCase, newerCase]);

			const result = await merchantProfile.isReadyToOnboard();

			// Verify the function was called
			expect(mockedGetInternalCaseByBusinessId).toHaveBeenCalledWith(merchantProfile.businessId);

			// Should use the most recent case (ONBOARDING from 2024-12-01), not the older APPROVED
			// This confirms the latest case is used even when an older case would allow onboarding
			expect(result.ready).toBe(false);
			expect(result.reason).toBe("ONBOARDING");
		});
	});

	describe("gatherMerchantProfileOnboardContext", () => {
		it("should separate profiles into ready and not ready for onboarding", async () => {
			const merchantProfiles = generateMerchantProfiles(3, INTEGRATION_ID.STRIPE, true, true);

			// Mock case status for each profile
			mockedGetInternalCaseByBusinessId
				.mockResolvedValueOnce([generateCaseStatusDetails("APPROVED")]) // Profile 0: ready
				.mockResolvedValueOnce([generateCaseStatusDetails("INVITED")]) // Profile 1: not ready
				.mockResolvedValueOnce([generateCaseStatusDetails("ONBOARDING")]); // Profile 2: not ready

			const context = await MerchantProfile.gatherMerchantProfileOnboardContext(merchantProfiles);

			expect(context.profilesReadyToOnboard).toHaveLength(1);
			expect(context.profilesNotReadyToOnboard).toHaveLength(2);
			expect(context.profilesReadyToOnboard[0]).toBe(merchantProfiles[0]);
			expect(context.profilesNotReadyToOnboard[0].profile).toBe(merchantProfiles[1]);
			expect(context.profilesNotReadyToOnboard[0].reason).toBe("INVITED");
			expect(context.profilesNotReadyToOnboard[1].profile).toBe(merchantProfiles[2]);
			expect(context.profilesNotReadyToOnboard[1].reason).toBe("ONBOARDING");
		});

		it("should force all profiles to be ready when force=true", async () => {
			const merchantProfiles = generateMerchantProfiles(3, INTEGRATION_ID.STRIPE, true, true);

			// When force=true, case status shouldn't be checked at all
			const context = await MerchantProfile.gatherMerchantProfileOnboardContext(merchantProfiles, true);

			expect(context.profilesReadyToOnboard).toHaveLength(3);
			expect(context.profilesNotReadyToOnboard).toHaveLength(0);
			expect(context.profilesReadyToOnboard[0]).toBe(merchantProfiles[0]);
			expect(context.profilesReadyToOnboard[1]).toBe(merchantProfiles[1]);
			expect(context.profilesReadyToOnboard[2]).toBe(merchantProfiles[2]);
			// Ensure the case status wasn't checked when force=true
			expect(mockedGetInternalCaseByBusinessId).not.toHaveBeenCalled();
		});

		it("should respect case status when force=false (default)", async () => {
			const merchantProfiles = generateMerchantProfiles(2, INTEGRATION_ID.STRIPE, true, true);

			mockedGetInternalCaseByBusinessId
				.mockResolvedValueOnce([generateCaseStatusDetails("APPROVED")])
				.mockResolvedValueOnce([generateCaseStatusDetails("INVITED")]);

			const context = await MerchantProfile.gatherMerchantProfileOnboardContext(merchantProfiles, false);

			expect(context.profilesReadyToOnboard).toHaveLength(1);
			expect(context.profilesNotReadyToOnboard).toHaveLength(1);
			expect(mockedGetInternalCaseByBusinessId).toHaveBeenCalledTimes(2);
		});

		it("should mark all profiles as ready when all have approved status", async () => {
			const merchantProfiles = generateMerchantProfiles(2, INTEGRATION_ID.STRIPE, true, true);

			mockedGetInternalCaseByBusinessId
				.mockResolvedValueOnce([generateCaseStatusDetails("APPROVED")])
				.mockResolvedValueOnce([generateCaseStatusDetails("APPROVED")]);

			const context = await MerchantProfile.gatherMerchantProfileOnboardContext(merchantProfiles);

			expect(context.profilesReadyToOnboard).toHaveLength(2);
			expect(context.profilesNotReadyToOnboard).toHaveLength(0);
			expect(context.profilesReadyToOnboard[0]).toBe(merchantProfiles[0]);
			expect(context.profilesReadyToOnboard[1]).toBe(merchantProfiles[1]);
		});

		it("should mark all profiles as not ready when all have restricted statuses", async () => {
			const merchantProfiles = generateMerchantProfiles(2, INTEGRATION_ID.STRIPE, true, true);

			mockedGetInternalCaseByBusinessId
				.mockResolvedValueOnce([generateCaseStatusDetails("INVITED")])
				.mockResolvedValueOnce([generateCaseStatusDetails("CREATED")]);

			const context = await MerchantProfile.gatherMerchantProfileOnboardContext(merchantProfiles);

			expect(context.profilesReadyToOnboard).toHaveLength(0);
			expect(context.profilesNotReadyToOnboard).toHaveLength(2);
			expect(context.profilesNotReadyToOnboard[0].reason).toBe("INVITED");
			expect(context.profilesNotReadyToOnboard[1].reason).toBe("CREATED");
		});

		it("should handle profiles with no case status", async () => {
			const merchantProfiles = generateMerchantProfiles(2, INTEGRATION_ID.STRIPE, true, true);

			mockedGetInternalCaseByBusinessId.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

			const context = await MerchantProfile.gatherMerchantProfileOnboardContext(merchantProfiles);

			expect(context.profilesReadyToOnboard).toHaveLength(0);
			expect(context.profilesNotReadyToOnboard).toHaveLength(2);
			expect(context.profilesNotReadyToOnboard[0].reason).toBe("No case found for business");
			expect(context.profilesNotReadyToOnboard[1].reason).toBe("No case found for business");
		});

		it("should handle empty array of merchant profiles", async () => {
			const context = await MerchantProfile.gatherMerchantProfileOnboardContext([]);

			expect(context.profilesReadyToOnboard).toHaveLength(0);
			expect(context.profilesNotReadyToOnboard).toHaveLength(0);
		});

		it("should handle mixed statuses including errors", async () => {
			const merchantProfiles = generateMerchantProfiles(3, INTEGRATION_ID.STRIPE, true, true);

			mockedGetInternalCaseByBusinessId
				.mockResolvedValueOnce([generateCaseStatusDetails("APPROVED")])
				.mockRejectedValueOnce(new Error("API error"))
				.mockResolvedValueOnce([generateCaseStatusDetails("INVITED")]);

			const context = await MerchantProfile.gatherMerchantProfileOnboardContext(merchantProfiles);

			expect(context.profilesReadyToOnboard).toHaveLength(1);
			expect(context.profilesNotReadyToOnboard).toHaveLength(2);
			expect(context.profilesReadyToOnboard[0]).toBe(merchantProfiles[0]);
			expect(context.profilesNotReadyToOnboard[0].reason).toBe("No case found for business");
			expect(context.profilesNotReadyToOnboard[1].reason).toBe("INVITED");
		});
	});
});
