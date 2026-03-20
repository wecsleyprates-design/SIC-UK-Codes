import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getJobsByRequestID: {
		params: Joi.object({
			requestID: Joi.string().uuid().required()
		})
	},
	getJobByID: {
		params: Joi.object({
			jobID: Joi.string().required()
		})
	},
	removeJobByID: {
		params: Joi.object({
			jobID: Joi.string().required(),
			queueName: Joi.string().required()
		})
	},
	removeAllJobsByQueueName: {
		params: Joi.object({
			queueName: Joi.string().required()
		})
	},
	getJobStalledStats: {
		params: Joi.object({
			queueName: Joi.string().required(),
			jobID: Joi.alternatives(Joi.string(), Joi.number())
		})
	}
};
