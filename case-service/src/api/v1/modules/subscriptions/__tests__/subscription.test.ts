// @ts-nocheck

// import { OWNER_TYPES, ERROR_CODES, INVITE_STATUS, CASE_STATUS } from "#constants/index";
// import { db, emailExists, getApplicants, getBusinessApplicants, getBusinessEntityVerificationDetails, getBusinessIntegrationConnections, getCustomers, getCustomersInternal, getCustomerUsers, producer, sqlQuery, sqlTransaction, submitBusinessEntityForReview } from "#helpers/index";
// import { StatusCodes } from "http-status-codes";
// import { v4 as uuid } from "uuid";
import { subscriptions } from "../subscriptions";
// import { BusinessApiError } from "../error";
// import { paginate, convertToObject, decodeInvitationToken } from "#utils/index";
// import { invitationStatusQueue } from "#workers/invitationStatus";
// import { tokenConfig } from "#configs/index";
import { paginate, pick, getStripeInstance } from "#utils/index";
import { v4 as uuidv4 } from "uuid";
import { sqlQuery, sqlTransaction } from "#helpers/database";
import { ERROR_CODES, ROLES, SUBSCRIPTIONS } from "#constants";
import { SubscriptionsApiError } from "../error";
import { StatusCodes } from "http-status-codes";
import { getBusinessApplicants, getFlagValueByToken } from "#helpers/index";

require("kafkajs");

jest.mock("jsonwebtoken");
jest.mock("#helpers/index");
jest.mock("#lib/index");
jest.mock("uuid");
jest.mock("#configs/index");
jest.mock("kafkajs");

jest.mock("#helpers/index", () => ({
	db: {
		query: jest.fn(),
		transaction: jest.fn()
	},
	getBusinessApplicants: jest.fn(),
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	getFlagValueByToken: jest.fn(),
	logger: {
		error: jest.fn()
	}
}));
jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000, // 30*24*60*60
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60, // 10 minutes
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60 // 10 minutes
	}
}));

const mockStripe = {
	getProducts: jest.fn(),
	getPrice: jest.fn(),
	createNewStripeCustomer: jest.fn(),
	createCheckoutSessionSubscription: jest.fn(),
	createBillingPortalSession: jest.fn(),
	getSubscriptionByID: jest.fn(),
	invoice: jest.fn(),
	cancelSubscription: jest.fn(),
	constructWebhookEvent: jest.fn()
};

jest.mock("#utils/index", () => ({
	getStripeInstance: jest.fn(() => mockStripe),
	pick: jest.fn(),
	paginate: jest.fn()
}));

describe("Subscription", () => {
	beforeEach(() => {
		getStripeInstance.mockReturnValue(mockStripe);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("getSubscriptionPlans", () => {
		const query = {
			items_per_page: 20,
			is_active: true
		};

		const response = {
			records: [
				{
					id: "id",
					active: true,
					description: "description"
				}
			]
		};

		it("should return the subscription plans", async () => {
			mockStripe.getProducts.mockResolvedValueOnce({
				data: [
					{
						id: "id",
						active: true,
						description: "description"
					}
				]
			});

			const result = await subscriptions.getSubscriptionPlans(query);

			expect(result).toEqual(response);
		});
	});

	describe("createSubscription", () => {
		const params = {
			businessID: "businessID"
		};

		const body = {
			plan_id: "planID"
		};

		const headers = {
			authorization: "Bearer token"
		};

		const user = {
			user_id: "applicantID",
			given_name: "firstName",
			family_name: "lastName",
			email: "email@example.com"
		};

		const response = {
			checkout_url: "url"
		};

		it("should create a subscription", async () => {
			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			mockStripe.getPrice.mockResolvedValueOnce({
				active: true,
				product: {
					active: true
				}
			});

			sqlTransaction.mockResolvedValueOnce([
				{
					rows: []
				},
				{
					rowCount: 1,
					rows: [
						{
							stripe_customer_id: null
						}
					]
				}
			]);

			mockStripe.createNewStripeCustomer.mockResolvedValueOnce({
				id: "newStripeCustomerID"
			});

			sqlTransaction.mockResolvedValueOnce({});

			uuidv4.mockReturnValueOnce("subscriptionID");

			mockStripe.createCheckoutSessionSubscription.mockResolvedValueOnce({
				url: "url"
			});

			const result = await subscriptions.createSubscription(params, body, user, headers);

			expect(result).toEqual(response);
		});

		it("should throw an error when another applicant tries to create the subscription", async () => {
			const userInfo = {
				user_id: "applicantID",
				role: {
					code: ROLES.APPLICANT
				}
			};

			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "userID"
				}
			]);

			try {
				await subscriptions.createSubscription(params, body, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		// TODO: pending error handling
	});

	describe("createCustomerPortalSession", () => {
		const params = {
			businessID: "businessID"
		};

		const headers = {
			authorization: "Bearer token"
		};

		const user = {
			user_id: "applicantID",
			role: {
				code: ROLES.APPLICANT
			}
		};

		const response = {
			redirect_url: "url"
		};

		it("should create a customer portal session for applicant", async () => {
			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			// _getBusinessCurrentSubscription mock
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						business_id: "businessID",
						status: "subscribed",
						stripe_customer_id: "stripeCustomerID"
					}
				]
			});

			mockStripe.createBillingPortalSession.mockResolvedValueOnce({
				url: "url"
			});

			const result = await subscriptions.createCustomerPortalSession(params, {}, user, headers);

			expect(result).toEqual(response);
		});

		it("should create a customer portal session for admin", async () => {
			const sampleUser = {
				user_id: "userID",
				role: {
					code: ROLES.ADMIN
				}
			};

			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						business_id: "businessID",
						status: "subscribed",
						stripe_customer_id: "stripeCustomerID"
					}
				]
			});

			mockStripe.createBillingPortalSession.mockResolvedValueOnce({
				url: "url"
			});

			const result = await subscriptions.createCustomerPortalSession(params, {}, sampleUser, headers);

			expect(result).toEqual(response);
		});

		it("should create a customer portal session for updating subscription plan", async () => {
			const sampleUser = {
				user_id: "userID",
				role: {
					code: ROLES.ADMIN
				}
			};

			const body = {
				redirect_url: "https://redirect.com",
				subscription_id: "subscription_id",
				update_plan: true
			};

			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						business_id: "businessID",
						status: "subscribed",
						stripe_customer_id: "stripeCustomerID"
					}
				]
			});

			mockStripe.createBillingPortalSession.mockResolvedValueOnce({
				url: "url"
			});

			const result = await subscriptions.createCustomerPortalSession(params, body, sampleUser, headers);

			expect(result).toEqual(response);
		});

		it("should throw an error when updating subscription plan and business_id missing", async () => {
			const body = {
				redirect_url: "https://redirect.com",
				update_plan: true
			};

			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						business_id: "businessID",
						status: "subscribed",
						stripe_customer_id: "stripeCustomerID"
					}
				]
			});

			try {
				await subscriptions.createCustomerPortalSession(params, body, user, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
				expect(error.message).toBe("Subscription ID is required for updating plan");
			}
		});

		it("should throw an error if applicant is not related to the business", async () => {
			getBusinessApplicants.mockResolvedValueOnce([]);

			try {
				await subscriptions.createCustomerPortalSession(params, {}, user, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error if role is of customer", async () => {
			const sampleUser = {
				user_id: "userID",
				role: {
					code: ROLES.CUSTOMER
				}
			};

			try {
				await subscriptions.createCustomerPortalSession(params, {}, sampleUser, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should throw an error if stripe account does not exists", async () => {
			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			try {
				await subscriptions.createCustomerPortalSession(params, {}, user, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("getBusinessSubscriptionDetails", () => {
		const params = {
			businessID: "businessID"
		};

		const userInfo = {
			user_id: "userID",
			role: {
				code: ROLES.APPLICANT
			}
		};

		const headers = {
			authorization: "Bearer token"
		};

		getFlagValueByToken.mockResolvedValueOnce(false);

		const response = {
			subscription: {
				id: "id",
				created: "created",
				current_period_start: "current_period_start",
				current_period_end: "current_period_end",
				latest_invoice: "latest_invoice",
				status: "SUBSCRIBED",
				cancel_at: "cancel_at",
				cancel_at_period_end: "cancel_at_period_end",
				canceled_at: "canceled_at",
				cancellation_details: "cancellation_details",
				is_business_ever_subscribed: "true",
				plan_id: "product",
				price_id: "ID"
			},
			invoice: {
				id: "id",
				created: "created",
				due_date: "due_date",
				effective_at: "effective_at",
				hosted_invoice_url: "hosted_invoice_url",
				status: "active",
				status_transitions: "status_transitions"
			}
		};

		it("should return the business subscription details", async () => {
			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "userID"
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						business_id: "businessID",
						status: "subscribed",
						stripe_customer_id: "stripeCustomerID",
						stripe_subscription_id: "stripeSubscriptionID"
					}
				]
			});

			// successSubscriptionHistory
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						stripe_subscription_id: "stripeSubscriptionID",
						exists: "true"
					}
				]
			});

			mockStripe.getSubscriptionByID.mockResolvedValueOnce({});

			// pick for subscription
			pick.mockReturnValueOnce({
				id: "id",
				created: "created",
				current_period_start: "current_period_start",
				current_period_end: "current_period_end",
				latest_invoice: "latest_invoice",
				status: "active",
				cancel_at: "cancel_at",
				cancel_at_period_end: "cancel_at_period_end",
				canceled_at: "canceled_at",
				cancellation_details: "cancellation_details",
				items: {
					data: [
						{
							price: {
								id: "ID",
								product: "product"
							}
						}
					]
				}
			});

			mockStripe.invoice.mockResolvedValueOnce({});

			// pick for invoice
			pick.mockReturnValueOnce({
				id: "id",
				created: "created",
				due_date: "due_date",
				effective_at: "effective_at",
				hosted_invoice_url: "hosted_invoice_url",
				status: "active",
				status_transitions: "status_transitions"
			});

			const result = await subscriptions.getBusinessSubscriptionDetails(params, userInfo, headers);

			expect(result).toEqual(response);
		});

		it("should throw an error when customer tries to access the subscription details", async () => {
			const userInfo = {
				user_id: "userID",
				role: {
					code: ROLES.CUSTOMER
				}
			};

			try {
				await subscriptions.getBusinessSubscriptionDetails(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_ALLOWED);
			}
		});

		it("should throw an error when another applicant tries to access the subscription details", async () => {
			const userInfo = {
				user_id: "applicantID",
				role: {
					code: ROLES.APPLICANT
				}
			};

			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "userID"
				}
			]);

			try {
				await subscriptions.getBusinessSubscriptionDetails(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("getBusinessSubscriptionStatus", () => {
		const params = {
			businessID: "businessID"
		};

		const userInfo = {
			user_id: "applicantID",
			role: {
				code: ROLES.ADMIN
			}
		};

		const headers = {
			authorization: "Bearer token"
		};

		const response = {
			message: "Your Subscription is Active",
			status: SUBSCRIPTIONS.SUBSCRIBED,
			subscription: {
				id: "subscriptionID",
				next_billing_at: "current_period_end",
				created_at: "created",
				current_period_start: "current_period_start",
				cancel_at_period_end: "cancel_at_period_end",
				cancel_at: "cancel_at",
				canceled_at: "canceled_at"
			},
			next_score_refresh_date: "2024-01-31T00:00:00.000Z"
		};

		it("should return the business subscription status", async () => {
			getBusinessApplicants.mockResolvedValueOnce([
				{
					id: "applicantID"
				}
			]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						business_id: "businessID",
						status: SUBSCRIPTIONS.SUBSCRIBED,
						stripe_customer_id: "stripeCustomerID",
						stripe_subscription_id: "stripeSubscriptionID"
					}
				]
			});

			mockStripe.getSubscriptionByID.mockResolvedValueOnce({
				id: "subscriptionID",
				status: "active",
				created: "created",
				current_period_start: "current_period_start",
				current_period_end: "current_period_end",
				cancel_at_period_end: "cancel_at_period_end",
				cancel_at: "cancel_at",
				canceled_at: "canceled_at"
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						refresh_cycle_in_days: 30
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						created_at: "2024-01-01"
					}
				]
			});

			const result = await subscriptions.getBusinessSubscriptionStatus(params, userInfo, headers);

			expect(result).toEqual(response);
		});

		it("should throw an error if applicant is not related to the business", async () => {
			getBusinessApplicants.mockResolvedValueOnce([]);

			try {
				await subscriptions.getBusinessSubscriptionStatus(params, userInfo, headers);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("cancelBusinessSubscription", () => {
		const params = {
			businessID: "businessID"
		};

		const userInfo = {
			user_id: "applicantID",
			role: {
				code: ROLES.ADMIN
			}
		};

		const response = {
			cancel_at_period_end: true
		};

		it("should cancel the business subscription", async () => {
			// _getBusinessCurrentSubscription mock
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						business_id: "businessID",
						status: "subscribed",
						stripe_customer_id: "stripeCustomerID",
						stripe_subscription_id: "stripeSubscriptionID"
					}
				]
			});

			mockStripe.cancelSubscription.mockResolvedValueOnce({
				cancel_at_period_end: true
			});

			const result = await subscriptions.cancelBusinessSubscription(params, userInfo);

			expect(result).toEqual(response);
		});

		it("should throw an error if role is not of admin", async () => {
			const sampleUser = {
				user_id: "userID",
				role: {
					code: ROLES.APPLICANT
				}
			};

			try {
				await subscriptions.cancelBusinessSubscription(params, sampleUser);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.FORBIDDEN);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_ALLOWED);
			}
		});

		it("should throw an error when subscription details not found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: []
			});

			try {
				await subscriptions.cancelBusinessSubscription(params, userInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});
	});

	describe("getBusinessSubscriptionHistory", () => {
		const params = {
			businessID: "businessID"
		};

		const query = {
			pagination: true,
			items_per_page: 20,
			page: 1
		};

		const response = {
			records: [
				{
					subscription_id: "stripeSubscriptionID",
					status: "active",
					created_at: "createdAt"
				}
			],
			total_pages: 1,
			total_items: 1
		};

		it("should return the subscription history of business", async () => {
			// _getBusinessCurrentSubscription mock
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						business_id: "businessID",
						status: "subscribed",
						stripe_customer_id: "stripeCustomerID"
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						count: 1
					}
				]
			});

			paginate.mockReturnValueOnce({
				totalItems: 1,
				totalPages: 1
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						stripe_subscription_id: "stripeSubscriptionID",
						status: "active",
						created_at: "createdAt"
					}
				]
			});

			const result = await subscriptions.getBusinessSubscriptionHistory(params, query);

			expect(result).toEqual(response);
		});

		it("should return empty array when no subscription history found", async () => {
			// _getBusinessCurrentSubscription mock
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			const result = await subscriptions.getBusinessSubscriptionHistory(params, query);

			expect(result).toEqual({
				records: [],
				total_pages: 0,
				total_items: 0
			});
		});
	});

	describe("stripeWebhookSubscriptions", () => {
		const sig = {
			"stripe-signature": "stripe-signature"
		};

		const body = {
			type: "customer.subscription.created",
			data: {
				object: {
					id: "stripe_subscription_id",
					object: "subscription",
					customer: "customer",
					status: "incomplete",
					ended_at: "ended_at",
					current_period_end: "current_period_end",
					metadata: {
						applicant_id: "applicantID"
					}
				}
			}
		};

		const response = {
			message: "Success",
			data: {}
		};

		it("should handle the stripe webhook when payment is initiated of subscription type", async () => {
			mockStripe.constructWebhookEvent.mockResolvedValueOnce(body);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						status: SUBSCRIPTIONS.NOT_SUBSCRIBED
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({});

			const result = await subscriptions.stripeWebhookSubscriptions(sig, body);

			expect(result).toEqual(response);
		});

		it("should handle the stripe webhook when payment is initiated of invoice type", async () => {
			const sampleBody = {
				type: "invoice.paid",
				data: {
					object: {
						id: "stripe_subscription_id",
						object: "invoice",
						customer: "customer",
						status: "paid",
						ended_at: "ended_at",
						current_period_end: "current_period_end",
						subscription_details: {
							metadata: {
								subscription_id: "subscription_id",
								applicant_id: "applicantID"
							}
						}
					}
				}
			};

			mockStripe.constructWebhookEvent.mockResolvedValueOnce(sampleBody);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						status: SUBSCRIPTIONS.NOT_SUBSCRIBED
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({});

			const result = await subscriptions.stripeWebhookSubscriptions(sig, sampleBody);

			expect(result).toEqual(response);
		});

		it("should handle customer.subscription.deleted event", async () => {
			const sampleBody = {
				type: "customer.subscription.deleted",
				data: {
					object: {
						id: "ID",
						object: "subscription",
						customer: "customer",
						status: "canceled",
						ended_at: "ended_at",
						current_period_end: "current_period_end",
						metadata: {
							applicant_id: "applicantID"
						}
					}
				}
			};

			mockStripe.constructWebhookEvent.mockResolvedValueOnce(sampleBody);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						id: "subscriptionID",
						status: SUBSCRIPTIONS.SUBSCRIBED
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({});

			const result = await subscriptions.stripeWebhookSubscriptions(sig, sampleBody);

			expect(result).toEqual(response);
		});

		// it("should handle the stripe webhook when payment is completed", async () => {
		// 	const sampleBody = {
		// 		type: "customer.subscription.updated",
		// 		data: {
		// 			object: {
		// 				id: "ID",
		// 				customer: "customer",
		// 				status: "active",
		// 				ended_at: "ended_at",
		// 				current_period_end: "current_period_end",
		// 				metadata: {
		// 					applicant_id: "applicantID"
		// 				}
		// 			}
		// 		}
		// 	};

		// 	sqlQuery.mockResolvedValueOnce({
		// 		rowCount: 1,
		// 		rows: [
		// 			{
		// 				status: SUBSCRIPTIONS.NOT_SUBSCRIBED
		// 			}
		// 		]
		// 	});

		// 	// sqlQuery.mockResolvedValueOnce({});

		// 	await subscriptions.stripeWebhookSubscriptions(sig, sampleBody);
		// });

		it("should throw an error when subscription not found", async () => {
			mockStripe.constructWebhookEvent.mockResolvedValueOnce(body);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: []
			});

			try {
				await subscriptions.stripeWebhookSubscriptions(sig, body);
			} catch (error) {
				expect(error).toBeInstanceOf(SubscriptionsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should return if object type is not subscription not invoice", async () => {
			const sampleBody = {
				data: {
					object: {
						object: "random"
					}
				}
			};

			const sampleResponse = {
				message: "Object type not found: random",
				data: {}
			};

			mockStripe.constructWebhookEvent.mockResolvedValueOnce(sampleBody);

			const result = await subscriptions.stripeWebhookSubscriptions(sig, sampleBody);

			expect(result).toEqual(sampleResponse);
		});
	});

	describe("getSubscriptionByID", () => {
		it("should return the subscription details", async () => {
			sqlQuery.mockResolvedValueOnce({
				rows: [
					{
						id: "subscriptionID",
						status: "status"
					}
				]
			});

			const response = [
				{
					id: "subscriptionID",
					status: "status"
				}
			];

			const result = await subscriptions.getSubscriptionByID("subscriptionID");
			expect(result).toEqual(response);
		});
	});

	describe("updateSubscriptionByID", () => {
		it("should update the subscription details", async () => {
			sqlQuery.mockResolvedValueOnce({});

			await subscriptions.updateSubscriptionByID("subscriptionID");
		});
	});
});
