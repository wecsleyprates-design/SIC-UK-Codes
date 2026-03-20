import { envConfig } from "#configs/index";
import { logger } from "#helpers/logger";
import { Stripe as StripeAPI } from "stripe";
class Stripe {
	constructor() {}

	private stripe?: StripeAPI;

	private getStripeClient(): StripeAPI {
		if (!this.stripe) {
			if (envConfig.STRIPE_SECRET_KEY === "") {
				logger.error(`Invalid stripe secret key: ${envConfig.STRIPE_SECRET_KEY}`);
			}
			this.stripe = new StripeAPI(envConfig.STRIPE_SECRET_KEY);
		}
		return this.stripe;
	}
	/**
	 * @description This function is used to create a unique stripe customer
	 * @param {string} name: customer name
	 * @param {string} email: customer email
	 * @param {string} idempotencyKey: unique key
	 * @param {object} metadata: optional field. here we can pass extra information related to customer
	 * @returns {object} stripe customer object containing stripe generated customer id
	 */
	async createNewStripeCustomer(name, email, idempotencyKey, metadata?: any) {
		try {
			const customer = await this.getStripeClient().customers.create(
				{
					name,
					email,
					metadata
				},
				{
					idempotencyKey
				}
			);
			return customer;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {Object} payload
	 * @param {String} payload.success_url: The URL the customer will be directed to after the payment or subscription creation is successful.
	 * @param {String} payload.cancel_url: The URL the customer will be directed to if they decide to cancel payment and return to your website.
	 * @param {String} payload.customer_id: The ID of the customer for this session. A new customer will be created unless an existing customer was provided in when the session was created.
	 * @param {Array} payload.line_items: Array of price IDs and their corresponding quantities, these quantities are not adjustable. We need to pass { .... adjustable_quantity: { enabled: false } } to lock it.
	 * @param {Object} payload.metadata: A set of key-value pairs that you can attach to a Checkout Session object. It can be useful for storing additional information about the session in a structured format.
	 * @param {Number} trial_period_days: Integer representing the number of trial period days before the customer is charged for the first time. Has to be at least 1.
	 */
	async createCheckoutSessionSubscription(payload) {
		try {
			const subscriptionData: any = {
				metadata: payload.metadata,
				description: payload.description
			};

			if (payload.trial_period_days) {
				subscriptionData.trial_settings = {
					end_behavior: {
						missing_payment_method: "pause"
					}
				};
				subscriptionData.trial_period_days = payload.trial_period_days;
			}

			const session = await this.getStripeClient().checkout.sessions.create({
				success_url: payload.success_url,
				automatic_tax: { enabled: true },
				cancel_url: payload.cancel_url,
				mode: "subscription",
				customer: payload.customer_id,
				line_items: payload.line_items,
				after_expiration: { recovery: { enabled: false } },
				customer_update: {
					name: "auto",
					address: "auto",
					shipping: "never" // we do not provide shipping
				},
				subscription_data: subscriptionData,
				expand: ["subscription", "invoice"],
				payment_method_collection: "always",
				allow_promotion_codes: true
			});
			return session;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {Object} payload
	 * @param {String} payload.customer_id: The ID of the customer for this session.
	 * @param {String} payload.currency: The currency of the subscription. Defaults to USD.
	 * @param {String} payload.description: An arbitrary string attached to the object. Often useful for displaying to users.
	 * @param {Array<Object>} payload.items: Array of price objects. We do not directly pass product info, the price is already linked to the product.
	 * @param {String} payload.items.price: The ID of the price object.
	 * @param {Object} payload.items.quantity: The quantity of the product to be included in the subscription. For example, if price ID "price_ABC123" corresponds to a product with a "unit" of "seat" and "quantity" is 5, the customer will be billed for 5 seats each billing cycle.
	 * @param {Object} payload.metadata: A set of key-value pairs that you can attach to a Checkout Session object. It can be useful for storing additional information about the session in a structured format.
	 * @param {Number} trial_period_days: Integer representing the number of trial period days before the customer is charged for the first time. Has to be at least 1.
	 */
	async createSubscription(payload) {
		try {
			const subscriptionPayload: any = {
				customer: payload.customer_id,
				collection_method: "charge_automatically",
				currency: payload.currency || "usd",
				description: payload.description,
				items: payload.items,
				automatic_tax: { enabled: true },
				metadata: payload.metadata,
				payment_settings: { save_default_payment_method: "on_subscription" },
				expand: ["latest_invoice.payment_intent"]
			};

			if (payload.trial_period_days) {
				subscriptionPayload.trial_settings = {
					end_behavior: {
						missing_payment_method: "pause"
					}
				};
				subscriptionPayload.trial_period_days = payload.trial_period_days;
			}

			const subscription = await this.getStripeClient().subscriptions.create(subscriptionPayload);
			return subscription;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {Object} payload
	 * @param {String} payload.name: The product’s name, meant to be displayable to the customer.
	 * @param {String} payload.description: The product’s description, meant to be displayable to the customer.
	 * @param {Object} payload.metadata: A set of key-value pairs that you can attach to a product object. It can be useful for storing additional information about the product in a structured format.
	 * @param {String} payload.currency: Three-letter ISO currency code, in lowercase. Must be a supported currency.
	 * @param {Number} payload.unit_amount: When creating a new product, we create an asssociated price with the product. The price is the amount that the customer is charged per billing period.
	 * @param {String} payload.interval: Specifies billing frequency. Either day, week, month or year.
	 * @param {Number} payload.interval_count: The number of intervals between subscription billings. For example, interval=month and interval_count=3 bills every 3 months.
	 */
	async createProduct(payload) {
		try {
			const product = await this.getStripeClient().products.create({
				name: payload.name,
				description: payload.description,
				metadata: payload.metadata,
				tax_code: "txcd_10103001", // Software as a Service: Business Use [https://this.stripe.com/docs/tax/tax-codes]
				default_price_data: {
					currency: payload.currency || "usd",
					unit_amount: payload.unit_amount, // amount in cents
					recurring: {
						interval: payload.interval,
						interval_count: payload.interval_count
					},
					tax_behavior: "exclusive"
				}
			});
			return product;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description Prices and Plans are same according to https://this.stripe.com/docs/api/plans but we are considering the products as plans which is fine
	 * @param {number} payload.limit to get the no of products
	 * @param {string} payload.active true/false to get active/non-active products
	 * @param {Array} payload.expand property to expand
	 * @returns {Array} list of products
	 */
	async getProducts(payload) {
		try {
			const prices = await this.getStripeClient().products.list(payload);
			return prices;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function is used to fetch the price A.K.A plan details
	 * Price and Plan is same according to https://this.stripe.com/docs/api/plans
	 * @param {string} priceID: price id
	 * @returns {object} price object
	 */
	async getPrice(priceID) {
		try {
			const price = await this.getStripeClient().prices.retrieve(priceID, { expand: ["product"] });
			return price;
		} catch (error) {
			throw error;
		}
	}

	constructWebhookEvent(payload, signature, secret) {
		try {
			const event = this.getStripeClient().webhooks.constructEvent(payload, signature, secret);
			return event;
		} catch (error) {
			throw error;
		}
	}

	/**
	 *
	 * @description This function is used to create billing portal session for managing subscription
	 * @param {string} payload.customer_id: stripe generated customer id
	 * @param {string} payload.return_url: url to redirect after managing subscription
	 * @param {object} payload.configuration: optional field
	 * @returns {object} session object containing customer portal session url
	 */
	async createBillingPortalSession(payload) {
		try {
			const { customer_id: customerID, return_url: returnUrl, configuration } = payload;
			const session = await this.getStripeClient().billingPortal.sessions.create({
				customer: customerID,
				...configuration,
				return_url: returnUrl
			});
			return session;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description Plans are same so we will get plans
	 * @param {*} payload.limit to get the no of products
	 * @param {*} payload.active true/false to get active/non-active plans
	 * @returns {Array} list of plans
	 */
	async getSubscriptionPlans(payload) {
		try {
			const response = await this.getStripeClient().plans.list(payload);
			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function returns subscription details using subscription id
	 * @param {string} subscriptionID: stripe generated subscription id
	 * @param {Array} payload.expand: fields to expand in subscription object like latest_invoice
	 * @returns {object} subscription object
	 */
	async getSubscriptionByID(subscriptionID, payload?: any) {
		try {
			const response = await this.getStripeClient().subscriptions.retrieve(subscriptionID, payload);
			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function is used to cancel a subscription at period end
	 * @param {string} subscriptionID: stripe generated subscription id
	 * @returns
	 */
	async cancelSubscription(subscriptionID) {
		try {
			const response = await this.getStripeClient().subscriptions.update(subscriptionID, {
				cancel_at_period_end: true,
				cancellation_details: {
					comment: "canceled_by_admin"
				}
			});
			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function is used to fetch invoice details of a subcription from stripe
	 * @param {string} invoiceID
	 * @returns {object} invoice details
	 */
	async invoice(invoiceID) {
		try {
			const response = await this.getStripeClient().invoices.retrieve(invoiceID);
			return response;
		} catch (error) {
			throw error;
		}
	}
}

// Lazy loading of Stripe
let stripe: Stripe | null = null;
export const getStripeInstance = () => {
	if (!stripe) {
		stripe = new Stripe();
	}
	return stripe;
};
