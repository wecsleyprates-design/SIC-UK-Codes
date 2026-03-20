import { SecretsManagerService } from "#api/v1/modules/secrets/secrets";
import { SecretData } from "#types";
import { StripeAPIAdapterConfig } from "./adapters/stripeAPIAdapter";
import { logger } from "#helpers";
import { SECRET_PATH } from "#constants/secrets.constant";
import type { UUID } from "crypto";
import { INTEGRATION_ID, type IntegrationPlatformId } from "#constants";

export class PaymentProcessorSecretsService extends SecretsManagerService {
	private readonly customerId: string;
	private readonly processorId: UUID;

	constructor(customerId: UUID, processorID: UUID) {
		super();
		this.customerId = customerId;
		this.processorId = processorID;
	}
	protected generateSecretName(customerId: string): string {
		return `${SECRET_PATH.PREFIX}/${customerId}/paymentProcessor@${this.processorId}`;
	}

	async setStripeAPIKeys(params: StripeAPIAdapterConfig): Promise<boolean> {
		if (await this.secretExists(this.customerId)) {
			return this.updateStripeAPIKeys(params);
		}

		const secretBody = JSON.stringify(params);

		const secretData: SecretData = {
			customer_id: this.customerId,
			storage_data: secretBody
		};

		try {
			await this.createSecret(secretData);
		} catch (error) {
			// Handle error appropriately
			logger.error({ error }, "Error creating secret");
			return false;
		}
		return true;
	}

	async updateStripeAPIKeys(params: Partial<StripeAPIAdapterConfig>): Promise<boolean> {
		const currentSecret = (await this.getStripeConfig()) ?? {};
		const updatedParams: StripeAPIAdapterConfig = { ...currentSecret, ...params } as StripeAPIAdapterConfig;

		const secretBody = JSON.stringify(updatedParams);

		const secretData: SecretData = {
			customer_id: this.customerId,
			storage_data: secretBody
		};

		try {
			await this.updateSecret(this.customerId, secretData);
		} catch (error) {
			logger.error({ error }, "Error updating secret");
			return false;
		}
		return true;
	}

	async getStripeConfig(): Promise<StripeAPIAdapterConfig | null> {
		try {
			const secretResult = await this.getSecret(this.customerId);

			if (secretResult && secretResult.storage_data) {
				const secretData = JSON.parse(secretResult.storage_data);
				return {
					stripePublishableKey: secretData.stripePublishableKey,
					stripeSecretKey: secretData.stripeSecretKey,
					stripeWebhookSecret: secretData.stripeWebhookSecret,
					processorId: this.processorId,
					platformId: INTEGRATION_ID.STRIPE as IntegrationPlatformId
				};
			}
		} catch (error) {
			logger.error({ error }, "Error retrieving secret");
		}
		return null;
	}
}
