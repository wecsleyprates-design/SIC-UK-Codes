import { INTEGRATION_ID } from "#constants";
import { joiExtended as Joi } from "#helpers/index";

function generatePaymentProcessorCredentialsSchema(optionalUpdate: boolean = false) {
	const schema = Joi.object({
		stripe: Joi.object({
			publishable_key: Joi.string().required().messages({
				"string.empty": "Stripe Publishable Key is required"
			}),
			secret_key: Joi.string().required().messages({
				"string.empty": "Stripe Secret Key is required"
			})
		})
		// TODO: Add additional processors here as needed
	});

	// Only enforce that at least one processor config exists for create (POST) requests.
	if (optionalUpdate) {
		return schema.optional();
	}

	return schema.or("stripe").messages({
		"object.missing": "You must provide at least one payment processor configuration: stripe"
	});
}

const paymentProcessorCredentialsSchema = generatePaymentProcessorCredentialsSchema();
const optionalPaymentProcessorCredentialsSchema = generatePaymentProcessorCredentialsSchema(true).optional();

export const schema = {
	postPaymentProcessorEntitlements: {
		body: Joi.object({
			enabled: Joi.boolean().required().messages({
				"boolean.base": "Enabled must be a boolean",
				"any.required": "Enabled is required"
			})
		})
	},
	getBusinessPaymentProcessorAccounts: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			}),
			businessId: Joi.string().uuid().required().messages({
				"string.uuid": "Business ID must be a valid UUID",
				"any.required": "Business ID is required"
			})
		})
	},
	getBusinessPaymentProcessorAccount: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			}),
			businessId: Joi.string().uuid().required().messages({
				"string.uuid": "Business ID must be a valid UUID",
				"any.required": "Business ID is required"
			}),
			processorAccountId: Joi.string().uuid().required().messages({
				"string.uuid": "Processor Account ID must be a valid UUID",
				"any.required": "Processor Account ID is required"
			})
		})
	},
	getProcessorAccountStatus: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			}),
			processorAccountId: Joi.string().uuid().required().messages({
				"string.uuid": "Processor Account ID must be a valid UUID",
				"any.required": "Processor Account ID is required"
			})
		})
	},
	getPaymentProcessorEntitlements: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			})
		})
	},
	getMerchantProfileBusinessId: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			}),
			businessId: Joi.string().min(1).max(100).trim().required().noInjection().messages({
				"string.min": "Business ID must be at least 1 character",
				"string.max": "Business ID cannot exceed 100 characters",
				"string.empty": "Business ID is required"
			})
		}),
		query: Joi.object({
			platformId: Joi.number().integer().required().valid(INTEGRATION_ID.STRIPE).messages({
				"number.base": "Platform ID must be a number",
				"any.required": "Platform ID is required"
			}),
			withAccountInfo: Joi.string().valid("true", "false").optional().messages({
				"any.only": "withAccountInfo must be either 'true' or 'false'"
			})
		})
	},

	getManyMerchantProfilesByBusinessIds: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			})
		}),
		body: Joi.object({
			platformId: Joi.number().integer().required().messages({
				"number.base": "Platform ID must be a number",
				"any.required": "Platform ID is required"
			}),
			businessIds: Joi.array()
				.items(
					Joi.string().min(1).max(100).trim().noInjection().messages({
						"string.min": "Business ID must be at least 1 character",
						"string.max": "Business ID cannot exceed 100 characters",
						"string.empty": "Business ID cannot be empty"
					})
				)
				.min(1)
				.required()
				.messages({
					"array.min": "At least one Business ID is required",
					"any.required": "Business IDs are required"
				})
		})
	},

	createMerchantProfiles: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			})
		}),
		body: Joi.object({
			processorId: Joi.string().uuid().required().messages({
				"string.uuid": "Processor ID must be a valid UUID",
				"any.required": "Processor ID is required"
			}),
			onboardImmediately: Joi.boolean()
				.required()
				.messages({
					"boolean.base": "onboardImmediately must be a boolean",
					"any.required": "onboardImmediately is required"
				})
				.required(),
			paymentGroupId: Joi.string().min(1).max(100).trim().noInjection().messages({
				"string.min": "Payment Group ID must be at least 1 character",
				"string.max": "Payment Group ID cannot exceed 100 characters"
			}),
			platformId: Joi.number().integer().required().valid(INTEGRATION_ID.STRIPE).messages({
				"number.base": "Platform ID must be a number",
				"any.required": "Platform ID is required"
			}),
			capabilities: Joi.object({
				card_payments: Joi.object({
					requested: Joi.boolean().valid(true).required().messages({
						"any.only": "card_payments capability must be requested as true",
						"any.required": "card_payments capability is required"
					})
				}).required(),
				transfers: Joi.object({
					requested: Joi.boolean().valid(true).required().messages({
						"any.only": "transfers capability must be requested as true",
						"any.required": "transfers capability is required"
					})
				}).required(),
				us_bank_account_ach_payments: Joi.object({
					requested: Joi.boolean().valid(true).required().messages({
						"any.only": "us_bank_account_ach_payments capability must be requested as true",
						"any.required": "us_bank_account_ach_payments capability is required"
					})
				}).required()
			}).required(),
			businesses: Joi.array()
				.items(
					Joi.object({
						businessId: Joi.string().min(1).max(100).trim().required().noInjection().messages({
							"string.min": "Business ID must be at least 1 character",
							"string.max": "Business ID cannot exceed 100 characters",
							"string.empty": "Business ID is required"
						}),
						platformId: Joi.number().integer().required().valid(INTEGRATION_ID.STRIPE).messages({
							"number.base": "Platform ID must be a number",
							"any.required": "Platform ID is required"
						}),
						banking: Joi.object({
							bankId: Joi.string().uuid().required().messages({
								"string.uuid": "Bank ID must be a valid UUID",
								"any.required": "Bank ID is required"
							}),
							bankType: Joi.string().min(1).max(50).trim().required().noInjection().messages({
								"string.min": "Bank Type must be at least 1 character",
								"string.max": "Bank Type cannot exceed 50 characters",
								"string.empty": "Bank Type is required"
							})
						}).required()
					})
				)
				.min(1)
				.required()
				.messages({
					"array.min": "At least one merchant profile is required",
					"any.required": "Context Variables are required."
				})
		})
	},
	setTermsOfService: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			}),
			businessId: Joi.string().uuid().required().messages({
				"string.uuid": "Business ID must be a valid UUID",
				"any.required": "Business ID is required"
			}),
			processorId: Joi.string().uuid().required().messages({
				"string.uuid": "Processor ID must be a valid UUID",
				"any.required": "Processor ID is required"
			})
		}),
		body: Joi.object({
			accepted: Joi.boolean().valid(true).required().messages({
				"any.only": "You must accept the Terms of Service",
				"any.required": "Acceptance of the Terms of Service is required"
			}),
			ip_address: Joi.string()
				.ip({ version: ["ipv4", "ipv6"] })
				.required()
				.messages({
					"string.ip": "IP Address must be a valid IP",
					"any.required": "IP Address is required"
				}),
			user_agent: Joi.string().min(1).max(300).trim().required().noInjection().messages({
				"string.min": "User Agent must be at least 1 character",
				"string.max": "User Agent cannot exceed 300 characters",
				"string.empty": "User Agent is required"
			})
		})
	},

	prefillPaymentProcessorAccounts: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			})
		}),
		query: Joi.object({
			force: Joi.boolean().optional().messages({
				"boolean.base": "Force must be a boolean"
			})
		}),
		body: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			}),
			processorId: Joi.string().uuid().required().messages({
				"string.uuid": "Processor ID must be a valid UUID",
				"any.required": "Processor ID is required"
			}),
			platformId: Joi.number().integer().required().valid(INTEGRATION_ID.STRIPE).messages({
				"number.base": "Platform ID must be a number",
				"any.required": "Platform ID is required"
			}),
			businessIds: Joi.array()
				.items(
					Joi.string().min(1).max(100).trim().noInjection().messages({
						"string.min": "Business ID must be at least 1 character",
						"string.max": "Business ID cannot exceed 100 characters",
						"string.empty": "Business ID cannot be empty"
					})
				)
				.min(1)
				.required()
				.messages({
					"array.min": "At least one Business ID is required",
					"any.required": "Business IDs are required"
				})
		})
	},
	createProcessor: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			})
		}),
		body: Joi.object({
			name: Joi.string().required().messages({
				"string.empty": "Name is required"
			})
		}).concat(paymentProcessorCredentialsSchema)
	},
	getOrDeleteProcessor: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			}),
			processorId: Joi.string().uuid().required().messages({
				"string.uuid": "Processor ID must be a valid UUID",
				"any.required": "Processor ID is required"
			})
		})
	},
	updateProcessor: {
		params: Joi.object({
			customerId: Joi.string().uuid().required().messages({
				"string.uuid": "Customer ID must be a valid UUID",
				"any.required": "Customer ID is required"
			}),
			processorId: Joi.string().uuid().required().messages({
				"string.uuid": "Processor ID must be a valid UUID",
				"any.required": "Processor ID is required"
			})
		}),
		body: Joi.object({
			name: Joi.string().optional()
		}).concat(optionalPaymentProcessorCredentialsSchema)
	},

	stripeWebhook: {
		params: Joi.object({
			customerId: Joi.string().uuid().required(),
			processorId: Joi.string().uuid().required()
		})
	},
	getProcessorAccountSession: {
		params: Joi.object({
			customerId: Joi.string().uuid().required(),
			processorAccountId: Joi.string().uuid().required(),
			businessId: Joi.string().uuid().required()
		})
	}
};
