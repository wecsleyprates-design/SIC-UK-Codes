import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getCustomerApplicantConfig: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			coreConfigID: Joi.number().required()
		})
	},

	updateCustomerApplicantConfig: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			coreConfigID: Joi.number().valid(1).required()
		}),
		body: Joi.array()
			.length(3) // exactly 3 items
			.items(
				Joi.object({
					urgency: Joi.string().valid("low", "medium", "high").required(),
					threshold: Joi.number().integer().min(1).required(),
					allowed_case_status: Joi.array().items(Joi.number().integer()).required(),
					message: Joi.string().max(1000).required()
				})
			)
			.custom((value, helpers) => {
				// Ensure exactly one of each urgency: low, medium, high
				const urgencies = value.map(v => v.urgency);
				const required = ["low", "medium", "high"];

				for (const u of required) {
					if (!urgencies.includes(u)) {
						return helpers.error("any.invalid", { message: `Missing urgency: ${u}` });
					}
				}

				// Prevent duplicates
				const unique = new Set(urgencies);
				if (unique.size !== 3) {
					return helpers.error("any.invalid", { message: "Duplicate urgency entries found" });
				}

				return value;
			})
	},

	updateCustomerApplicantStatus: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			coreConfigID: Joi.number().required()
		}),
		body: Joi.object({
			is_enabled: Joi.boolean().required()
		})
	},

	getBusinessApplicantConfig: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			coreConfigID: Joi.number().required()
		})
	},

	updateBusinessApplicantConfig: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			coreConfigID: Joi.number().valid(1).required()
		}),
		body: Joi.array()
			.length(3) // exactly 3 items
			.items(
				Joi.object({
					urgency: Joi.string().valid("low", "medium", "high").required(),
					threshold: Joi.number().integer().min(1).required(),
					allowed_case_status: Joi.array().items(Joi.number().integer()).required(),
					message: Joi.string().max(1000).required()
				})
			)
			.custom((value, helpers) => {
				// Ensure exactly one of each urgency: low, medium, high
				const urgencies = value.map(v => v.urgency);
				const required = ["low", "medium", "high"];

				for (const u of required) {
					if (!urgencies.includes(u)) {
						return helpers.error("any.invalid", { message: `Missing urgency: ${u}` });
					}
				}

				// Prevent duplicates
				const unique = new Set(urgencies);
				if (unique.size !== 3) {
					return helpers.error("any.invalid", { message: "Duplicate urgency entries found" });
				}

				return value;
			})
	},

	updateBusinessApplicantStatus: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			coreConfigID: Joi.number().required()
		}),
		body: Joi.object({
			is_enabled: Joi.boolean().required()
		})
	}
};
