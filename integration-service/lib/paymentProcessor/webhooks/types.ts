import type { IntegrationPlatformId } from "#constants";
import type { PaymentProcessorService } from "../paymentProcessorService";

export type ProcessorWebhookHandlerParams<TEvent = unknown, TType = string> = {
	event: TEvent;
	type?: TType;
	paymentProcessorService: PaymentProcessorService;
};

export type ProcessorWebhookHandler<TEvent = any, TType = string, TResult = any> = (
	params: ProcessorWebhookHandlerParams<TEvent, TType>
) => Promise<TResult>;

export type ProcessorWebhookHandlerMap = Partial<Record<IntegrationPlatformId, ProcessorWebhookHandler<any, any, any>>>;
