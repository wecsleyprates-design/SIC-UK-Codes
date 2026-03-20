import { joiExtended as Joi } from "#helpers/joiExtended";

export const riskBucketSchema = {
	listRiskBuckets: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		query: Joi.object({ active_only: Joi.boolean() })
	},
	getRiskBucket: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			bucketID: Joi.string().uuid().required()
		})
	},
	createRiskBucket: {
		params: Joi.object({ customerID: Joi.string().uuid().required() }),
		body: Joi.object({
			label: Joi.string().max(255).required(),
			is_active: Joi.boolean()
		})
	},
	updateRiskBucket: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			bucketID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			label: Joi.string().max(255),
			is_active: Joi.boolean()
		}).min(1)
	},
	deleteRiskBucket: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			bucketID: Joi.string().uuid().required()
		})
	}
};
