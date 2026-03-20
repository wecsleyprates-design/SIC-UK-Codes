import { joiExtended as Joi } from "../../../../helpers/joiExtended";

export const schema = {
	// TODO: Remove this schema
	applicantOnboarded: Joi.object({
		user_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().required(),
		status: Joi.number().required()
	}),

	createCaseRequest: Joi.object({
		applicant_id: Joi.string().required(),
		customer_id: Joi.string().required(),
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().required()
	}),

	integrationDataReady: Joi.object({
		id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required(),
		task_status: Joi.string().required(),
		task_code: Joi.string().required()
	}).unknown(),

	integrationTaskFailed: Joi.object({
		case_id: Joi.string().uuid().required(),
		integration_platform: Joi.string().optional(),
		integration_category: Joi.string().optional()
	}),

	scoreCalculated: Joi.object({
		business_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().allow(null).optional(),
		score_trigger_id: Joi.string().uuid().required(),
		score_100: Joi.number().required(),
		score_850: Joi.number().required(),
		risk_level: Joi.string().required(),
		decision: Joi.string().required(),
		created_at: Joi.date().required(),
		trigger_type: Joi.string().required(),
		case_id: Joi.string().uuid().allow(null).optional()
	}),

	linkApplicantsToInvite: Joi.object({
		invitation_id: Joi.string().required(),
		applicants: Joi.array().items(Joi.string().uuid().required()).required()
	}),

	businessInvited: Joi.object({
		user_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required()
	}),

	naicsData: Joi.object({
		business_id: Joi.string().uuid().required(),
		naics_code: Joi.number().required(),
		naics_title: Joi.string().allow("").required(),
		platform: Joi.string().allow("").optional(),
		industry_code: Joi.string().allow("").optional()
	}),

	updateCaseStatusOnResponse: Joi.object({
		case_id: Joi.string().uuid().required()
	}),

	createStripeCustomer: Joi.object({
		case_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required(),
		business_name: Joi.string().optional(),
		applicant_id: Joi.string().uuid().required(),
		name: Joi.string().required(),
		email: Joi.string().email().required(),
		customer_id: Joi.string().uuid().optional()
	}),

	createRiskAlertCase: Joi.object({
		business_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().required(),
		risk_alert_id: Joi.string().uuid().required(),
		score_trigger_id: Joi.string().uuid().required(),
		risk_alert_subtype: Joi.string().required()
	}),

	bankAccountVerificationFailed: Joi.object({
		case_id: Joi.string().uuid().required(),
		reason: Joi.string().required()
	}),

	addOfficialWebsite: Joi.object({
		business_id: Joi.string().uuid().required(),
		official_website: Joi.string().required()
	}),

	purgeBusiness: Joi.object({
		business_id: Joi.string().uuid().required()
	}),

	updateCustomerBusinessRiskMonitoring: Joi.object({
		customer_id: Joi.string().uuid().required(),
		risk_monitoring_status: Joi.boolean().required(),
		user_id: Joi.string().uuid().optional(),
		parent_customer_data: Joi.object({
			parent_id: Joi.string().uuid().required(),
			parent_name: Joi.string().required(),
			parent_customer_type: Joi.string().required()
		})
			.optional()
			.allow(null)
	}),

	gatherDataAndSendWebhookData: Joi.object({
		events: Joi.array().items(Joi.string().required()).required(),
		options: Joi.object({
			business_id: Joi.string().uuid().optional(),
			case_id: Joi.string().uuid().optional(),
			customer_id: Joi.string().uuid().optional()
		})
	}),

	fetchReportData: Joi.object({
		report_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().optional(),
		customer_id: Joi.string().uuid().optional().allow(null)
	}),

	sectionCompleted: Joi.object({
		business_id: Joi.string().uuid().required(),
		section_name: Joi.string().required(),
		user_id: Joi.string().uuid().allow(null).optional(),
		customer_id: Joi.string().uuid().allow(null).optional()
	}),
	addModulePermissionSettingsData: Joi.object({
		customer_id: Joi.string().uuid().required(),
		module_permissions: Joi.object({
			onboarding: Joi.boolean().required(),
			white_labeling: Joi.boolean().required(),
			risk_monitoring: Joi.boolean().required(),
			email_notifications: Joi.boolean().required(),
			modify_pages_fields: Joi.boolean().optional(),
			lightning_verification: Joi.boolean().optional(),
			equifax_credit_score: Joi.boolean().optional(),
			post_submission_editing: Joi.boolean().optional(),
			international_business: Joi.boolean().optional()
		}).required(),
		user_id: Joi.string().uuid().optional(),
		parent_customer_data: Joi.object({
			parent_id: Joi.string().uuid().required(),
			parent_name: Joi.string().required(),
			parent_customer_type: Joi.string().required()
		})
			.optional()
			.allow(null)
	}),

	onboardingEsignEvent: Joi.object({
		document_id: Joi.string().uuid().required(),
		template_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().required(),
		user_id: Joi.string().uuid().required()
	}),

	updateCustomerIntegrationSettings: Joi.object({
		customer_id: Joi.string().uuid().required(),
		module_permissions: Joi.object({
			equifax_credit_score: Joi.boolean().required(),
			identity_verification: Joi.boolean().required()
		}).required(),
		user_id: Joi.string().uuid().required()
	}),

	workflowChangeAttribute: Joi.object({
		case_id: Joi.string().uuid().required(),
		attribute_type: Joi.string().valid("status").required(),
		attribute_value: Joi.number().integer().positive().required(),
		user_id: Joi.string().uuid().optional(),
		comment: Joi.string().optional()
	}),

	integrationCategoryCompleted: Joi.object({
		category_id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
		category_name: Joi.string().required(),
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().optional(),
		score_trigger_id: Joi.string().uuid().optional(),
		action: Joi.string().optional(),
		completion_state: Joi.object({
			tasks_completed: Joi.number().integer(),
			tasks_required: Joi.number().integer(),
			is_all_complete: Joi.boolean(),
			required_tasks: Joi.array().items(Joi.string()),
			completed_tasks: Joi.array().items(Joi.string()),
			timed_out_tasks: Joi.array().items(Joi.string()),
			completed_categories: Joi.array().items(Joi.number()),
			initialized_at: Joi.string(),
			started_at: Joi.string(),
			business_id: Joi.string().uuid().required(),
			case_id: Joi.string().uuid().required(),
			customer_id: Joi.string().uuid().optional(),
			score_trigger_id: Joi.string().uuid().optional(),
			required_tasks_by_category: Joi.object(),
			timeout_threshold_seconds: Joi.number(),
			tasks_timed_out: Joi.number().integer(),
			updated_at: Joi.string(),
			tasks_ignored: Joi.number().integer()
		}).required()
	})
};
