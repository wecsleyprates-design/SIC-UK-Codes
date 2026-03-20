import { CUSTOM_ONBOARDING_SETUP, CUSTOM_ONBOARDING_TYPES, ROLES } from "#constants";
import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	createCustomTemplate: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},

	getCustomTemplate: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			version: Joi.string().optional()
		})
	},

	getCustomerOnboardingStages: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			setupType: Joi.string()
				.valid(CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP, CUSTOM_ONBOARDING_SETUP.LIGHTNING_VERIFICATION_SETUP)
				.required()
		})
	},
	updateCustomerOnboardingStages: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			setupType: Joi.string()
				.valid(CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP, CUSTOM_ONBOARDING_SETUP.LIGHTNING_VERIFICATION_SETUP)
				.required(),
			stages: Joi.array()
				.items(
					Joi.object({
						stage_id: Joi.string().uuid().required(),
						stage: Joi.string().required(),
						is_enabled: Joi.boolean().required(),
						is_skippable: Joi.boolean().required(),
						config: Joi.object({
							fields: Joi.array()
								.items(
									Joi.object({
										name: Joi.string().required(),
										status: Joi.alternatives()
											.try(
												Joi.string().valid("Required", "Optional", "Hidden"), // Allow string
												Joi.boolean() // Allow boolean
											)
											.required(),
										section_name: Joi.string().optional(),
										sub_fields: Joi.array()
											.items(
												Joi.object({
													name: Joi.string().required(),
													status: Joi.alternatives()
														.try(
															Joi.string().valid("Required", "Optional", "Hidden"), // Allow specific strings
															Joi.string().pattern(/^idvtmp_[A-Za-z0-9]{14}$/),
															Joi.string().pattern(/^[0-9]{1,2}$/),
															Joi.string().allow(""),
															Joi.boolean() // Allow boolean
														)
														.required()
												})
											)
											.optional()
									})
								)
								.optional(),
							integrations: Joi.array()
								.items(
									Joi.object({
										name: Joi.string().required(),
										is_enabled: Joi.boolean().required()
									})
								)
								.optional(),
							additional_settings: Joi.array()
								.items(
									Joi.object({
										name: Joi.string().required(),
										is_enabled: Joi.boolean().required()
									})
								)
								.optional(),
							sub_fields: Joi.array()
								.items(
									Joi.object({
										name: Joi.string().required(),
										parent_name: Joi.string().required(),
										status: Joi.alternatives()
											.try(
												Joi.string().valid("Required", "Optional", "Hidden"), // Allow specific string
												Joi.string().pattern(/^idvtmp_[A-Za-z0-9]{14}$/),
												Joi.string().pattern(/^[0-9]{1,2}$/),
												Joi.string().allow(""),
												Joi.boolean() // Allow boolean
											)
											.required(),
										section_name: Joi.string().optional()
									})
								)
								.optional()
						})
					})
				)
				.required()
		})
	},
	reorderStages: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			onboardingType: Joi.string()
				.valid(CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING, CUSTOM_ONBOARDING_TYPES.LIGHTNING_ONBOARDING)
				.required(),
			stages: Joi.array()
				.items(
					Joi.object({
						stageID: Joi.string().uuid().required(),
						priorityOrder: Joi.number().integer().required()
					})
				)
				.min(2)
				.required()
		})
	},

	getCustomerOnboardingSetups: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},

	updateCustomerOnboardingSetups: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			setups: Joi.array().min(1).items({
				setup_id: Joi.number().required(),
				is_enabled: Joi.boolean().required()
			})
		})
	},

	getAllStages: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			include_config: Joi.boolean().optional()
		})
	},

	getCustomerOnboardingLimitData: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},

	getCustomFieldData: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
		}),
		query: Joi.object({
			pagination: Joi.boolean().optional(),
			page: Joi.number().integer().min(1).optional(),
			itemsPerPage: Joi.number().integer().min(1).optional()
		})
	},

	addOrUpdateCustomerOnboardingLimit: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			limit: Joi.number().integer().allow(null).required()
		})
	},

	getFieldsForRole: {
		params: Joi.object({
			mode: Joi.string().valid("required-fields", "editable-fields").required(),
			customerID: Joi.string().uuid().required(),
			// will infer templateID from the current template if not provided
			role: Joi.string()
				.valid(...[ROLES.CUSTOMER, ROLES.APPLICANT].map(r => r?.toLowerCase()))
				.insensitive()
				.optional()
				.allow(null, "")
		}),
		query: Joi.object({
			templateID: Joi.string().uuid().optional().allow(null, "")
		})
	},
	getCurrentCustomFieldsTemplate: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},
	getCustomerBusinessConfigs: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			businessID: Joi.string().uuid().required()
		})
	},
	postCustomerBusinessConfigs: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			bypass_ssn: Joi.boolean().optional(),
			skip_credit_check: Joi.boolean().optional(),
		})
	},

	getCustomerCountries: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			setupID: Joi.number().integer().required()
		})
	},

	updateCustomerCountries: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			setupID: Joi.number().integer().required()
		}),
		body: Joi.object({
			countries: Joi.array()
				.items(
					Joi.object({
						jurisdiction_code: Joi.string().length(2).uppercase().required(),
						is_enabled: Joi.boolean().required()
					})
				)
				.min(1)
				.required()
		})
	},

	getCustomerCustomFieldsSummary: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	}
};
