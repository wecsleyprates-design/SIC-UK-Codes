import { joiExtended as Joi } from "#helpers/index";

const needUuid = Joi.string().uuid().required();

export const schema = {
	scoreOwners: {
		params: Joi.object({
			business_id: needUuid
		}),
		query: Joi.object().unknown()
	},
	scoreOwner: {
		params: Joi.object({
			business_id: needUuid,
			owner_id: needUuid
		}),
		query: Joi.object().unknown()
	},
	getCustomerBusinessOwnerScores: {
		params: Joi.object({
			business_id: needUuid,
			customer_id: needUuid
		}),
		query: Joi.object().unknown()
	},
	enrich: {
		// allow body to be passed as a string or an object
		body: Joi.alternatives().try(Joi.object({}).unknown(true), Joi.string())
	},
	getReport: {
		params: Joi.object({
			business_id: needUuid
		}),
		query: Joi.object().unknown()
	}
};
