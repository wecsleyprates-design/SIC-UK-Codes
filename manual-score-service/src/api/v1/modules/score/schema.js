import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getScore: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			customer_id: Joi.string().uuid().optional(),
			year: Joi.number().optional(),
			month: Joi.number().optional(),
			score_trigger_id: Joi.string().uuid().optional()
		})
	},
	getScoreDate: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			customer_id: Joi.string().uuid().optional(),
			fetch_all_scores: Joi.boolean().optional()
		})
	},
	getCaseScore: {
		params: Joi.object({
			caseID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			risk: Joi.boolean().optional()
		})
	},
	patchCaseScore: {
		params: Joi.object({
			caseID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			values_generated_at: Joi.string().isoDate().required()
		})
	},
	forceScore: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			scoreTriggerID: Joi.string().uuid().required()
		})
	},
	getScoreInputs: {
		params: Joi.object({
			scoreID: Joi.string().uuid().required()
		})
	},
	getScoreTrendChart: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			customer_id: Joi.string().uuid().optional(),
			year: Joi.number().optional()
		})
	},
	getCustomerScoreConfig: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},
	addCustomerScoreConfig: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			addExisting: Joi.boolean().required(),
			isEnabled: Joi.boolean().default(true).required(),
			config: Joi.when("addExisting", {
				is: false,
				then: Joi.object().required(),
				otherwise: Joi.forbidden()
			})
		})
	},
	updateCustomerScoreConfig: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			updateExisting: Joi.boolean().required(),
			isEnabled: Joi.boolean().optional(),
			config: Joi.when("updateExisting", {
				is: true,
				then: Joi.array()
					.items(
						Joi.object({
							path: Joi.string().required(),
							value: Joi.any().required()
						})
					)
					.optional(),
				otherwise: Joi.object().optional()
			})
		})
	}
};
