import { joiExtended as Joi } from "#helpers/index";
import { adverseMediaConsumerSchema } from "#messaging/kafka/consumers/handlers/schema";

const requiredUuid = Joi.string().uuid().required();

export const schema = {
	getAdverseMediaByBusinessId: {
		params: Joi.object({
			businessId: requiredUuid
		}),
		query: Joi.object({
			sortFields: Joi.array().items(
				Joi.object({
					field: Joi.string().valid('entity_focus_score', 'final_score', 'risk_level', 'date').required(),
					order: Joi.string().valid('asc', 'desc').required()
				})
			).default([{ field: 'entity_focus_score', order: 'desc' }])
		})
	},
	getAdverseMediaDataByCaseId: {
		params: Joi.object({
			caseId: requiredUuid
		}),
		query: Joi.object({
			sortFields: Joi.array().items(
				Joi.object({
					field: Joi.string().valid('entity_focus_score', 'final_score', 'risk_level', 'date').required(),
					order: Joi.string().valid('asc', 'desc').required()
				})
			).default([{ field: 'entity_focus_score', order: 'desc' }])
		})
	},
	debugAdverseMedia: {
		body: adverseMediaConsumerSchema
	}
};
