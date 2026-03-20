import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	createSubscription: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			plan_id: Joi.string().required()
		})
	},

	customerPortalSession: Joi.object({
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			return_url: Joi.string().optional(),
			update_plan: Joi.boolean().optional(),
			subscription_id: Joi.string().optional()
		})
	}),

	getBusinessSubscriptionStatus: Joi.object({
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	}),

	getBusinessSubscriptionDetails: Joi.object({
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	}),

	cancelBusinessSubscription: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getBusinessSubscriptionHistory: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	}
};
