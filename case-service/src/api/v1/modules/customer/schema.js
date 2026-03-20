import { joiExtended as Joi } from "#helpers";

// Initiate schema for customer module
export const schema = {
	getCustomerInviteForApplicationEdit: {
		params: Joi.object({
			caseID: Joi.string().uuid().required(),
			customerID: Joi.string().uuid().required()
		})
	},

	getApplicationEditSessions: {
		params: Joi.object({
			caseID: Joi.string().uuid().required(),
			customerID: Joi.string().uuid().required()
		})
	}
};
