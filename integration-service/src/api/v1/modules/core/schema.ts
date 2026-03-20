import { INTEGRATION_CATEGORIES, INTEGRATION_ID, TaskCodeEnum } from "#constants";
import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getConnectedIntegrations: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			caseID: Joi.string().uuid().optional()
		})
	},
	populateBusinessDetails: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	updateConnectionStatusToSuccess: {
		body: Joi.object({
			platform_id: Joi.number().required(),
			prev_statusses: Joi.array().optional()
		})
	},
	getCaseVerifications: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			caseID: Joi.string().uuid().required(),
			customerID: Joi.string().uuid().required()
		})
	},
	getIntegrationsMetadata: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	rerunIntegrations: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			platform_codes: Joi.array()
				.items(
					Joi.string()
						.valid(...Object.keys(INTEGRATION_ID))
						.insensitive()
				)
				.optional(),
			category_codes: Joi.array()
				.items(
					Joi.string()
						.valid(...Object.keys(INTEGRATION_CATEGORIES))
						.insensitive()
				)
				.optional(),
			task_codes: Joi.array()
				.items(
					Joi.string()
						.valid(...Object.keys(TaskCodeEnum))
						.insensitive()
				)
				.optional(),
			fact_names: Joi.array().items(Joi.string().insensitive()).optional(),
			metadata: Joi.object().optional()
		}).or("platform_codes", "category_codes", "task_codes", "fact_names")
	},
	getIntegrationGroups: {
		query: Joi.object({
			with_integrations: Joi.string().valid("true", "false").insensitive().optional()
		})
	},
	createIntegrationGroup: {
		body: Joi.object({
			id: Joi.number().integer().min(1).max(32767).required(),
			name: Joi.string().max(255).required()
		})
	},
	updateIntegrationGroup: {
		params: Joi.object({
			id: Joi.string().pattern(/^\d+$/).required()
		}),
		body: Joi.object({
			name: Joi.string().max(255).required()
		})
	},
	deleteIntegrationGroup: {
		params: Joi.object({
			id: Joi.string().pattern(/^\d+$/).required()
		})
	},
	addIntegrationToGroup: {
		params: Joi.object({
			id: Joi.string().pattern(/^\d+$/).required()
		}),
		body: Joi.object({
			integration_task: Joi.number().integer().required()
		})
	},
	removeIntegrationFromGroup: {
		params: Joi.object({
			id: Joi.string().pattern(/^\d+$/).required(),
			integrationTaskId: Joi.string().pattern(/^\d+$/).required()
		})
	}
};
