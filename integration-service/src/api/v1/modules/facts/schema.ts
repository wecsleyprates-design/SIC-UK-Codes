import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	businessIDParam: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	caseIDParam: {
		params: Joi.object({
			caseID: Joi.string().uuid().required()
		})
	},
	proxyBusinessDetails: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			category: Joi.string().valid("business-details", "kyb", "bjl", "reviews", "financials", "matches", "all").optional()
		}).optional()
	},
	getFactOverride: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			factName: Joi.string().optional()
		}),
		query: Joi.object({
			customerID: Joi.string().uuid().optional(),
			caseID: Joi.string().uuid().optional()
		}).optional()
	},
	updateFactOverride: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			factName: Joi.string().optional()
		}),
		query: Joi.object({
			customerID: Joi.string().uuid().optional(),
			caseID: Joi.string().uuid().optional()
		}).optional(),
		body: Joi.object().pattern(Joi.string(), Joi.any()).unknown(true)
	},
	deleteFactOverride: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			factName: Joi.string().optional()
		}),
		query: Joi.object({
			customerID: Joi.string().uuid().optional(),
			caseID: Joi.string().uuid().optional()
		}).optional(),
		body: Joi.object().pattern(Joi.string(), Joi.any()).unknown(true).optional()
	}
};
