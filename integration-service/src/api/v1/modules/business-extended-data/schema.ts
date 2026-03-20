import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	businessIDParam: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	}
};
