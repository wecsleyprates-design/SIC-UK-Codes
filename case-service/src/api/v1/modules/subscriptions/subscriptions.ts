import { v4 as uuidv4 } from "uuid";
import { sqlQuery, logger, producer, getBusinessApplicants, sqlTransaction } from "#helpers/index";
import { SubscriptionsApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { envConfig } from "#configs/index";
import { paginate, pick, getStripeInstance } from "#utils/index";
import {
	kafkaEvents,
	kafkaTopics,
	ERROR_CODES,
	SUBSCRIPTIONS,
	ROLES,
	FEATURE_FLAGS,
	WEBHOOK_EVENTS
} from "#constants/index";
import {
	BusinessData,
	BusinessSubscriptionStatusResponse,
	GetSubscriptionPlansPayload,
	GetSubscriptionPlansQuery
} from "./types";
import { getFlagValueByToken } from "#helpers/LaunchDarkly";
import { sendEventToGatherWebhookData } from "#common/index";

class Subscriptions {
	/**
	 * @param {boolean} query.is_active: to fetch active/inactive plans by passing true/false
	 * @returns {Object} response: Plans A.K.A Products from stripe
	 */
	async getSubscriptionPlans(query: GetSubscriptionPlansQuery) {
		try {
			const payload: GetSubscriptionPlansPayload = {
				expand: ["data.default_price"]
			};

			if (Object.hasOwn(query, "items_per_page")) {
				payload.limit = query.items_per_page;
			}

			if (Object.hasOwn(query, "is_active")) {
				payload.active = query.is_active;
			}

			// Subscription plans is same as prices
			const response: any = await getStripeInstance().getProducts(payload);
			return { records: response.data };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {uuid} params.businessID: Id of a business to create subscription for
	 * @param {string} body.plan_id: Id of a subscription plan A.K.A. price
	 * @param {Object} user: token information like user_id, name and email to be used for creating stripe customer
	 * @returns {string} checkout_url: URL for subscribing using checkout session
	 */
	async createSubscription(params, body, user, { authorization }) {
		try {
			const { businessID } = params;
			const { user_id: applicantID, given_name: firstName, family_name: lastName, email } = user;

			const records = await getBusinessApplicants(businessID, authorization);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(applicantID)) {
				throw new SubscriptionsApiError(
					"Applicant is not related to business",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			// Subscription plan is same as price
			const subscriptionPlan: any = await getStripeInstance().getPrice(body.plan_id);

			if (!subscriptionPlan) {
				throw new SubscriptionsApiError(
					"Subscription plan does not exist",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (!(subscriptionPlan.active && subscriptionPlan.product.active)) {
				throw new SubscriptionsApiError(
					"Subscription plan is not active",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.INVALID
				);
			}

			let customerID: any = null;
			let subscriptionID = uuidv4();

			const customerQuery = `SELECT * FROM subscriptions.data_customers
				WHERE business_id = $1`;

			const businessQuery = `SELECT data_businesses.name, data_subscriptions.*  FROM data_businesses
				LEFT JOIN subscriptions.data_businesses_subscriptions AS data_subscriptions ON data_subscriptions.business_id = data_businesses.id WHERE data_businesses.id = $1`; // ----extra query

			const [customerResult, businessResult] = await sqlTransaction(
				[customerQuery, businessQuery],
				[[businessID], [businessID]]
			);

			const businessData: BusinessData = businessResult.rows[0];

			if (customerResult.rows.length && businessData.id && businessData.status === SUBSCRIPTIONS.SUBSCRIBED) {
				throw new SubscriptionsApiError(
					"Business already have active subscription.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (customerResult.rows.length) {
				customerID = customerResult.rows[0].stripe_customer_id;
			}

			const queries: any[] = [];
			const values: any[] = [];

			// create stripe customer if not exists
			if (!customerID) {
				if (!businessData.id && !businessData.stripe_customer_id) {
					// create stripe customer and insert data
					const customerUuid = uuidv4();
					const metadata = {
						email,
						name: `${firstName} ${lastName}`,
						applicant_id: applicantID,
						business_id: businessID,
						business_name: businessData.name
					};
					const response = await getStripeInstance().createNewStripeCustomer(
						`${firstName} ${lastName}`,
						email,
						customerUuid,
						metadata
					);
					customerID = response.id;

					const insertCustomersQuery =
						"INSERT INTO subscriptions.data_customers (id, stripe_customer_id, applicant_id, business_id) VALUES ($1, $2, $3, $4)";
					queries.push(insertCustomersQuery);
					values.push([customerUuid, response.id, applicantID, businessID]);

					const insertSubscriptionQuery =
						"INSERT INTO subscriptions.data_businesses_subscriptions (id, business_id, stripe_customer_id, status, applicant_id, created_by, updated_by) VALUES($1, $2, $3, $4, $5, $6, $7)";
					queries.push(insertSubscriptionQuery);
					values.push([
						subscriptionID,
						businessID,
						response.id,
						SUBSCRIPTIONS.NOT_SUBSCRIBED,
						applicantID,
						applicantID,
						applicantID
					]);
				} else if (businessData.stripe_customer_id) {
					// make entry in data_customers table
					customerID = businessData.stripe_customer_id;
					subscriptionID = businessData.id;
					const insertCustomersQuery =
						"INSERT INTO subscriptions.data_customers (id, stripe_customer_id, applicant_id, business_id) VALUES ($1, $2, $3, $4)";
					queries.push(insertCustomersQuery);
					values.push([uuidv4(), businessData.stripe_customer_id, applicantID, businessID]);
				}
			} else if (!businessData.id && !businessData.stripe_customer_id) {
				// make entry in data_subscription table
				const insertSubscriptionQuery =
					"INSERT INTO subscriptions.data_businesses_subscriptions (id, business_id, stripe_customer_id, status, applicant_id, created_by, updated_by) VALUES($1, $2, $3, $4, $5, $6, $7)";
				queries.push(insertSubscriptionQuery);
				values.push([
					subscriptionID,
					businessID,
					customerID,
					SUBSCRIPTIONS.NOT_SUBSCRIBED,
					applicantID,
					applicantID,
					applicantID
				]);
			} else {
				subscriptionID = businessData.id;
			}

			await sqlTransaction(queries, values);

			const payload = {
				customer_id: customerID,
				success_url: envConfig.STRIPE_SUBSCRIPTION_SUCCESS_URL,
				cancel_url: envConfig.STRIPE_SUBSCRIPTION_CANCEL_URL,
				trial_period_days: 0,
				description: `Subscription of ${subscriptionPlan.product.name} for ${businessData.name}`,
				line_items: [
					{
						price: subscriptionPlan.id,
						quantity: 1,
						adjustable_quantity: { enabled: false }
					}
				],
				metadata: {
					email,
					applicant: `${firstName} ${lastName}`,
					applicant_id: applicantID,
					business_id: businessID, // business id to have extra visibility on stripe dashboard
					business_name: businessData.name,
					subscription_id: subscriptionID,
					subscription_plan: subscriptionPlan.nickname,
					subscription_plan_id: subscriptionPlan.id
				}
			};

			const stripeCheckoutSession = await getStripeInstance().createCheckoutSessionSubscription(payload);

			return { checkout_url: stripeCheckoutSession.url };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function returns customer portal session url
	 * @param {Object} params with key businessID
	 * @param {Object} body with keys return_url, update_plan, subscription_id which are optional. will only get when user want to create session for updating plan
	 * @param {*} user to extract applicant_id from it
	 * @returns {string} redirect_url: URL for customer portal session
	 */
	async createCustomerPortalSession(params, body, user, { authorization }) {
		try {
			const { businessID } = params;
			const { user_id: applicantID, role } = user;

			// Added role checks
			switch (role.code) {
				case ROLES.APPLICANT: {
					const records = await getBusinessApplicants(businessID, authorization);
					const applicants = records.map(applicant => applicant.id);

					if (!applicants.includes(applicantID)) {
						throw new SubscriptionsApiError(
							"Applicant is not related to business",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					}

					break;
				}
				case ROLES.ADMIN: {
					break;
				}
				case ROLES.CUSTOMER: {
					throw new SubscriptionsApiError(
						"Customer is not allowed to view subscription",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}

			const result = await this._getBusinessCurrentSubscription(businessID);

			if (!result.rowCount) {
				throw new SubscriptionsApiError(
					"Stripe customer account does not exists for this applicant",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.INVALID
				);
			}

			const customerID = result.rows[0].stripe_customer_id;
			const returnUrl = body.return_url ? body.return_url : envConfig.STRIPE_SUBSCRIPTION_SUCCESS_URL;
			let configuration = {};

			if (body.update_plan) {
				if (!body.subscription_id) {
					throw new SubscriptionsApiError(
						"Subscription ID is required for updating plan",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
				configuration = {
					flow_data: {
						type: "subscription_update",
						subscription_update: {
							subscription: body.subscription_id
						}
					}
				};
			}

			const payload = {
				customer_id: customerID,
				return_url: returnUrl,
				configuration
			};

			const response = await getStripeInstance().createBillingPortalSession(payload);

			return { redirect_url: response.url };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {uuid} businessID: Id of a business for fetching subscription details
	 * @returns {Object}
	 * @description This function returns subscription and invoice details. This API is admin & applicant only
	 */
	async getBusinessSubscriptionDetails({ businessID }, userInfo, { authorization }) {
		try {
			const isEasyFlow = await getFlagValueByToken(FEATURE_FLAGS.WIN_1152_EASY_ONBOARDING_FLOW, { authorization });
			if (isEasyFlow) {
				return {
					subscription: { status: SUBSCRIPTIONS.SUBSCRIBED, is_business_ever_subscribed: true },
					invoice: null
				};
			}
			if (userInfo.role.code === ROLES.CUSTOMER) {
				throw new SubscriptionsApiError(
					"You don't have have access to subscription details",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.NOT_ALLOWED
				);
			} else if (userInfo.role.code === ROLES.APPLICANT) {
				const { user_id: applicantID } = userInfo;

				const records = await getBusinessApplicants(businessID, authorization);
				const applicants = records.map(applicant => applicant.id);

				if (!applicants.includes(applicantID)) {
					throw new SubscriptionsApiError(
						"Applicant is not related to business",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}

			const businessCurrentSubscription = await this._getBusinessCurrentSubscription(businessID);

			const subscriptionExistsQuery = `SELECT EXISTS(
				SELECT 1 FROM subscriptions.data_subscriptions_history AS subscription_history 
				LEFT JOIN subscriptions.data_businesses_subscriptions AS subscriptions 
				ON subscription_history.subscription_id = subscriptions.id 
				WHERE subscriptions.business_id = $1 AND subscription_history.status = $2)`;
			const successSubscriptionHistory = await sqlQuery({
				sql: subscriptionExistsQuery,
				values: [businessID, SUBSCRIPTIONS.SUBSCRIBED]
			});

			if (
				!businessCurrentSubscription.rows.length ||
				(businessCurrentSubscription.rows.length && !businessCurrentSubscription.rows[0].stripe_subscription_id)
			) {
				const response = {
					subscription: {
						status: SUBSCRIPTIONS.NOT_SUBSCRIBED,
						is_business_ever_subscribed: successSubscriptionHistory.rows[0].exists
					},
					invoice: null
				};

				return response;
			}

			let subscription: any = await getStripeInstance().getSubscriptionByID(
				businessCurrentSubscription.rows[0].stripe_subscription_id
			);
			subscription = pick(subscription, [
				"id",
				"created",
				"current_period_start",
				"current_period_end",
				"latest_invoice",
				"status",
				"cancel_at",
				"cancel_at_period_end",
				"canceled_at",
				"cancellation_details",
				"items"
			]);

			// getting price id and plan id from subscription
			subscription.price_id = subscription.items.data[0].price.id;
			subscription.plan_id = subscription.items.data[0].price.product;
			delete subscription.items;

			subscription.status = this._getSubscriptionStatusMapping(subscription.status);
			subscription.is_business_ever_subscribed = successSubscriptionHistory.rows[0].exists;

			let invoice = await getStripeInstance().invoice(subscription.latest_invoice);
			invoice = pick(invoice, [
				"id",
				"created",
				"due_date",
				"effective_at",
				"hosted_invoice_url",
				"status",
				"status_transitions"
			]);

			return { subscription, invoice };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {Object} params businessID
	 * @param {Object} user for extracting applicant_id
	 * @returns {Object} subscription status
	 * @description This function returns subscription status details of the business. This API is for applicant only
	 */
	async getBusinessSubscriptionStatus({ businessID }, userInfo, { authorization }) {
		try {
			const { user_id: applicantID } = userInfo;

			const records = await getBusinessApplicants(businessID, authorization);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(applicantID)) {
				throw new SubscriptionsApiError(
					"Applicant is not related to business",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			const businessCurrentSubscription = await this._getBusinessCurrentSubscription(businessID);

			let response: BusinessSubscriptionStatusResponse = {
				status: SUBSCRIPTIONS.NOT_SUBSCRIBED,
				message: ""
			};

			if (
				!businessCurrentSubscription.rowCount ||
				(businessCurrentSubscription.rowCount && !businessCurrentSubscription.rows[0].stripe_subscription_id)
			) {
				response = {
					status: SUBSCRIPTIONS.NOT_SUBSCRIBED,
					message: "Your Subscription is currently Inactive, Please activate your membership"
				};
				response.subscription = {};
				return response;
			}

			const { status, stripe_subscription_id: subscriptionID } = businessCurrentSubscription.rows[0];

			const subscription = await getStripeInstance().getSubscriptionByID(subscriptionID);

			switch (status) {
				case SUBSCRIPTIONS.SUBSCRIBED:
					response = { status: SUBSCRIPTIONS.SUBSCRIBED, message: "Your Subscription is Active" };
					break;

				case SUBSCRIPTIONS.PAYMENT_PENDING:
					response = {
						status: SUBSCRIPTIONS.PAYMENT_PENDING,
						message: "Your Subscription is currently Inactive, Please activate your membership"
					};
					break;

				case SUBSCRIPTIONS.UNSUBSCRIBED:
					response = {
						status: SUBSCRIPTIONS.UNSUBSCRIBED,
						message: "Your Subscription is expired, Please renew your membership"
					};
					break;

				case SUBSCRIPTIONS.NOT_SUBSCRIBED:
					response = {
						status: SUBSCRIPTIONS.NOT_SUBSCRIBED,
						message: "You have not subscribed, Please activate your membership"
					};
					break;

				case SUBSCRIPTIONS.PAYMENT_DECLINED:
					response = {
						status: SUBSCRIPTIONS.PAYMENT_DECLINED,
						message: "Your payment has not completed, may due to server error, please try again after some time"
					};
					break;
			}

			response.subscription = {
				id: subscription.id,
				created_at: subscription.created,
				current_period_start: subscription.current_period_start,
				next_billing_at: subscription.current_period_end,
				cancel_at_period_end: subscription.cancel_at_period_end,
				cancel_at: subscription.cancel_at,
				canceled_at: subscription.canceled_at
			};

			// score refresh date
			const scoreRefreshDateQuery = `SELECT config->>'refresh_value' AS refresh_cycle_in_days FROM core_score_refresh_config WHERE refresh_type = $1`;
			const scoreRefreshDateResult = await sqlQuery({ sql: scoreRefreshDateQuery, values: ["SUBSCRIPTION_REFRESH"] });

			const refreshDays = parseInt(scoreRefreshDateResult.rows[0].refresh_cycle_in_days);

			// TODO : Fix this query and add trigger_id
			const scoreCalculatedQuery = `SELECT data_business_scores.created_at FROM data_business_scores
				LEFT JOIN data_businesses db ON db.id = data_business_scores.business_id
				WHERE data_business_scores.business_id = $1 AND db.is_deleted = false
				ORDER BY data_business_scores.created_at DESC LIMIT 1`;

			const scoreCalculatedResult = await sqlQuery({ sql: scoreCalculatedQuery, values: [businessID] });

			// score-refresh-date = score-calculated-time + refresh-days
			const currentDate = new Date(`${scoreCalculatedResult.rows[0].created_at}`);
			const refreshDate = new Date(currentDate.getTime() + refreshDays * 24 * 60 * 60 * 1000);

			response.next_score_refresh_date = refreshDate.toISOString();

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * this method is used to cancel the stripe subscription
	 * @param {object} businessID
	 * @returns {object} response
	 *
	 * the cancel stripe subscription does not take any meatadata hence we cannot differentiate
	 * whether the business has cancelled the subscription or the admin
	 * this route is specifically for admin subscription cancellation hence updating db and triggering
	 * kafka event to auth
	 * in case of business subscription cancellation that will be handled by webhook
	 */
	async cancelBusinessSubscription(params, userInfo) {
		try {
			// check for admin user pool
			if (userInfo.role.code !== ROLES.ADMIN) {
				throw new SubscriptionsApiError(
					"Only admin can cancel the subscription",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.NOT_ALLOWED
				);
			}

			const stripeSubscriptionIDResult = await this._getBusinessCurrentSubscription(params.businessID);

			if (!stripeSubscriptionIDResult.rows.length) {
				throw new SubscriptionsApiError("Business not found.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const response = await getStripeInstance().cancelSubscription(
				stripeSubscriptionIDResult.rows[0].stripe_subscription_id
			);

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {uuid} params.businessID : business id
	 * @param {Object} query with keys related to payload
	 * @returns {Object}
	 * This function returns the subscriptions history.
	 * This API is not binded to frontend but will get used in future
	 */
	async getBusinessSubscriptionHistory(params, query) {
		try {
			const subscription = await this._getBusinessCurrentSubscription(params.businessID);

			if (!subscription.rows.length) {
				return {
					records: [],
					total_pages: 0,
					total_items: 0
				};
			}

			const businessCurrentSubscription: BusinessData = subscription.rows[0];

			let pagination = true;
			if (Object.hasOwn(query, "pagination")) {
				pagination = JSON.parse(query.pagination);
			}
			let itemsPerPage, page;
			if (pagination) {
				itemsPerPage = 20;
				if (query.items_per_page) {
					itemsPerPage = query.items_per_page;
				}
				page = 1;
				if (query.page) {
					page = query.page;
				}
			}

			let subscriptionHistoryQuery =
				"SELECT * FROM subscriptions.data_subscriptions_history WHERE subscription_id = $1";
			const countQuery =
				"SELECT COUNT(id) AS count FROM subscriptions.data_subscriptions_history WHERE subscription_id = $1";

			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				subscriptionHistoryQuery += paginationQuery;
			}

			const subscriptionHistoryCount = await sqlQuery({ sql: countQuery, values: [businessCurrentSubscription.id] });
			const totalHistorySubscriptions = subscriptionHistoryCount.rows[0].count;

			const paginationDetails = paginate(totalHistorySubscriptions, itemsPerPage);

			const result = await sqlQuery({ sql: subscriptionHistoryQuery, values: [businessCurrentSubscription.id] });

			const records = result.rows.reduce((acc, record) => {
				acc.push({
					subscription_id: record.stripe_subscription_id,
					status: record.status,
					created_at: record.created_at
				});
				return acc;
			}, []);

			return {
				records,
				total_pages: paginationDetails.totalPages,
				total_items: paginationDetails.totalItems
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {string} businessID
	 * @returns current subscription of a business
	 * This is internal function to return current subscription of business
	 * implement to reduce code duplication
	 */
	async _getBusinessCurrentSubscription(businessID) {
		try {
			const subscriptionQuery = `SELECT subscriptions.data_businesses_subscriptions.* FROM subscriptions.data_businesses_subscriptions
				LEFT JOIN data_businesses db ON db.id = subscriptions.data_businesses_subscriptions.business_id
				WHERE business_id = $1 AND db.is_deleted = false`;
			const subscription = await sqlQuery({ sql: subscriptionQuery, values: [businessID] });
			return subscription;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * this is internal function which maps stripe statues to our own status
	 * @param {string} stripeStatus
	 * @returns {string} status
	 * from stripe: Possible values are incomplete, incomplete_expired, trialing, active, past_due, canceled, or unpaid.
	 * trialing is not used in our system
	 *
	 * Since our charge mechanism is charge_automatically, a subscription moves to unpaid and past_due ONLY after one or more payment attempts have failed.
	 * So it is safe to assume that a payment attempt has failed for given subscription
	 */
	_getSubscriptionStatusMapping(stripeStatus) {
		const statusMapping = {
			incomplete: "NOT_SUBSCRIBED",
			incomplete_expired: "NOT_SUBSCRIBED",
			active: "SUBSCRIBED",
			past_due: "PAYMENT_DECLINED",
			canceled: "UNSUBSCRIBED",
			unpaid: "PAYMENT_DECLINED",
			trialing: "SUBSCRIBED"
		};

		const status = statusMapping[stripeStatus];

		if (!status) {
			throw new SubscriptionsApiError(
				`Invalid Subscription Status: ${stripeStatus}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		return status;
	}

	async getSubscriptionByID(subscriptionID) {
		try {
			const subscriptionResult = await sqlQuery({
				sql: `SELECT subscriptions.data_businesses_subscriptions.* FROM subscriptions.data_businesses_subscriptions
				LEFT JOIN data_businesses db ON db.id = subscriptions.data_businesses_subscriptions.business_id
				WHERE subscriptions.data_businesses_subscriptions.id = $1 AND db.is_deleted = false`,
				values: [subscriptionID]
			});
			return subscriptionResult.rows;
		} catch (error) {
			throw error;
		}
	}

	async updateSubscriptionByID(subscriptionID, status) {
		try {
			const updateSubscriptionQuery = `UPDATE subscriptions.data_businesses_subscriptions SET status = $1 WHERE id = $2`;
			await sqlQuery({ sql: updateSubscriptionQuery, values: [status, subscriptionID] });
		} catch (error) {
			throw error;
		}
	}

	async stripeWebhookSubscriptions(sig, body) {
		try {
			// check for stripe signature
			let event: any;
			try {
				event = await getStripeInstance().constructWebhookEvent(
					body,
					sig,
					envConfig.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET
				);
			} catch (error: any) {
				logger.error({ error }, "Something went wrong in stripe signature");
				return { message: `Something went wrong for signature: ${error.message}`, data: {} };
			}

			const { object } = event.data;

			let subscription, invoice;
			switch (object.object) {
				case "subscription":
					subscription = {
						subscription_id: object.metadata.subscription_id,
						stripe_subscription_id: object.id, // stripe subscription id
						business_id: object.metadata.business_id,
						business_name: object.metadata.business_name,
						applicant_id: object.metadata.applicant_id,
						stripe_customer_id: object.customer,
						status: this._getSubscriptionStatusMapping(object.status),
						stripe_status: object.status,
						ended_at: object.ended_at ? new Date(object.ended_at * 1000) : null,
						next_billing_at: new Date(object.current_period_end * 1000)
					};
					break;

				case "invoice":
					invoice = {
						subscription_id: object.subscription_details.metadata.subscription_id,
						stripe_status: object.status,
						applicant_id: object.subscription_details.metadata.applicant_id,
						business_name: object.subscription_details.metadata.business_name
					};
					break;

				default:
					logger.error(`Object type not found: ${object.object}`);
					return { message: `Object type not found: ${object.object}`, data: {} };
			}

			let subscriptionData;
			let message = {};
			switch (event.type) {
				case "customer.subscription.created":
					// this means that the subscription process is initiated
					subscriptionData = await this.getSubscriptionByID(subscription.subscription_id);
					if (!subscriptionData.length) {
						throw new SubscriptionsApiError("Subscription not found", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}

					// this event purpose is to insert the stripe subscription id in our db
					// TODO: sanity of below query in updateSubscriptionById func
					await sqlQuery({
						sql: `UPDATE subscriptions.data_businesses_subscriptions SET stripe_subscription_id = $1 WHERE id = $2`,
						values: [subscription.stripe_subscription_id, subscriptionData[0].id]
					});

					break;

				case "customer.subscription.updated":
					// when subscription starts or cancelled, in short update in subscription
					if (object.cancellation_details.reason) {
						subscription.stripe_status =
							object.cancellation_details.comment === "canceled_by_admin" ? "canceled_by_admin" : "canceled";
						message = {
							applicant_id: subscription.applicant_id,
							status: subscription.stripe_status,
							case: subscription.stripe_status === "canceled_by_admin" ? "canceled_by_admin" : "canceled_by_business",
							business_name: subscription.business_name
						};
					}
					break;

				case "customer.subscription.deleted":
					// when a customer’s subscription ends
					// we can update status to "UNSUBSCRIBED"
					subscriptionData = await this.getSubscriptionByID(subscription.subscription_id);
					if (!subscriptionData.length) {
						throw new SubscriptionsApiError("Subscription not found", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}

					// updating the subscription status to "SUBSCRIBED"
					await this.updateSubscriptionByID(subscriptionData[0].id, SUBSCRIPTIONS.UNSUBSCRIBED);
					break;

				case "customer.subscription.paused":
					break;
				case "customer.subscription.pending_update_applied":
					break;
				case "customer.subscription.pending_update_expired":
					break;
				case "customer.subscription.resumed":
					break;
				case "customer.subscription.trial_will_end":
					break;

				case "invoice.paid":
					// payment is successful
					subscriptionData = await this.getSubscriptionByID(invoice.subscription_id);
					if (!subscriptionData.length) {
						throw new SubscriptionsApiError("Subscription not found", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}

					// updating the subscription status to "SUBSCRIBED"
					await this.updateSubscriptionByID(subscriptionData[0].id, SUBSCRIPTIONS.SUBSCRIBED);
					break;

				case "invoice.payment_failed":
					// payment failed, updating db status
					subscriptionData = await this.getSubscriptionByID(invoice.subscription_id);
					if (!subscriptionData.length) {
						throw new SubscriptionsApiError("Subscription not found", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}

					// updating the subscription status to "PAYMENT_FAILED"
					await this.updateSubscriptionByID(subscriptionData[0].id, SUBSCRIPTIONS.PAYMENT_FAILED);

					message = {
						applicant_id: invoice.applicant_id,
						case: "payment_failed",
						business_name: invoice.business_name
					};
					break;

				case "invoice.overdue":
					// payment pending
					// can update status to "PAYMENT_PENDING"
					break;

				case "invoice.upcoming":
					// sent a few days prior to the renewal of the subscription
					break;

				case "invoice.will_be_due":
					break;

				default:
					logger.error(`Event type not found: ${event.type}`);
					return { message: `Event type not found: ${event.type}`, data: {} };
			}

			if (Object.keys(message).length) {
				// Triggering kafka event to auth svc, only when payment is either canceled or failed
				// we are not sending an email when payment is successful
				const payload = {
					topic: kafkaTopics.USERS_NEW,
					messages: [
						{
							key: subscriptionData?.[0]?.business_id,
							value: {
								event: kafkaEvents.SEND_STRIPE_SUBSCRIPTION_EMAIL,
								...message
							}
						}
					]
				};

				await producer.send(payload);
			}

			try {
				await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], {
					business_id: subscriptionData[0].business_id
				});
			} catch (error: any) {
				logger.error({ error }, "sendEventToGatherWebhookData");
			}

			return { message: "Success", data: {} };
		} catch (error: any) {
			if (error instanceof SubscriptionsApiError) {
				throw error;
			}
			logger.error({ error }, "Error occured in stripe webhook");
			throw new SubscriptionsApiError(
				`Some error occurred in stripe webhook: ${error.message}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}
}

export const subscriptions = new Subscriptions();
