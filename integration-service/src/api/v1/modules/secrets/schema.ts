import { joiExtended as Joi } from "#helpers/index";

const customerIdSchema = Joi.string().min(1).max(100).trim().required().noInjection().messages({
	"string.min": "Customer ID must be at least 1 character",
	"string.max": "Customer ID cannot exceed 100 characters",
	"string.empty": "Customer ID is required"
});

export const schema = {
	createSecret: {
		body: Joi.object({
			customer_id: customerIdSchema,
			storage_data: Joi.string().required().noInjection().messages({
				"string.empty": "Storage data is required"
			})
		})
	},
	getSecret: {
		params: Joi.object({
			customer_id: customerIdSchema
		})
	},
	updateSecret: {
		params: Joi.object({
			customer_id: customerIdSchema
		}),
		body: Joi.object({
			storage_data: Joi.string().required().noInjection().messages({
				"string.empty": "Storage data is required"
			})
		})
	},
	deleteSecret: {
		params: Joi.object({
			customer_id: customerIdSchema
		})
	}
};
