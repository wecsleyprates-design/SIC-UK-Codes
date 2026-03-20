import { joiExtended as Joi } from "#helpers/joiExtended";

export const businessTemplateSchema = {
	setBusinessTemplate: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({ template_id: Joi.string().uuid().required() })
	},
	getBusinessTemplate: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			businessID: Joi.string().uuid().required()
		})
	}
};
