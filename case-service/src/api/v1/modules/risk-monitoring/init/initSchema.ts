import { joiExtended as Joi } from "#helpers/joiExtended";

export const initSchema = {
	initCustomer: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		body: Joi.object().unknown()
	}
};
