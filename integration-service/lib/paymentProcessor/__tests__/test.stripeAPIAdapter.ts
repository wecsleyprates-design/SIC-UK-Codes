import { StripeAPIAdapter, StripeAPIAdapterConfig } from "../adapters/stripeAPIAdapter";
import { MerchantProfile } from "../merchantProfile";
import { generateMerchantProfiles } from "./test.utils";
import { INTEGRATION_ID } from "#constants";
import { randomUUID } from "crypto";
import { envConfig } from "#configs";
import Stripe from "stripe";
import type { PaymentProcessorAccount } from "../repositories/paymentProcessorAccountRepository";
import { stripeAccountSessionComponents } from "../stripe.constants";

describe("StripeAPIAdapter", () => {
	const processorId = "00000000-0000-0000-2222-000000000000";
	let adapter: StripeAPIAdapter;
	let customerId: string;
	const testConfig: StripeAPIAdapterConfig = {
		platformId: INTEGRATION_ID.STRIPE,
		stripePublishableKey: (envConfig.STRIPE_PUBLIC_KEY as string) || "pk_test_1234567890",
		stripeSecretKey: (envConfig.STRIPE_SECRET_KEY as string) || "sk_test_1234567890",
		stripeWebhookSecret: null,
		processorId
	};

	beforeEach(() => {
		customerId = randomUUID();
		adapter = new StripeAPIAdapter(customerId as any, testConfig);
	});

	describe("createAPIAdapter", () => {
		it("should create an instance of StripeAPIAdapter with provided config", () => {
			const customAdapter = new StripeAPIAdapter(customerId as any, testConfig);
			expect(customAdapter).toBeInstanceOf(StripeAPIAdapter);
			expect(customAdapter.usedCustomerCredentials).toBe(true);
		});

		it("should set testMode to true when using test secret key", () => {
			const testSecretConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_test_1234567890abcdef"
			};
			const customAdapter = new StripeAPIAdapter(customerId as any, testSecretConfig);
			expect(customAdapter.testMode).toBe(true);
		});

		it("should set testMode to false when using live secret key", () => {
			const liveSecretConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_live_1234567890abcdef"
			};
			const customAdapter = new StripeAPIAdapter(customerId as any, liveSecretConfig);
			expect(customAdapter.testMode).toBe(false);
		});

		it("should set testMode based on env config when no custom credentials provided", () => {
			const envConfigWithoutCustomCreds: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: null
			};
			const customAdapter = new StripeAPIAdapter(customerId as any, envConfigWithoutCustomCreds);
			expect(customAdapter.usedCustomerCredentials).toBe(false);
			// testMode should be set based on whether envConfig.STRIPE_SECRET_KEY includes "test"
			const expectedTestMode = (envConfig.STRIPE_SECRET_KEY as string)?.includes("test") ?? false;
			expect(customAdapter.testMode).toBe(expectedTestMode);
		});

		it("should use customer credentials and set testMode correctly", () => {
			const customerTestConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_test_customer_key"
			};
			const customAdapter = new StripeAPIAdapter(customerId as any, customerTestConfig);
			expect(customAdapter.usedCustomerCredentials).toBe(true);
			expect(customAdapter.testMode).toBe(true);
		});
	});

	describe("createAccount", () => {
		it("should handle success and failure cases when creating Stripe accounts", async () => {
			// Mock Stripe Client to throw an error for one profile
			(adapter as any).client.accounts.create = jest
				.fn()
				.mockImplementationOnce(() => Promise.resolve({ id: "acct_1" }))
				.mockImplementationOnce(() => {
					throw new Error("Stripe API error");
				});

			const merchantProfiles: MerchantProfile[] = generateMerchantProfiles(2, INTEGRATION_ID.STRIPE, true);
			const [accounts, failedBusinessIds] = await adapter.createAccount(merchantProfiles);

			expect(adapter.client.accounts.create).toHaveBeenCalledTimes(2);
			expect(accounts.length).toBe(1);
			expect(failedBusinessIds.length).toBe(1);
			expect(accounts[0].profileId).toBe(merchantProfiles[0].profileId);
			expect(failedBusinessIds[0]).toBe(merchantProfiles[1].businessId);
		});

		it("should pass testMode to merchant profile when creating accounts", async () => {
			const testModeConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_test_testmode_key"
			};
			const testAdapter = new StripeAPIAdapter(customerId as any, testModeConfig);

			// Spy on toStripeCreateAccountFormat to verify testMode is passed
			const merchantProfiles: MerchantProfile[] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const toStripeFormatSpy = jest.spyOn(merchantProfiles[0], "toStripeCreateAccountFormat");

			(testAdapter as any).client.accounts.create = jest.fn().mockResolvedValue({ id: "acct_test" });

			await testAdapter.createAccount(merchantProfiles);

			expect(toStripeFormatSpy).toHaveBeenCalledWith(true);
			expect(testAdapter.testMode).toBe(true);
		});

		it("should use sandbox bank account in test mode", async () => {
			const testModeConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_test_sandbox_key"
			};
			const testAdapter = new StripeAPIAdapter(customerId as any, testModeConfig);

			const merchantProfiles: MerchantProfile[] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);

			let capturedPayload: any;
			(testAdapter as any).client.accounts.create = jest.fn().mockImplementation(payload => {
				capturedPayload = payload;
				return Promise.resolve({ id: "acct_test" });
			});

			await testAdapter.createAccount(merchantProfiles);

			expect(testAdapter.testMode).toBe(true);
			expect(capturedPayload.external_account).toBeDefined();
			expect(capturedPayload.external_account.account_number).toBe("000123456789");
			expect(capturedPayload.external_account.routing_number).toBe("110000000");
		});

		it("should use real bank account in live mode", async () => {
			const liveModeConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_live_production_key"
			};
			const liveAdapter = new StripeAPIAdapter(customerId as any, liveModeConfig);

			const merchantProfiles: MerchantProfile[] = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true);
			const realAccountNumber = merchantProfiles[0].profile.banking_info?.account_number;
			const realRoutingNumber = merchantProfiles[0].profile.banking_info?.routing_number;

			let capturedPayload: any;
			(liveAdapter as any).client.accounts.create = jest.fn().mockImplementation(payload => {
				capturedPayload = payload;
				return Promise.resolve({ id: "acct_live" });
			});

			await liveAdapter.createAccount(merchantProfiles);

			expect(liveAdapter.testMode).toBe(false);
			expect(capturedPayload.external_account).toBeDefined();
			expect(capturedPayload.external_account.account_number).toBe(realAccountNumber);
			expect(capturedPayload.external_account.routing_number).toBe(realRoutingNumber);
		});
	});

	describe("attachPersonsToAccount", () => {
		it("should handle success and failure cases when attaching persons to Stripe accounts", async () => {
			// Mock Stripe Client to throw an error for one person
			(adapter as any).client.accounts.createPerson = jest
				.fn()
				.mockImplementationOnce(() => Promise.resolve({ id: "person_1" }))
				.mockImplementationOnce(() => {
					throw new Error("Stripe API error");
				});
			(adapter as any).client.accounts.retrieve = jest
				.fn()
				.mockImplementationOnce(() => Promise.resolve({ id: "acct_1" }));

			const merchantProfile: MerchantProfile = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true)[0];
			const accountInfo = await adapter.attachPersonsToAccount(merchantProfile, "acct_1");
			expect(accountInfo.profileId).toBe(merchantProfile.profileId);
			expect(accountInfo.accountId).toBe("acct_1");
			expect(accountInfo.data.id).toBe("acct_1");
			expect(accountInfo.customerId).toBe(customerId);
			expect((adapter as any).client.accounts.createPerson).toHaveBeenCalledTimes(1);
		});
	});

	describe("attachExternalAccountToAccount", () => {
		it("should attach external account and pass testMode correctly", async () => {
			const testModeConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_test_external_account_key"
			};
			const testAdapter = new StripeAPIAdapter(customerId as any, testModeConfig);

			const merchantProfile: MerchantProfile = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true)[0];
			const toStripeExternalAccountSpy = jest.spyOn(merchantProfile, "toStripeExternalAccountFormat");

			(testAdapter as any).client.accounts.createExternalAccount = jest.fn().mockResolvedValue({ id: "ba_test" });
			(testAdapter as any).client.accounts.retrieve = jest.fn().mockResolvedValue({ id: "acct_test" });

			await testAdapter.attachExternalAccountToAccount(merchantProfile, "acct_test");

			expect(toStripeExternalAccountSpy).toHaveBeenCalledWith({ testMode: true });
			expect(testAdapter.testMode).toBe(true);
		});

		it("should use sandbox bank account when attaching in test mode", async () => {
			const testModeConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_test_attach_sandbox"
			};
			const testAdapter = new StripeAPIAdapter(customerId as any, testModeConfig);

			const merchantProfile: MerchantProfile = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true)[0];

			let capturedExternalAccount: any;
			(testAdapter as any).client.accounts.createExternalAccount = jest.fn().mockImplementation((accountId, params) => {
				capturedExternalAccount = params.external_account;
				return Promise.resolve({ id: "ba_test" });
			});
			(testAdapter as any).client.accounts.retrieve = jest.fn().mockResolvedValue({ id: "acct_test" });

			await testAdapter.attachExternalAccountToAccount(merchantProfile, "acct_test");

			expect(testAdapter.testMode).toBe(true);
			expect(capturedExternalAccount).toBeDefined();
			expect(capturedExternalAccount.account_number).toBe("000123456789");
			expect(capturedExternalAccount.routing_number).toBe("110000000");
		});

		it("should use real bank account when attaching in live mode", async () => {
			const liveModeConfig: StripeAPIAdapterConfig = {
				...testConfig,
				stripeSecretKey: "sk_live_attach_real"
			};
			const liveAdapter = new StripeAPIAdapter(customerId as any, liveModeConfig);

			const merchantProfile: MerchantProfile = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true)[0];
			const realAccountNumber = merchantProfile.profile.banking_info?.account_number;
			const realRoutingNumber = merchantProfile.profile.banking_info?.routing_number;

			let capturedExternalAccount: any;
			(liveAdapter as any).client.accounts.createExternalAccount = jest.fn().mockImplementation((accountId, params) => {
				capturedExternalAccount = params.external_account;
				return Promise.resolve({ id: "ba_live" });
			});
			(liveAdapter as any).client.accounts.retrieve = jest.fn().mockResolvedValue({ id: "acct_live" });

			await liveAdapter.attachExternalAccountToAccount(merchantProfile, "acct_live");

			expect(liveAdapter.testMode).toBe(false);
			expect(capturedExternalAccount).toBeDefined();
			expect(capturedExternalAccount.account_number).toBe(realAccountNumber);
			expect(capturedExternalAccount.routing_number).toBe(realRoutingNumber);
		});

		it("should return null when merchant profile has no banking info", async () => {
			const merchantProfile: MerchantProfile = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true)[0];
			merchantProfile.profile.banking_info = null;

			const result = await adapter.attachExternalAccountToAccount(merchantProfile, "acct_test");

			expect(result).toBeNull();
		});
	});

	describe("getProcessorSession", () => {
		it("should call Stripe accountSessions.create with required params", async () => {
			const processorAccount = {
				account_id: "acct_123",
				account: { object: "account" }
			} as unknown as PaymentProcessorAccount<Stripe.Account>;
			const mockSession = { id: "sess_123" };
			(adapter as any).client.accountSessions = {
				create: jest.fn().mockResolvedValue(mockSession)
			};

			const session = await adapter.getProcessorSession(processorAccount);

			expect((adapter as any).client.accountSessions.create).toHaveBeenCalledWith({
				account: "acct_123",
				components: expect.objectContaining(stripeAccountSessionComponents)
			});
			expect(session).toBe(mockSession);
		});
	});
});
