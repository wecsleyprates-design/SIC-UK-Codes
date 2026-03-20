/**
 * @fileoverview
 * This file contains the handler map for the payment processors.
 * Each handler is meant as a stateless event handler or business logic implementation for a given
 * payment processor  -- pure API calls should live inside the API Adapter
 * The handler map is used to determine which handler to use for a given payment processor.
 *
 * The handler map is a partial record of the payment processors, with the key being the integration ID
 * and the value being the handler instance.
 */
import { INTEGRATION_ID } from "#constants";
import { StripeHandler } from "./stripeHandler";
import type { PaymentProcessorHandler } from "./types";

// Each handler can be stateful if needed, but should avoid sharing mutable adapter state.
export const paymentProcessorHandlerMap: Partial<Record<number, PaymentProcessorHandler>> = {
	[INTEGRATION_ID.STRIPE]: new StripeHandler()
};

export type { PaymentProcessorHandler } from "./types";
