import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getBankingData: {
		body: Joi.object({
			score_trigger_id: Joi.string().uuid().required(),
			query: Joi.object({
				filter_date: Joi.object({
					start_date: Joi.string().required(),
					end_date: Joi.string().required()
				}).optional()
			}).optional()
		})
	},

	getPublicRecords: {
		parbodyams: Joi.object({
			score_trigger_id: Joi.string().uuid().required()
		})
	}
};
