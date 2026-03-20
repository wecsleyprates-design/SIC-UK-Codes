import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getCustomFields: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			fieldId: Joi.string().uuid().optional()
		})
	},

	updateCustomFields: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			fieldId: Joi.string().uuid().optional()
		}),
		body: Joi.object().pattern(Joi.string(), Joi.any()).unknown(true)
	},

	deleteCustomFields: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			fieldId: Joi.string().uuid().optional()
		}),
		body: Joi.object({
			fieldIds: Joi.array().items(Joi.string().uuid()).optional()
		}).optional()
	}
};
