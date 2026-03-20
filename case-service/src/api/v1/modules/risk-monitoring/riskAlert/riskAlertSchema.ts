import { joiExtended as Joi } from "#helpers/joiExtended";

export const riskAlertSchema = {
	listRiskAlerts: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		query: Joi.object().unknown()
	},
	getRiskAlert: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			alertID: Joi.string().uuid().required()
		})
	},
	createRiskAlert: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		body: Joi.object({
			label: Joi.string().max(255).required(),
			description: Joi.string().allow("", null),
			is_active: Joi.boolean(),
			category_id: Joi.string().uuid().allow(null),
			bucket_id: Joi.string().uuid().allow(null),
			routing: Joi.object().unknown(),
			rule_ids: Joi.array().items(Joi.string().uuid())
		})
	},
	updateRiskAlert: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			alertID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			label: Joi.string().max(255),
			description: Joi.string().allow("", null),
			is_active: Joi.boolean(),
			category_id: Joi.string().uuid().allow(null),
			bucket_id: Joi.string().uuid().allow(null),
			routing: Joi.object().unknown(),
			rule_ids: Joi.array().items(Joi.string().uuid())
		}).min(1)
	},
	deleteRiskAlert: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			alertID: Joi.string().uuid().required()
		})
	}
};
