import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	updateDataRefreshConfig: {
		body: Joi.object({
			MONITORING_REFRESH_CONFIG_IN_DAYS: Joi.number().optional(),
			SUBSCRIPTION_REFRESH_CONFIG_IN_DAYS: Joi.number().optional()
		}).min(1)
	},

	addCronConfig: {
		body: Joi.object({
			job_type: Joi.string().required(),
			config: Joi.object().required()
		})
	},

	updateCronConfig: {
		body: Joi.object({
			job_type: Joi.string().required(),
			config: Joi.object().required()
		})
	},

	updateOnboardingStage: {
		params: Joi.object({
			stageID: Joi.number().required()
		}),
		body: Joi.object({
			is_skippable: Joi.boolean().required()
		})
	},

	updateOnboardingStagesOrder: {
		body: Joi.object({
			stages: Joi.array().items(
				Joi.object({
					id: Joi.number().required(),
					stage: Joi.string().required(),
					priority_order: Joi.number().required(),
					completion_weightage: Joi.number().required(),
					allow_back_nav: Joi.boolean().required(),
					is_skippable: Joi.boolean().required(),
					is_enabled: Joi.boolean().required()
				})
			)
		})
	}
};
