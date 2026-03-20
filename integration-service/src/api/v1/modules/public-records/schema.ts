import { joiExtended as Joi } from "#helpers/index";
export const schema = {
	getPublicRecords: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			case_id: Joi.string().uuid().optional(),
			score_trigger_id: Joi.string().uuid().optional()
		})
	},
	getGoogleReviews: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	getBusinessRatings: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			year: Joi.number().integer().required()
		})
	},
	businessAPIConsentInit: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			re_authenticate: Joi.boolean().optional()
		})
	},
	fetchGoogleBusinessReviews: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			caseID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			code: Joi.string().required()
		})
	},
	enrich: {
		// allow body to be passed as a string or an object
		body: Joi.alternatives().try(Joi.object({}).unknown(true), Joi.string())
	},
	getBusinessesData: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},
	// The changes in this PR only shifts some properties from mandatory to optional.
	// Why this works?
	// It works because making these properties optional in the validation really change the response from 400 to 401
	// responsibility for catching missing ts/sig shifts from Joi (which gives 400 for schema violations) to the middleware (which gives 401 for authentication failures like missing signatures)
	// Note: task_id and business_id use .uuid() validation so invalid formats return 400 before signature verification
	verdataWebhook: {
		query: Joi.object({
			business_id: Joi.string().uuid().optional(),
			task_id: Joi.string().uuid().optional(),
			ts: Joi.string().optional(),
			sig: Joi.string().optional()
		})
	}
};
