import { joiExtended as Joi } from "#helpers/index";
export const schema = {
	fileId: {
		params: Joi.object({
			fileId: Joi.string().uuid().required()
		})
	},
	customerId: {
		params: Joi.object({
			customerId: Joi.string().uuid().required()
		})
	}
};
