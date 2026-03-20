import { joiExtended as Joi } from "#helpers/index";

const requiredUUID = Joi.string().uuid().required();

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
}).unknown(true);

export const schema = {
	createSession: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			templateId: Joi.string().required(),
			eSignTemplateId: requiredUUID,
			signer: signerSchema.required(),
			documentFields: documentFieldsSchema.required(),
			caseId: requiredUUID,
			userId: requiredUUID,
			customerId: requiredUUID
		})
	},

	addTemplate: {
		params: Joi.object({
			customerID: requiredUUID
		}),

		body: Joi.array()
			.items(
				Joi.object({
					template_id: requiredUUID,
					is_selected: Joi.boolean().required()
				})
			)
			.min(1)
			.required()
	},

	getTemplates: {
		params: Joi.object({
			customerID: requiredUUID
		})
	},

	getSignedDocuments: {
		params: Joi.object({
			businessID: requiredUUID
		}),

		query: Joi.object({
			case_id: Joi.string().uuid().optional()
		})
	},

	mockEsign: {
		params: Joi.object({
			businessID: requiredUUID
		}),

		body: Joi.object({
			template_id: requiredUUID,
			customer_id: requiredUUID,
			case_id: requiredUUID
		})
	},

	addGlobalTemplate: {
		body: Joi.object({
			tags: Joi.array().items(Joi.string().max(50)).optional()
		})
	}
};
