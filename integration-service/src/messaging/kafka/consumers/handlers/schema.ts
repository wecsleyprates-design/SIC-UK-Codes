import { joiExtended as Joi } from "#helpers/index";

export const adverseMediaConsumerSchema = Joi.object({
	customer_id: Joi.string().uuid().required(),
	business_id: Joi.string().uuid().required(),
	business_name: Joi.string().required(),
	dba_names: Joi.array().items(Joi.string().optional()).required(),
	case_id: Joi.string().uuid().optional(),
	contact_names: Joi.array().items(Joi.string().optional()).required(),
	city: Joi.string().optional(),
	state: Joi.string().optional()
}).unknown();

const matchItemSchema = Joi.object({
	integration_business: Joi.object().unknown().required(),
	prediction: Joi.number().required(),
	extra_verification: Joi.object({
		name_match: Joi.boolean().optional().allow(null),
		npi_match: Joi.boolean().optional().allow(null)
	})
		.optional()
		.allow(null)
		.unknown()
});

const entityMatchingSchema = Joi.object({
	match_id: Joi.string().uuid().required(),
	business_id: Joi.string().uuid().required(),
	matches: Joi.array().items(matchItemSchema).required(),
	source: Joi.string().required(),
	matched_at: Joi.string().required()
});

const integrationSchema = Joi.object({
	code: Joi.string().optional(),
	mode: Joi.string().optional(),
	label: Joi.string().optional(),
	status: Joi.string().valid("ACTIVE", "INACTIVE").required(),
	description: Joi.string().optional(),
	options: Joi.array()
		.items(Joi.string().valid("PRODUCTION", "SANDBOX", "MOCK", "DISABLE"))
		.optional()
});

// gAuthenticate cannot be ACTIVE unless gVerify is ACTIVE.
// We implement this as a custom rule so we can inspect sibling integration settings. This is skipped when copying settings from parent to child customer.
const gauthenticateSchema = integrationSchema
	.custom((value, helpers) => {
		// Access Joi's ancestor chain to inspect parent objects and sibling fields
		const ancestors = (helpers as any)?.state?.ancestors || [];

		// Skip validation when copying settings from parent to child customer
		// The root payload contains parent_customer_data when this is a parent-to-child operation
		const rootPayload = ancestors[ancestors.length - 1];
		if (rootPayload?.parent_customer_data?.parent_id) {
			return value; // Skip validation for parent-to-child copying
		}

		// For normal validation: gAuthenticate cannot be ACTIVE unless gVerify is ACTIVE
		// Find the settings container that contains both gauthenticate and gverify fields
		const settingsContainer =
			ancestors.find((a: any) => a && typeof a === "object" && a.gverify !== undefined) || ancestors[0];
		const gverifyStatus = settingsContainer?.gverify?.status;

		// Enforce the dependency rule
		if (value?.status === "ACTIVE" && gverifyStatus !== "ACTIVE") {
			return helpers.error("integration.gauthenticate.dependency");
		}
		return value;
	}, "gAuthenticate dependency validation")
	.messages({
		"integration.gauthenticate.dependency": "gAuthenticate cannot be ACTIVE unless gVerify is ACTIVE"
	});

export const schema = {
	businessInviteAccepted: Joi.object({
		case_id: Joi.string().uuid().optional(),
		business_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().allow(null).optional(),
		applicant_id: Joi.string().uuid().required(),
		required_task_categories: Joi.array().items(Joi.number().min(1)).optional()
	}).unknown(),

	executeTasksOnCaseSubmit: Joi.object({
		case_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required()
	}).unknown(),

	caseSubmitted: Joi.object({
		case_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required()
	}).unknown(),

	linkScoreTriggers: Joi.object({
		customer_case_ids: Joi.array().items(Joi.string().uuid().min(1)).required(),
		standalone_case_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required()
	}).unknown(),

	fetchPublicRecordsRequest: Joi.object({
		business_id: Joi.string().uuid().required(),
		name: Joi.string().required(),
		address_line_1: Joi.string().required(),
		address_line_2: Joi.string().allow(null).optional(),
		address_city: Joi.string().required(),
		address_state: Joi.string().required(),
		address_postal_code: Joi.string().required(),
		tin: Joi.string().required(),
		case_id: Joi.string().uuid().required(),
		place_id: Joi.string().optional()
	}),
	ownerUpdated: Joi.object({
		business_id: Joi.string().uuid().required(),
		owner_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().allow(null).optional()
	}).unknown(),

	scoreRefreshRequest: Joi.object({
		business_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().allow(null).optional(),
		trigger_type: Joi.string().required()
	}),

	rescoreCase: Joi.object({
		case_id: Joi.string().uuid().required(),
		trigger_type: Joi.string().required(),
		score_trigger_type: Joi.string().optional().allow(null)
	}),

	updateCaseStatusOnSubmit: Joi.object({ case_id: Joi.string().uuid().required() }),
	integrationDataUploaded: Joi.object({
		business_id: Joi.string().uuid().required(),
		user_id: Joi.string().uuid().required(),
		created_at: Joi.date().required(),
		data: Joi.any().required()
	}).unknown(),
	integrationDataReady: Joi.object({
		business_id: Joi.string().uuid().required(),
		platform_id: Joi.number().required()
	}).unknown(),

	taxStatusDataFetching: Joi.object({
		business_id: Joi.string().uuid().required(),
		task_id: Joi.string().uuid().required()
	}),

	// TODO: Update schema according to needs
	createRiskAlert: Joi.object({
		business_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().required(),
		integration_task_id: Joi.string().uuid().optional(),
		risk_alert_subtype: Joi.string().required(),
		risk_level: Joi.string().valid("LOW", "MODERATE", "HIGH").required(),
		risk_alert_config_id: Joi.string().uuid().required(),
		measurement_config: Joi.string().required(),
		created_by: Joi.string().uuid().optional()
	}).unknown(),

	fetchBusinessWebsiteDetails: Joi.object({
		business_id: Joi.string().uuid().required(),
		website: Joi.string().trim().required(),
		case_id: Joi.string().uuid().required()
	}),

	fetchWorthBusinessWebsiteDetails: Joi.object({
		business_id: Joi.string().uuid().required(),
		website: Joi.string().trim(),
		case_id: Joi.string().uuid()
	}),

	s3File: Joi.object({
		eventName: Joi.string().required(),
		bucketName: Joi.string().required(),
		fileKey: Joi.string().required(),
		fileSize: Joi.number().optional()
	}).unknown(),
	purgeBusiness: Joi.object({ business_id: Joi.string().uuid().required() }),

	createCaseRequest: Joi.object({
		id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required(),
		score_trigger_id: Joi.string().uuid().required()
	}),

	fetchReportData: Joi.object({
		report_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().optional(),
		customer_id: Joi.string().uuid().optional().allow(null)
	}),

	integrationUpdated: Joi.object({
		business_id: Joi.string().uuid().required(),
		key: Joi.string().required(),
		integration: Joi.string().required(),
		config: Joi.object().unknown(),
		customer_id: Joi.string().uuid().optional().allow(null),
		case_id: Joi.string().uuid().optional().allow(null),
		user_id: Joi.string().uuid().optional().allow(null)
	}),

	addRiskAlertConfig: Joi.object({
		user: Joi.object({
			user_id: Joi.string().uuid().required(),
			role: Joi.object({ id: Joi.number().required(), code: Joi.string().valid("admin").required() })
		})
			.required()
			.messages({ "object.base": "user must be an object", "any.required": "user is required" }),
		risk_alert_statuses: Joi.object({
			risk_alerts_status: Joi.boolean().required(),
			score_risk_tier_transition_status: Joi.boolean().required(),
			new_bankruptcy_lien_judgement_status: Joi.boolean().required(),
			worth_score_change_status: Joi.boolean().required(),
			credit_score_config_status: Joi.boolean().required(),
			new_adverse_media: Joi.boolean().required()
		})
			.required()
			.messages({
				"object.base": "risk_alert_statuses must be an object",
				"any.required": "risk_alert_statuses is required"
			}),
		customer_id: Joi.string().uuid().optional(),
		score_config: Joi.array()
			.items(
				Joi.object({
					risk_level: Joi.string().valid("LOW", "MODERATE", "HIGH").required(),
					min: Joi.number().min(0).required(),
					max: Joi.number().max(855).required()
				})
			)
			.max(3)
			.optional(),
		worth_score_change_config: Joi.array()
			.items(
				Joi.object({
					risk_level: Joi.string().valid("HIGH").required(), // only HIGH as of now according to FSD
					drop_value: Joi.number().min(1).max(850).required()
				})
			)
			.max(1)
			.optional(),
		credit_score_config: Joi.array()
			.items(
				Joi.object({
					risk_level: Joi.string().valid("MODERATE").required(), // only MODERATE as of now according to FSD
					drop_percentage: Joi.number().min(1).max(100).required().prefs({ convert: true }).messages({
						"number.base": "drop_percentage must be a number between 1-100 (actual type received is not a number)",
						"number.min": "drop_percentage must be at least 1",
						"number.max": "drop_percentage must be less than or equal to 100"
					})
				})
			)
			.max(1)
			.optional(),
		new_lien: Joi.object()
			.pattern(
				Joi.string().valid("HIGH", "MODERATE", "LOW"),
				Joi.object({
					threshold: Joi.number().min(1).required()
				})
			)
			.optional(),

		new_judgement: Joi.object()
			.pattern(
				Joi.string().valid("HIGH", "MODERATE", "LOW"),
				Joi.object({
					threshold: Joi.number().min(1).required()
				})
			)
			.optional(),

		new_bankruptcy: Joi.object()
			.pattern(
				Joi.string().valid("HIGH", "MODERATE", "LOW"),
				Joi.object({
					threshold: Joi.number().min(1).required()
				})
			)
			.optional(),

		score_risk_tier_transition: Joi.array()
			.items(
				Joi.object().pattern(
					Joi.string().valid("LOW", "MODERATE", "HIGH"),
					Joi.object({
						from: Joi.string().valid("LOW", "MODERATE", "HIGH").required(),
						to: Joi.string().valid("LOW", "MODERATE", "HIGH").required()
					})
				)
			)
			.optional(),

		new_adverse_media: Joi.object()
			.pattern(
				Joi.string().valid("HIGH", "MODERATE", "LOW"),
				Joi.object({
					threshold: Joi.number().min(1).required()
				})
			)
			.optional(),
		parent_customer_data: Joi.object({
			parent_id: Joi.string().uuid().required(),
			parent_name: Joi.string().required(),
			parent_customer_type: Joi.string().required()
		})
			.optional()
			.allow(null)
	}),

	addCustomerIntegrationSettings: Joi.object({
		settings: Joi.object({
			bjl: integrationSchema.optional(),
			npi: integrationSchema.optional(),
			equifax: integrationSchema.optional(),
			gverify: integrationSchema.optional(),
			website: integrationSchema.optional(),
			adverse_media: integrationSchema.optional(),
			gauthenticate: gauthenticateSchema.optional(),
			identity_verification: integrationSchema.optional()
		}).required(),
		customerID: Joi.string().uuid().required(),
		customer_type: Joi.string().valid("PRODUCTION", "SANDBOX").optional(),
		user_id: Joi.string().uuid().optional(),
		parent_customer_data: Joi.object({
			parent_id: Joi.string().uuid().required(),
			parent_name: Joi.string().required(),
			parent_customer_type: Joi.string().valid("PRODUCTION", "SANDBOX").required()
		})
			.optional()
			.allow(null)
	})
		.required()
		.messages({
			"object.base": "data_integration_settings must be an object",
			"any.required": "data_integration_settings is required"
		}),

	fetchAdverseMediaReport: adverseMediaConsumerSchema,

	fetchGoogleProfile: Joi.object({
		business_id: Joi.string().uuid().required()
	}),

	entityMatching: entityMatchingSchema,

	deleteIntegrationData: Joi.object({
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().required()
	}),
	calculateBusinessFacts: Joi.object({
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().optional(),
		customer_id: Joi.string().uuid().optional(),
		previous_status: Joi.string().optional()
	}).unknown(),

	caseUpdatedAudit: Joi.object({
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().required(),
		business_name: Joi.string().optional(),
		applicant_id: Joi.string().optional()
	}),

	invitationSent: Joi.object({
		business_name: Joi.string().optional(),
		invitation_id: Joi.string().optional(),
		applicant_email: Joi.string().optional(),
		customer_user_id: Joi.string().optional(),
		business_id: Joi.string().optional(),
		applicant_phoneNumber: Joi.string().optional()
	}),
	stateUpdate: Joi.object({
		businessId: Joi.string().uuid().required(),
		customerId: Joi.string().uuid().required(),
		source: Joi.string().optional(),
		changes: Joi.object().unknown().required(),
		previousState: Joi.object().unknown().optional(),
		currentState: Joi.object().unknown().optional()
	}).unknown(),

	integrationCategoryComplete: Joi.object({
		category_id: Joi.alternatives().try(Joi.string().valid("all"), Joi.number()).required(),
		category_name: Joi.string().optional().allow(null),
		business_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().optional().allow(null),
		case_id: Joi.string().uuid().optional().allow(null),
		score_trigger_id: Joi.string().uuid().optional().allow(null),
		completion_state: Joi.object().unknown().required(),
		action: Joi.string().required()
	}).unknown()
};
