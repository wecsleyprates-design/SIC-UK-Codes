import { joiExtended as Joi } from "#helpers/joiExtended";

export const schema = {
    updateBusinessesCustomerMonitoring: {
        params: Joi.object({
            customerID: Joi.string().uuid().required(),
            businessID: Joi.string().uuid().required()
        }),
        body: Joi.object({
            risk_monitoring: Joi.boolean().required()
        })
    },

    getRiskAlertsByBusiness: {
        params: Joi.object({
            customerID: Joi.string().uuid().required(),
            businessID: Joi.string().uuid().required(),
        }),
        query: Joi.object().unknown()
    }
};