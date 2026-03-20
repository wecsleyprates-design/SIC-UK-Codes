import { joiExtended as Joi } from "#helpers/index";

const needString = Joi.string().min(1).required();
export const schema = {
	rutter: {
		body: Joi.object({
			type: needString,
			code: needString,
			access_token: needString,
			connection_id: needString,
			store_unique_id: Joi.string().optional()
		}).unknown(),
		query: Joi.object().unknown()
	},
	plaid_idv: {
		body: Joi.object({
			webhook_type: Joi.string().valid("IDENTITY_VERIFICATION").required(),
			webhook_code: Joi.string().valid("STATUS_UPDATED").required(),
			identity_verification_id: needString,
			environment: Joi.string().valid("production", "sandbox", "development").required()
		}).unknown(),
		query: Joi.object().unknown()
	}
};
