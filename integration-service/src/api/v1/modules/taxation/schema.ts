import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getTaxFilings: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			formType: Joi.string().allow("").optional()
		}),
		query: Joi.object({
			score_trigger_id: Joi.string().uuid().optional(),
			caseID: Joi.string().uuid().optional()
		})
	},
	getTaxStats: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			period: Joi.string().valid("yearly", "quartely").optional()
		})
	},
	taxFilingDataFetch: {
		params: Joi.object({
			caseID: Joi.string().uuid().required()
		})
	},

	addTaxFiling: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			case_id: Joi.string().uuid().required(),
			customer_id: Joi.string().uuid().optional(),
			validation_ocr_document_ids: Joi.array().items(Joi.string().uuid()).optional(),
			manual: Joi.object({
				form: Joi.string().allow("1040", "941", "1120", "1099", "8862").required(),
			}).optional().unknown(true)
		}).xor("manual", "validation_ocr_document_ids")
	}
};
