import { catchAsync } from "#utils/index";
import { subscriptions } from "./subscriptions";

export const controller = {
	createSubscription: catchAsync(async (req, res) => {
		const response = await subscriptions.createSubscription(req.params, req.body, res.locals.user, req.headers);
		res.jsend.success(response, "Subscription checkout session started successfully");
	}),

	createCustomerPortalSession: catchAsync(async (req, res) => {
		const response = await subscriptions.createCustomerPortalSession(req.params, req.body, res.locals.user, req.headers);
		res.jsend.success(response, "Customer portal session created successfully");
	}),

	getBusinessSubscriptionDetails: catchAsync(async (req, res) => {
		const response = await subscriptions.getBusinessSubscriptionDetails(req.params, res.locals.user, req.headers);
		res.jsend.success(response, "Subsciption details fetched successfully");
	}),

	getBusinessSubscriptionStatus: catchAsync(async (req, res) => {
		const response = await subscriptions.getBusinessSubscriptionStatus(req.params, res.locals.user, req.headers);
		res.jsend.success(response, "Subscription status fetched successfully");
	}),

	getSubscriptionPlans: catchAsync(async (req, res) => {
		const response = await subscriptions.getSubscriptionPlans(req.query);
		res.jsend.success(response, "Subscription plans fetched successfully");
	}),

	cancelBusinessSubscription: catchAsync(async (req, res) => {
		const response = await subscriptions.cancelBusinessSubscription(req.params, res.locals.user);
		res.jsend.success(response, "Subscription cancelled successfully");
	}),

	getBusinessSubscriptionHistory: catchAsync(async (req, res) => {
		const response = await subscriptions.getBusinessSubscriptionHistory(req.params, req.query);
		res.jsend.success(response, "Subscription history fetched successfully");
	}),

	// handled by route in app.js
	stripeWebhookSubscriptions: catchAsync(async (req, res) => {
		const sig = req.headers["stripe-signature"];
		const response = await subscriptions.stripeWebhookSubscriptions(sig, req.body);
		res.jsend.success(response.data, response.message);
	})
};
