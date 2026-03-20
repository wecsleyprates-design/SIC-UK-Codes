import { joiExtended as Joi } from "#helpers/joiExtended";

export const riskCategorySchema = {
	listRiskCategories: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		query: Joi.object({ active_only: Joi.boolean() })
	},
	getRiskCategory: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			categoryID: Joi.string().uuid().required()
		})
	},
	createRiskCategory: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		body: Joi.object({
			label: Joi.string().max(255).required(),
			is_active: Joi.boolean()
		})
	},
	updateRiskCategory: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			categoryID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			label: Joi.string().max(255),
			is_active: Joi.boolean()
		}).min(1)
	},
	deleteRiskCategory: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			categoryID: Joi.string().uuid().required()
		})
	}
};
