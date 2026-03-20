import { StripeHandler } from "../stripeHandler";
import { PaymentProcessorError } from "../../paymentProcessorError";
import type { StripeAPIAdapter } from "../../adapters/stripeAPIAdapter";
import type { PaymentProcessor } from "../../repositories/paymentProcessorRepository";
import type { PaymentProcessorAccount } from "../../repositories/paymentProcessorAccountRepository";
import type { PaymentProcessorSecretsService } from "../../paymentProcessorSecretsService";
import { kafkaEvents, kafkaTopics, INTEGRATION_ID } from "#constants";

const mockProducerSend = jest.fn();
const mockGetOnboardingCaseByBusinessId = jest.fn();
const mockInternalGetCaseByID = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("#helpers", () => {
	return {
		producer: {
			send: (...args: any[]) => mockProducerSend(...args)
		},
		getOnboardingCaseByBusinessId: (...args: any[]) => mockGetOnboardingCaseByBusinessId(...args),
		internalGetCaseByID: (...args: any[]) => mockInternalGetCaseByID(...args),
		logger: {
			error: (...args: any[]) => mockLoggerError(...args)
		}
	};
});

jest.mock("#api/v1/modules/banking/models", () => ({
	BankAccount: {
		findByBusinessId: jest.fn().mockResolvedValue([])
	}
}));

describe("StripeHandler", () => {
	let handler: StripeHandler;
	let mockClient: jest.Mocked<StripeAPIAdapter>;
	let mockSecrets: jest.Mocked<PaymentProcessorSecretsService>;
	let processor: PaymentProcessor;

	beforeEach(() => {
		jest.clearAllMocks();
		handler = new StripeHandler();
		mockClient = {
			checkCredentials: jest.fn()
		} as any;
		mockSecrets = {
			updateStripeAPIKeys: jest.fn()
		} as any;
		processor = {
			id: "proc-1",
			customer_id: "cust-1",
			platform_id: INTEGRATION_ID.STRIPE,
			metadata: {
				account: { id: "acct_123" }
			}
		} as any;
	});

	describe("validateAndPersistCredentials", () => {
		it("persists keys when valid and account matches", async () => {
			mockClient.checkCredentials.mockResolvedValue([true, { object: "account", id: "acct_123" }]);

			await handler.validateAndPersistCredentials({
				processor,
				platformOptions: { publishable_key: "pk", secret_key: "sk" },
				client: mockClient,
				secrets: mockSecrets
			});

			expect(mockClient.checkCredentials).toHaveBeenCalledWith({ publishable_key: "pk", secret_key: "sk" });
			expect(mockSecrets.updateStripeAPIKeys).toHaveBeenCalledWith({
				stripePublishableKey: "pk",
				stripeSecretKey: "sk"
			});
		});

		it("throws when credentials invalid", async () => {
			mockClient.checkCredentials.mockResolvedValue([false, null]);

			await expect(
				handler.validateAndPersistCredentials({
					processor,
					platformOptions: { publishable_key: "pk", secret_key: "sk" },
					client: mockClient,
					secrets: mockSecrets
				})
			).rejects.toThrow(PaymentProcessorError);
		});

		it("throws when account is not stripe account", async () => {
			mockClient.checkCredentials.mockResolvedValue([true, { object: "not-account" }]);

			await expect(
				handler.validateAndPersistCredentials({
					processor,
					platformOptions: { publishable_key: "pk", secret_key: "sk" },
					client: mockClient,
					secrets: mockSecrets
				})
			).rejects.toThrow("The existing account ID is not a valid Stripe account");
		});

		it("throws when account id mismatches existing processor", async () => {
			mockClient.checkCredentials.mockResolvedValue([true, { object: "account", id: "acct_other" }]);

			await expect(
				handler.validateAndPersistCredentials({
					processor,
					platformOptions: { publishable_key: "pk", secret_key: "sk" },
					client: mockClient,
					secrets: mockSecrets
				})
			).rejects.toThrow("Credentials provided are not the same as the existing account ID");
		});
	});

	describe("onAccountUpdated", () => {
		const baseAccount: PaymentProcessorAccount = {
			id: "ppa-1",
			account_id: "acct_123",
			platform_name: "stripe",
			profile_id: "profile-1",
			business_id: "biz-1",
			customer_id: "cust-1",
			processor_id: "proc-1",
			status: "ACTIVE",
			account: { object: "account", id: "acct_123", charges_enabled: false, payouts_enabled: false },
			created_at: new Date().toISOString() as any,
			updated_at: new Date().toISOString() as any
		} as any;

		beforeEach(() => {
			mockGetOnboardingCaseByBusinessId.mockResolvedValue({ id: "case-1" });
			mockInternalGetCaseByID.mockResolvedValue({ status: { label: "open" } });
		});

		it("emits update event when changes detected", async () => {
			const updatedAccount: PaymentProcessorAccount = {
				...baseAccount,
				account: {
					object: "account",
					id: "acct_123",
					charges_enabled: true,
					payouts_enabled: true,
					external_accounts: { data: [] },
					capabilities: { card_payments: "active" }
				}
			} as any;

			await handler.onAccountUpdated({
				processor,
				originalAccount: baseAccount,
				updatedAccount
			});

			expect(mockProducerSend).toHaveBeenCalled();
			const callArg = mockProducerSend.mock.calls[0][0];
			expect(callArg.topic).toBe(kafkaTopics.NOTIFICATIONS);
			expect(callArg.messages[0].key).toBe("biz-1");
		});
	});
});
