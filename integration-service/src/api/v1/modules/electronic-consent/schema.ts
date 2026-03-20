import { joiExtended as Joi } from "#helpers/index";

const signerSchema = Joi.object({
	id: Joi.string().required(),
	email: Joi.string().email().required(),
	fullName: Joi.string().required(),
	title: Joi.string().optional()
});

const documentFieldsSchema = Joi.object({
	legalName: Joi.string().optional(),
	addressLine1: Joi.string().optional(),
	addressLine2: Joi.string().allow("").optional(),
	city: Joi.string().optional(),
	state: Joi.string().optional(),
	zip: Joi.string()
		.pattern(/^\d{5}(-\d{4})?$/u)
		.optional(),
	taxId: Joi.string()
		.pattern(/^\d{2}-\d{7}$/u)
		.optional()
});

const requiredUuid = Joi.string().uuid().required();

export const schema = {
	createSession: {
		params: Joi.object({
			businessID: requiredUuid
		}),
		body: Joi.object({
			templateId: Joi.string().required(),
			signer: signerSchema.required(),
			documentFields: documentFieldsSchema.required(),
			caseId: Joi.string().optional(),
			customerId: Joi.string().optional()
		})
	}
};
