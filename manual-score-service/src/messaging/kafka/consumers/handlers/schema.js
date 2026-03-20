import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	// schema for v2.2
	scoreGenerated: Joi.object({
		score_trigger_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required(),
		probablity: Joi.string().required(),
		score_0_100: Joi.string().required(),
		score_300_850: Joi.string().required(),
		score: Joi.string().required(),
		categorical_scores: Joi.object({
			company_profile: Joi.object().required(),
			financial_trends: Joi.object().required(),
			public_records: Joi.object().required(),
			business_operations: Joi.object().required(),
			performance_measures: Joi.object().required()
		}).required(),
		model_metadata: Joi.object({
			model_version: Joi.string().optional(),
			shap_scores: Joi.object().optional(),
			shap_base_points: Joi.number().optional(),
			model_input: Joi.string().optional(), // temporary
			model_input_encoded: Joi.object().optional(),
			model_input_raw: Joi.object().optional()
		})
			.unknown() // temporary
			.required(),
		shap_base_points: Joi.number().required()
	}),

	// schema for integration data to generate score
	// this is used to collect integration data for score generation
	integrationDataForScore: Joi.object({
		score_trigger_id: Joi.string().uuid().required(),
		task_status: Joi.string().required(),
		business_id: Joi.string().uuid().required(),
		metadata: Joi.object().unknown(true).allow(null).optional(),
		task_code: Joi.string().required(),
		platform_category_code: Joi.string().required(),
		platform_code: Joi.string().required(),
		trigger_type: Joi.string().required(),
		trigger_version: Joi.number().required(),
		case_id: Joi.string().uuid().allow(null).optional(),
		cases_to_link: Joi.array()
			.items(
				Joi.object({
					case_id: Joi.string().uuid().min(1)
				})
			)
			.allow(null)
			.optional(),
		customer_id: Joi.string().uuid().allow(null).required()
	}),

	customerCreated: Joi.object({
		customer_id: Joi.string().uuid().required(),
		company_name: Joi.string().required()
	}),

	linkScoreTriggersAndEmitScore: Joi.object({
		customer_case_ids: Joi.array().items(Joi.string().uuid().min(1)).required(),
		score_trigger_id: Joi.string().uuid().required(),
		standalone_case_id: Joi.string().uuid().required(),
		business_id: Joi.string().uuid().required()
	}).unknown(),

	refreshBusinessScore: Joi.object({
		business_id: Joi.string().uuid().required(),
		customer_id: Joi.string().uuid().optional().allow(null),
		trigger_type: Joi.string().required(),
		score_trigger_type: Joi.string().optional().allow(null)
	}),

	purgeBusiness: Joi.object({
		business_id: Joi.string().uuid().required()
	}),

	fetchReportData: Joi.object({
		business_id: Joi.string().uuid().required(),
		report_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().optional().allow(null),
		customer_id: Joi.string().uuid().optional().allow(null)
	}),

	caseStatusUpdated: Joi.object({
		business_id: Joi.string().uuid().required(),
		case_id: Joi.string().uuid().required(),
		case_status: Joi.string().valid("SUBMITTED", "INFORMATION_REQUESTED", "INFORMATION_UPDATED").required()
	})
};
