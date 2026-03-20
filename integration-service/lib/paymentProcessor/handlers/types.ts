import type { BaseAPIAdapter } from "../adapters/baseAdapter";
import type { PaymentProcessor } from "../repositories/paymentProcessorRepository";
import type { PaymentProcessorAccount } from "../repositories/paymentProcessorAccountRepository";
import type { PaymentProcessorSecretsService } from "../paymentProcessorSecretsService";

export interface PaymentProcessorHandler<TAdapter extends BaseAPIAdapter = BaseAPIAdapter> {
	validateAndPersistCredentials?(args: {
		processor: PaymentProcessor;
		platformOptions: any;
		client: TAdapter;
		secrets: PaymentProcessorSecretsService;
	}): Promise<void>;

	/**
	 * Fires after the PaymentProcessorAccount is updated
	 * @param args
	 */
	onAccountUpdated?(args: {
		processor: PaymentProcessor;
		originalAccount: PaymentProcessorAccount;
		updatedAccount: PaymentProcessorAccount;
	}): Promise<void>;
}
