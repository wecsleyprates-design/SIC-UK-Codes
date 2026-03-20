import Joi from "joi";

export const monitoringRunSchema = {
	runRefresh: {
		params: Joi.object({ customerID: Joi.string().uuid().required() })
	}
};
