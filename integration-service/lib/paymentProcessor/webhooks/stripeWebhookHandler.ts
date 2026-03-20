import type Stripe from "stripe";
import { logger } from "#helpers";
import type { ProcessorWebhookHandler } from "./types";
import { PaymentProcessorAccountRepository } from "../repositories/paymentProcessorAccountRepository";
import { isStripeAccount } from "../helpers/stripe";
import type { PaymentProcessorService } from "../paymentProcessorService";
import type { UUID } from "crypto";

export const stripeWebhookHandler: ProcessorWebhookHandler<Stripe.Event, Stripe.Event["type"], boolean> = async ({
	event,
	type,
	paymentProcessorService
}) => {
	switch (type) {
		case "account.updated":
			return await handleAccountUpdate(event, paymentProcessorService);
		default:
			logger.debug({ type }, "Stripe webhook skipped: unsupported event type");
			return false;
	}
};

async function handleAccountUpdate(event: Stripe.Event, paymentProcessorService: PaymentProcessorService) {
	const accountRepository = new PaymentProcessorAccountRepository();
	const accountPayload = event?.data?.object;
	if (!isStripeAccount(accountPayload)) {
		logger.debug({ event }, "Stripe webhook skipped: payload is not an account object");
		return false;
	}

	try {
		const existingAccount = await accountRepository.findByAccountId(accountPayload.id);
		if (!existingAccount?.id || existingAccount?.processor_id !== paymentProcessorService.processorId) {
			logger.warn(
				{
					event,
					existingAccount,
					processorId: paymentProcessorService.processorId
				},
				"Stripe webhook skipped: account not found"
			);
			return false;
		}
		await paymentProcessorService.syncAccountStatus(existingAccount.id as UUID, "webhook");
	} catch (error) {
		logger.error({ error }, "Error syncing Stripe account status");
		return false;
	}
	return true;
}
