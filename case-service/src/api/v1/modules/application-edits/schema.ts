import Joi from "joi";

const requiredUUID = Joi.string().uuid().required();

export const schema = {
	applicationEdit: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			customer_id: requiredUUID,
			case_id: requiredUUID,
			stage_name: Joi.string().required(),
			created_by: requiredUUID,
			user_name: Joi.string().required(),
			data: Joi.array()
				.items(
					Joi.object({
						field_name: Joi.string().required(),
						old_value: Joi.string().allow(null),
						new_value: Joi.string().allow(null),
						metadata: Joi.object().optional()
					})
				)
				.min(1)
				.required()
		})
	},

	getApplicationEdit: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			stage_name: Joi.string()
			.valid("company", "ownership", "processing_history", "tax_filing")
			.optional()
		})
	},

	applicationEditStatus: {
		params: Joi.object({
			customerID: requiredUUID
		}),
		body: Joi.object({
			case_id: requiredUUID
		})
	},

	clearApplicationEditLock: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			customer_id: requiredUUID,
			case_id: requiredUUID
		})
	},

	applicationEditSubmit: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			case_id: requiredUUID
		})
	}
};
