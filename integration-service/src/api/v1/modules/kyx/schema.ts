import Joi from "joi";

export const schema = {
	kyxMatch: {
		body: Joi.object({			
			business_id: Joi.string().uuid().required(),
			body: Joi.object().required()
		})
	},
	getKyxMatch: {
		params: Joi.object({
			businessId: Joi.string().uuid().required()
		})
	},
	getJobStatus: {
		params: Joi.object({
			jobId: Joi.string().required()
		})
	},
};
