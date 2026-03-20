import { joiExtended as Joi } from "#helpers/joiExtended";
import { CADENCE_VALUES } from "../constants";

const cadence = Joi.string()
	.valid(...Object.keys(CADENCE_VALUES))
	.required();

export const templateSchema = {
	listTemplates: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		query: Joi.object().unknown()
	},
	createTemplate: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		body: Joi.object({
			priority: Joi.number().integer().min(0),
			is_active: Joi.boolean(),
			is_default: Joi.boolean(),
			label: Joi.string().max(255).required(),
			integration_groups: Joi.array().items(
				Joi.object({ integration_group: Joi.number().integer().required(), cadence })
			),
			rule_ids: Joi.array().items(Joi.string().uuid())
		})
	},
	getTemplate: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			templateID: Joi.string().uuid().required()
		})
	},
	updateTemplate: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			templateID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			priority: Joi.number().integer().min(0),
			is_active: Joi.boolean(),
			is_default: Joi.boolean(),
			label: Joi.string().max(255),
			integration_groups: Joi.array().items(
				Joi.object({ integration_group: Joi.number().integer().required(), cadence })
			),
			rule_ids: Joi.array().items(Joi.string().uuid())
		}).min(1)
	},
	deleteTemplate: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			templateID: Joi.string().uuid().required()
		})
	}
};
