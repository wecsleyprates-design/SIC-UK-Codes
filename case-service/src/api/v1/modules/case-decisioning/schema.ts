import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getWorkflowDecisioningConfiguration: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},
	updateWorkflowDecisioningConfiguration: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			decisioning_type: Joi.string().valid("worth_score", "custom_workflow").required().messages({
				"any.only": "decisioning_type must be either 'worth_score' or 'custom_workflow'",
				"any.required": "decisioning_type is required"
			})
		})
	}
};
