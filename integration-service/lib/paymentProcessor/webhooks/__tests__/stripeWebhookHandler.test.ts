import type Stripe from "stripe";
import { stripeWebhookHandler } from "../stripeWebhookHandler";
import { PaymentProcessorAccountRepository } from "../../repositories/paymentProcessorAccountRepository";
import type { PaymentProcessorService } from "../../paymentProcessorService";

const findByAccountIdMock = jest.fn();
jest.mock("../../repositories/paymentProcessorAccountRepository");

const buildEvent = (overrides: Partial<Stripe.Event> = {}): Stripe.Event =>
	({
		id: "evt_123",
		object: "event",
		api_version: "2020-08-27",
		created: Date.now(),
		data: {
			object: {
				id: "acct_test",
				object: "account"
			}
		},
		livemode: false,
		pending_webhooks: 1,
		request: {
			id: null,
			idempotency_key: null
		},
		type: "account.updated",
		...overrides
	}) as Stripe.Event;

describe("stripeWebhookHandler", () => {
	const paymentProcessorService = {
		processorId: "proc_123",
		syncAccountStatus: jest.fn()
	} as unknown as PaymentProcessorService;

	beforeEach(() => {
		jest.clearAllMocks();
		(findByAccountIdMock as jest.Mock).mockReset();
		(paymentProcessorService.syncAccountStatus as jest.Mock).mockReset();
		(
			PaymentProcessorAccountRepository as jest.MockedClass<typeof PaymentProcessorAccountRepository>
		).mockImplementation(
			() =>
				({
					findByAccountId: findByAccountIdMock
				}) as any
		);
	});

	it("syncs status when matching account exists", async () => {
		(findByAccountIdMock as jest.Mock).mockResolvedValue({
			id: "uuid-account",
			processor_id: "proc_123"
		});
		const event = buildEvent();

		const result = await stripeWebhookHandler({
			event,
			type: event.type,
			paymentProcessorService
		});

		expect(findByAccountIdMock).toHaveBeenCalledWith("acct_test");
		expect(paymentProcessorService.syncAccountStatus).toHaveBeenCalledWith("uuid-account", "webhook");
		expect(result).toBe(true);
	});

	it("returns false when syncing status throws", async () => {
		(findByAccountIdMock as jest.Mock).mockResolvedValue({
			id: "uuid-account",
			processor_id: "proc_123"
		});
		(paymentProcessorService.syncAccountStatus as jest.Mock).mockRejectedValue(new Error("sync failed"));
		const event = buildEvent();

		const result = await stripeWebhookHandler({
			event,
			type: event.type,
			paymentProcessorService
		});

		expect(paymentProcessorService.syncAccountStatus).toHaveBeenCalledWith("uuid-account", "webhook");
		expect(result).toBe(false);
	});

	it("returns false when account record not found", async () => {
		(findByAccountIdMock as jest.Mock).mockResolvedValue(null);
		const event = buildEvent();

		const result = await stripeWebhookHandler({
			event,
			type: event.type,
			paymentProcessorService
		});

		expect(paymentProcessorService.syncAccountStatus).not.toHaveBeenCalled();
		expect(result).toBe(false);
	});

	it("returns false when account belongs to different processor", async () => {
		(findByAccountIdMock as jest.Mock).mockResolvedValue({
			id: "uuid-account",
			processorId: "other_proc"
		});
		const event = buildEvent();

		const result = await stripeWebhookHandler({
			event,
			type: event.type,
			paymentProcessorService
		});

		expect(paymentProcessorService.syncAccountStatus).not.toHaveBeenCalled();
		expect(result).toBe(false);
	});

	it("returns early when payload is not account object", async () => {
		const event = buildEvent({ data: { object: { object: "setup_intent" } as any } });

		const result = await stripeWebhookHandler({
			event,
			type: event.type,
			paymentProcessorService
		});

		expect(findByAccountIdMock).not.toHaveBeenCalled();
		expect(result).toBe(false);
	});
});
