import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	addUpdateRiskAlertConfig: {
		body: Joi.object({
			risk_alert_statuses: Joi.object({
				risk_alerts_status: Joi.boolean().required(),
				score_risk_tier_transition_status: Joi.boolean().required(),
				new_bankruptcy_lien_judgement_status: Joi.boolean().required(),
				worth_score_change_status: Joi.boolean().required(),
				credit_score_config_status: Joi.boolean().required(),
				new_adverse_media: Joi.boolean().required()
			})
				.required()
				.messages({
					"object.base": "risk_alert_statuses must be an object",
					"any.required": "risk_alert_statuses is required"
				}),
			customer_id: Joi.string().uuid().optional(),
			score_config: Joi.array()
				.items(
					Joi.object({
						risk_level: Joi.string().valid("LOW", "MODERATE", "HIGH").required(),
						min: Joi.number().min(0).required(),
						max: Joi.number().max(855).required()
					})
				)
				.max(3)
				.optional(),
			worth_score_change_config: Joi.array()
				.items(
					Joi.object({
						risk_level: Joi.string().valid("HIGH").required(), // only HIGH as of now according to FSD
						drop_value: Joi.number().min(1).max(850).required()
					})
				)
				.max(1)
				.optional(),
			credit_score_config: Joi.array()
				.items(
					Joi.object({
						risk_level: Joi.string().valid("MODERATE").required(), // only MODERATE as of now according to FSD
						drop_percentage: Joi.number().min(1).max(100).required()
					})
				)
				.max(1)
				.optional()
		})
	},
	getRiskAlertConfig: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	}
};
