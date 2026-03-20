import {
	TAX_ID_VALIDATION_RULES,
	GLOBAL_TAX_ID_FALLBACK_MIN,
	GLOBAL_TAX_ID_FALLBACK_MAX,
	GLOBAL_TAX_ID_FALLBACK_REGEX,
	normalizeCountryCode,
	TAX_ID_LABELS,
	DEFAULT_TAX_ID_LABELS
} from "#constants";
import { joiExtended as Joi } from "#helpers/index";
import { SUBROLES, ACCOUNT_HOLDER_TYPES } from "#constants";

const requiredUUID = Joi.string().uuid().required();

/* Owner */
// used as the basis for dynamic owner{n}_{ownerStringFields} values, e.g. owner4_title
const ownerStringFields = [
	"external_id",
	"title",
	"first_name",
	"last_name",
	"mobile",
	"ssn",
	"dob",
	"address_line_1",
	"address_line_2",
	"address_city",
	"address_state",
	"address_postal",
	"address_country",
	"owner_type"
].join("|");
// dynamic owner{n}_{ownerStringFields} pattern where n is 1-5
const ownerStringPattern = new RegExp(`^owner[1-5]_(${ownerStringFields})$`, "u"); // strings
const ownerEmailPattern = /^owner[1-5]_email$/u; // string.email
const ownerOwnershipPattern = /^owner[1-5]_ownership_percentage$/u; // number
const ownerUUIDPattern = /^owner[1-5]_id$/u; // UUID (optional)

/* DBA */
// dynamic dba{n}_name pattern where n is 1-5
const dbaNamePattern = /^dba[1-5]_name$/u; // string

/* Address */
// dynamic address{n}_{addrStringFields} pattern where n is 1-5
const addrStringFields = ["line_1", "apartment", "city", "state", "country", "postal_code", "mobile"].join("|");
// dynamic address{n}_{addrStringFields} pattern where n is 1-5
const addrPattern = new RegExp(`^address[1-5]_(${addrStringFields})$`, "u"); // strings

// dynamic custom field custom:{fieldName} pattern
const customFieldPattern = /^custom:(\S.*)$/u; // custom:fields
// Accept dates as YYYY-MM-DD or MM/DD/YYYY or MM-DD-YYYY
const datePattern = /^(?:\d{4}-\d{2}-\d{2}|\d{2}[\/-]\d{2}[\/-]\d{4})$/;

/**
 * Validates TIN based on country:
 * - US: 9-digit numeric TIN/SSN/EIN
 * - Non-US: 1-22 alphanumeric characters (A-Z, 0-9)
 * Note: Empty values should be handled by the custom validator, not here.
 */
const validateTinForCountry = (tin, countryCode) => {
	// This function assumes non-empty input - empty values are handled in the custom validator
	if (!tin || tin.trim() === "") {
		throw new Error("validateTinForCountry should not be called with empty values");
	}

	const normalizedCountry = normalizeCountryCode(countryCode);
	const rule = TAX_ID_VALIDATION_RULES[normalizedCountry];
	const label = TAX_ID_LABELS[normalizedCountry] ?? DEFAULT_TAX_ID_LABELS;

	if (rule) {
		const normalizedValue = rule.normalize ? rule.normalize(tin) : tin.trim();

		if (rule.regex.test(normalizedValue)) {
			return { isValid: true, normalizedValue, errorMessage: null };
		}

		return {
			isValid: false,
			normalizedValue: null,
			errorMessage: `Invalid ${label.formLabel}: expected ${rule.description}`
		};
	}

	// Global fallback for non-US countries: 1-22 alphanumeric characters
	const normalizeNonUsTaxId = value => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
	const normalizedNonUsValue = normalizeNonUsTaxId(tin.trim());
	if (GLOBAL_TAX_ID_FALLBACK_REGEX.test(normalizedNonUsValue)) {
		return { isValid: true, normalizedValue: normalizedNonUsValue, errorMessage: null };
	}

	return {
		isValid: false,
		normalizedValue: null,
		errorMessage: `${label.formLabel} must be between ${GLOBAL_TAX_ID_FALLBACK_MIN} and ${GLOBAL_TAX_ID_FALLBACK_MAX} alphanumeric characters`
	};
};

/**
 * Country-aware TIN schema that validates based on address_country in the parent object.
 * Used in bulk processing where each business object may have a different country.
 * Empty values are returned as-is to let Joi's .required()/.optional() handle them properly.
 * This ensures required fields reject empty strings and optional fields allow them.
 */
const countryAwareTinSchema = Joi.string()
	.trim()
	.custom((value, helpers) => {
		const tin = value || "";

		// For empty values, return as-is to let Joi's required/optional validation handle it
		// Joi's .required() will reject empty strings, .optional() will allow them
		// This is the correct behavior: required fields should reject empty strings,
		// and optional fields should allow them (empty string is treated as "not provided")
		if (!tin) {
			return value; // Return original value (empty string), let Joi handle required/optional
		}

		// Get the address_country from the parent object (ancestors[0] is the parent object)
		const countryCode = helpers.state.ancestors?.[0]?.address_country;

		const result = validateTinForCountry(tin, countryCode);

		if (result.isValid) {
			return result.normalizedValue || tin;
		}

		return helpers.error("any.custom", { message: result.errorMessage ?? "Invalid TIN" });
	})
	.messages({
		"any.custom": "{{#message}}"
	});

const bulkBusinessBody = {
	address_line_1: Joi.string().trim().optional(),
	address_line_2: Joi.string().trim().optional(), // bulk process has addtl rules allowing empty string and null values
	address_city: Joi.string().trim().optional(),
	address_state: Joi.string().trim().optional(),
	address_country: Joi.string().trim().optional(),
	address_postal_code: Joi.string().trim().optional(),
	mobile: Joi.string().trim().verifyPhoneNumber().validPhoneNumberForRegion().max(15).allow(null, "").optional(),
	official_website: Joi.string().trim().optional(),
	naics_code: Joi.number().optional(),
	naics_title: Joi.string().trim().optional(),
	mcc_code: Joi.number().optional(),
	industry: Joi.string().trim().optional(),
	is_monitoring_enabled: Joi.boolean().optional(),
	applicant_id: Joi.string().uuid().optional(),
	send_invitation: Joi.boolean().optional(),
	generate_invite_link: Joi.boolean().optional(),
	applicant_first_name: Joi.string().trim().optional(),
	applicant_last_name: Joi.string().trim().optional(),
	applicant_email: Joi.string().trim().email().optional(),
	applicant_subrole_code: Joi.string().trim().optional().valid(SUBROLES.OWNER, SUBROLES.USER),
	// Static dba1_* fields now handled by patterns
	// Static address1_* fields now handled by patterns
	year_created: Joi.number().optional(),
	annual_total_income: Joi.number().optional(),
	total_wages: Joi.number().optional(),
	annual_net_income: Joi.number().optional(),
	cost_of_goods_sold: Joi.number().optional(),
	total_liabilities: Joi.number().optional(),
	total_assets: Joi.number().optional(),
	total_equity: Joi.number().optional(),
	total_accounts_payable: Joi.number().optional(),
	total_accounts_recievable: Joi.number().optional(),
	total_cash_and_cash_equivalents: Joi.number().optional(),
	total_short_term_investments: Joi.number().optional(),
	total_current_assets: Joi.number().optional(),
	total_current_liabilities: Joi.number().optional(),
	non_current_liablities: Joi.number().optional(),
	annual_cost_of_goods_sold: Joi.number().optional(),
	annual_gross_profit: Joi.number().optional(),
	annual_taxes_paid: Joi.number().optional(),
	annual_interest_expenses: Joi.number().optional(),
	number_of_employees: Joi.number().optional(),
	business_type: Joi.string().trim().optional(),
	sic_code: Joi.number().optional(),
	score_retrieval_date: Joi.string().trim().optional(),
	business_liens: Joi.number().optional(),
	business_liens_file_date: Joi.string().trim().optional(),
	business_liens_status: Joi.string().trim().optional(),
	business_liens_status_date: Joi.string().trim().optional(),
	business_bankruptcies: Joi.number().optional(),
	business_bankruptcies_file_date: Joi.string().trim().optional(),
	business_bankruptcies_chapter: Joi.string().trim().optional(),
	business_bankruptcies_voluntary: Joi.string().trim().optional(),
	business_bankruptcies_status: Joi.string().trim().optional(),
	business_bankruptcies_status_date: Joi.string().trim().optional(),
	business_judgements: Joi.number().optional(),
	business_judgements_file_date: Joi.string().trim().optional(),
	business_judgements_status: Joi.string().trim().optional(),
	business_judgements_status_date: Joi.string().trim().optional(),
	business_judgements_amount: Joi.number().optional(),
	social_review_count: Joi.number().optional(),
	social_review_score: Joi.number().optional(),
	// Static owner1_* fields now handled by patterns
	bank_account_number: Joi.string().trim().optional(),
	bank_name: Joi.string().trim().optional(),
	institution_name: Joi.string().trim().optional(),
	bank_routing_number: Joi.string().trim().optional(),
	bank_wire_routing_number: Joi.string().trim().optional(),
	bank_official_name: Joi.string().trim().optional(),
	bank_account_type: Joi.string().trim().optional(),
	bank_account_subtype: Joi.string().trim().optional(),
	bank_account_balance_current: Joi.number().optional(),
	bank_account_balance_available: Joi.number().optional(),
	bank_account_balance_limit: Joi.number().optional(),
	deposit_account: Joi.boolean().optional(),
	bank_account_holder_type: Joi.string()
		.trim()
		.optional()
		.valid(ACCOUNT_HOLDER_TYPES.BUSINESS, ACCOUNT_HOLDER_TYPES.PERSONAL),
	bank_account_holder_name: Joi.string().trim().optional(),
	// NPI Provider Details
	npi: Joi.string()
		.trim()
		.pattern(/^\d{10}$/u)
		.optional(),
	npi_first_name: Joi.string().trim().max(50).optional(),
	npi_last_name: Joi.string().trim().max(50).optional(),
	skip_credit_check: Joi.boolean().optional(),
	bypass_ssn: Joi.boolean().optional(),
	// Canada Open
	canada_business_number: Joi.string().trim().optional(),
	canada_corporate_id: Joi.string().trim().optional(),
	// Aging Configuration
	aging_config: Joi.object({
		thresholds: Joi.object({
			low: Joi.number().integer().min(0).required(),
			medium: Joi.number().integer().min(0).required(),
			high: Joi.number().integer().min(0).required()
		}).required(),
		custom_messages: Joi.object({
			low: Joi.string().allow("").optional(),
			medium: Joi.string().allow("").optional(),
			high: Joi.string().allow("").optional()
		}).optional()
	}).optional()
};

export const schema = {
	getBusinessByID: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		query: Joi.object({
			fetch_owner_details: Joi.boolean().optional(),
			tinBehavior: Joi.number().valid(0, 1, 2).optional()
		})
	},

	updateBusinessDetails: {
		body: Joi.object({
			address_line_1: Joi.string().trim().max(100).optional(),
			address_line_2: Joi.string().allow("").trim().max(100).optional(),
			address_postal_code: Joi.string().trim().max(10).optional(),
			address_city: Joi.string().trim().max(25).optional(),
			address_state: Joi.string().trim().optional(),
			address_country: Joi.string().trim().optional(),
			official_website: Joi.string().allow("").trim().max(255).optional(),
			public_website: Joi.string().allow("").trim().max(50).optional(),
			social_account: Joi.string().allow("").trim().max(50).optional(),
			industry: Joi.object({
				id: Joi.number().required(),
				code: Joi.string().trim().required(),
				name: Joi.string().trim().required()
			}).unknown(),
			mobile: Joi.string().trim().verifyPhoneNumber().validPhoneNumberForRegion().max(15).optional(),
			case_id: Joi.when("official_website", {
				is: Joi.string().not("").required(), // ensures that official_website is not empty
				then: Joi.string().uuid().required(),
				otherwise: Joi.string().uuid().optional()
			})
		}).min(1),
		params: Joi.object({
			businessID: Joi.string().uuid().trim().required()
		})
	},

	updateOrLinkBusiness: {
		body: Joi.object({
			tin: Joi.string().trim().max(9).required(),
			name: Joi.string().trim().max(100).required()
		}),
		params: Joi.object({
			businessID: Joi.string().uuid().trim().required()
		})
	},

	ownershipDetails: {
		body: Joi.object({
			owners: Joi.array().items(
				Joi.object({
					title: Joi.object({
						id: Joi.number().required(),
						title: Joi.string().trim().required()
					})
						.allow({})
						.optional(),
					first_name: Joi.string().trim().required(),
					last_name: Joi.string().trim().required(),
					date_of_birth: Joi.string().trim().pattern(datePattern).allow(null, "").optional(),
					mobile: Joi.string()
						.trim()
						.verifyPhoneNumber()
						.validPhoneNumberForRegion()
						.max(15)
						.allow(null, "")
						.optional(),
					email: Joi.emailextended()
						.noDisposableDomains()
						.lowercase()
						.trim()
						.max(50)
						.allow(null, "")
						.optional()
						.label("Email")
						.messages({ "string.email": `invalid Email: Please enter a valid email address` }),
					ssn: Joi.string().trim().max(9).allow(null, "").optional(),
					address_line_1: Joi.string().trim().max(100).allow(null, "").optional(),
					address_line_2: Joi.string().trim().max(100).allow(null, "").optional(),
					address_apartment: Joi.string().trim().max(50).allow(null, "").optional(),
					address_postal_code: Joi.string().trim().max(10).allow(null, "").optional(),
					address_city: Joi.string().trim().max(50).allow(null, "").optional(),
					address_state: Joi.string().trim().allow(null, "").optional(),
					address_country: Joi.string().trim().optional().default("US"),
					owner_type: Joi.string().trim().required(),
					is_owner_beneficiary: Joi.boolean().optional(),
					ownership_percentage: Joi.number().required().min(0).max(100),
					external_id: Joi.string().trim().empty("").allow(null).optional()
				})
			),
			invitation_id: Joi.string().uuid().trim().optional()
		}),
		params: Joi.object({
			businessID: Joi.string().uuid().trim().required()
		})
	},

	updateOwner: {
		body: Joi.object({
			title: Joi.object({
				id: Joi.number().required(),
				title: Joi.string().trim().required()
			})
				.allow({})
				.optional(),
			first_name: Joi.string().trim().required(),
			last_name: Joi.string().trim().required(),
			date_of_birth: Joi.string().trim().pattern(datePattern).allow(null, "").optional(),
			mobile: Joi.string().trim().verifyPhoneNumber().validPhoneNumberForRegion().max(15).allow(null, "").optional(),
			email: Joi.emailextended()
				.noDisposableDomains()
				.lowercase()
				.trim()
				.max(50)
				.allow(null, "")
				.optional()
				.label("Email")
				.messages({ "string.email": `invalid Email: Please enter a valid email address` }),
			ssn: Joi.string().trim().max(9).allow(null, "").optional(),
			address_line_1: Joi.string().trim().max(100).allow(null, "").optional(),
			address_line_2: Joi.string().trim().max(100).allow(null, "").optional(),
			address_apartment: Joi.string().trim().max(50).allow(null, "").optional(),
			address_postal_code: Joi.string().trim().max(10).allow(null, "").optional(),
			address_city: Joi.string().trim().max(50).allow(null, "").optional(),
			address_state: Joi.string().trim().allow(null, "").optional(),
			address_country: Joi.string().trim().optional().default("US"),
			owner_type: Joi.string().trim().required(),
			is_owner_beneficiary: Joi.boolean().optional(),
			ownership_percentage: Joi.number().required().min(0).max(100),
			invitation_id: Joi.string().uuid().trim().optional(),
			case_id: Joi.string().uuid().trim().optional()
		}),
		params: Joi.object({
			businessID: Joi.string().uuid().trim().required(),
			ownerID: Joi.string().uuid().trim().required()
		})
	},

	deleteBusinessOwner: {
		params: Joi.object({
			businessID: Joi.string().uuid().trim().required(),
			ownerID: Joi.string().uuid().trim().required()
		})
	},

	getBusinessCustomers: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	internalBusinessCustomers: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getCasesByBusinessID: {
		params: Joi.object({
			businessID: requiredUUID
		})
	},

	getCustomerBusinessCases: {
		params: Joi.object({
			businessID: requiredUUID,
			customerID: requiredUUID
		})
	},

	getBusinessApplicants: {
		params: Joi.object({
			businessID: requiredUUID,
			customerID: requiredUUID
		})
	},
	inviteBusiness: {
		params: Joi.object({
			customerID: requiredUUID
		}),
		body: Joi.object({
			// TODO: Remove existing_business once the frontend is updated instead accept existing_business_id
			existing_business_id: Joi.string().uuid().optional(),
			case_id: Joi.when("existing_business_id", {
				is: Joi.exist(),
				then: Joi.string().uuid().optional(),
				otherwise: Joi.when("existing_business", {
					is: Joi.exist(),
					then: Joi.string().uuid().optional(),
					otherwise: Joi.forbidden()
				})
			}),
			existing_business: Joi.object({
				business_id: requiredUUID,
				name: Joi.string().required(),
				is_quick_add: Joi.boolean().optional()
			}),
			existing_applicant_ids: Joi.array().items(Joi.string().uuid().required()).optional(),

			esign_template_id: Joi.string().uuid().optional(),
			custom_field_template_id: Joi.string().uuid().optional(),
			custom_fields: Joi.object().optional(),

			// Validation for business. Its like alias of new_business
			business: Joi.object({
				name: Joi.string().required(),
				mobile: Joi.string().allow("").verifyPhoneNumber().validPhoneNumberForRegion().max(15).trim().optional(),
				tin: Joi.string().trim().optional(),
				dba: Joi.string().trim().optional(),
				address_line_1: Joi.string().trim().optional(),
				address_line_2: Joi.string().trim().optional(),
				address_city: Joi.string().trim().optional(),
				address_state: Joi.string().trim().optional(),
				address_postal_code: Joi.string().trim().optional()
			}).when("existing_business", {
				is: Joi.exist(),
				then: Joi.forbidden(),
				otherwise: Joi.when("existing_business_id", {
					is: Joi.exist(),
					then: Joi.forbidden(),
					otherwise: Joi.optional()
				})
			}),

			// business takes precedence over new_business.
			new_business: Joi.object({
				name: Joi.string().required(),
				mobile: Joi.string().allow("").verifyPhoneNumber().validPhoneNumberForRegion().max(15).trim().optional()
			}).when("existing_business", {
				is: Joi.exist(),
				then: Joi.forbidden(),
				otherwise: Joi.when("existing_business_id", {
					is: Joi.exist(),
					then: Joi.forbidden(),
					otherwise: Joi.when("business", {
						is: Joi.exist(),
						then: Joi.forbidden(),
						otherwise: Joi.required()
					})
				})
			}),

			// Validation for applicants. Its like alias of new_applicants
			applicants: Joi.array()
				.items(
					Joi.object({
						first_name: Joi.string().required(),
						last_name: Joi.string().required(),
						email: Joi.emailextended()
							.noDisposableDomains()
							.lowercase()
							.trim()
							.required()
							.label("Email")
							.messages({ "string.email": `invalid Email: Please enter a valid email address` }),
						mobile: Joi.string().allow("").verifyPhoneNumber().validPhoneNumberForRegion().max(15).trim().optional()
					})
				)
				.optional(),

			// applicants takes precedence over new_applicants.
			new_applicants: Joi.array()
				.items(
					Joi.object({
						first_name: Joi.string().required(),
						last_name: Joi.string().required(),
						email: Joi.emailextended()
							.noDisposableDomains()
							.lowercase()
							.trim()
							.required()
							.label("Email")
							.messages({ "string.email": `invalid Email: Please enter a valid email address` }),
						mobile: Joi.string().allow("").verifyPhoneNumber().validPhoneNumberForRegion().max(15).trim().optional()
					})
				)
				.optional(),
			is_no_login: Joi.boolean().optional(),
			// To be used for lightning verification. If true, the invite will be sent with lightning verification
			is_lightning_verification: Joi.boolean().optional(),
			// To be used for skipping credit check for applicants/owners
			skip_credit_check: Joi.boolean().optional(),
			// To be used for skipping collecting SSNs for owners
			bypass_ssn: Joi.boolean().optional(),
			// denotes if the request was originated from business details page
			check_invites: Joi.boolean().optional(),
			esign_templates: Joi.array().items(Joi.string().uuid().required()).optional()
		}).or("applicants", "new_applicants")
	},

	auroraInviteBusiness: {
		body: Joi.object({
			new_business: Joi.when("existing_business", {
				is: Joi.exist(),
				then: Joi.forbidden(),
				otherwise: Joi.object({
					name: Joi.string().required(),
					mobile: Joi.string().allow("").verifyPhoneNumber().validPhoneNumberForRegion().max(15).trim().optional()
				}).required()
			}),
			applicants: Joi.array().items(
				Joi.object({
					first_name: Joi.string().required(),
					last_name: Joi.string().required(),
					email: Joi.emailextended()
						.noDisposableDomains()
						.lowercase()
						.trim()
						.required()
						.label("Email")
						.messages({ "string.email": `invalid Email: Please enter a valid email address` }),
					mobile: Joi.string().allow("").verifyPhoneNumber().validPhoneNumberForRegion().max(15).trim().optional()
				})
			)
		})
	},

	getCustomerBusinesses: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			sort: Joi.object({
				"data_businesses.name": Joi.string().valid("ASC", "DESC").optional(),
				"data_businesses.created_at": Joi.string().valid("ASC", "DESC").optional()
			}).unknown(true),
			filter: Joi.object({
				"data_businesses.status": Joi.string().valid("VERIFIED", "UNVERIFIED").optional(),
				"rel_business_customer_monitoring.is_monitoring_enabled": Joi.boolean().optional()
			}).unknown(true),
			search: Joi.object({
				"data_businesses.id": Joi.string().optional(),
				"data_businesses.name": Joi.string().optional(),
				"data_businesses.id::text": Joi.string().optional()
			}).unknown(true),
			search_filter: Joi.object({
				"data_businesses.id": Joi.string().optional(),
				"rel_business_customer_monitoring.external_id": Joi.string().optional()
			})
				.optional()
				.unknown(true),
			filter_date: Joi.object({
				"data_businesses.created_at": Joi.alternatives().try(Joi.string(), Joi.array())
			}).unknown(true)
		}).unknown(true)
	},

	verifyInvitationToken: {
		params: Joi.object({
			invitationToken: Joi.string().trim().required()
		})
	},

	updateInvitationStatus: {
		body: Joi.object({
			invitation_token: Joi.string().trim().optional(),
			invitation_id: Joi.when("invitation_token", {
				is: Joi.exist(),
				then: Joi.forbidden(),
				otherwise: requiredUUID
			}),
			action: Joi.string().trim().valid("ACCEPT", "REJECT", "COMPLETE").required()
		})
	},

	getBusinessOwners: {
		params: Joi.object({
			businessID: requiredUUID
		})
	},

	startApplication: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			invitation_id: Joi.string().uuid().optional()
		})
	},
	submitCase: {
		params: Joi.object({
			businessID: requiredUUID,
			caseID: requiredUUID
		})
	},

	getBusinessInvites: {
		params: Joi.object({
			businessID: requiredUUID,
			customerID: requiredUUID
		})
	},

	getInvitationByID: {
		params: Joi.object({
			invitationID: requiredUUID
		})
	},

	getProgression: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		query: Joi.object({
			invitation_id: Joi.string().uuid().optional(),
			stages_to_skip: Joi.array().optional(),
			updated_stages: Joi.array().optional()
		})
	},

	addOrUpdateCustomFields: {
		params: Joi.object({
			caseID: Joi.string().uuid().required()
		})
	},

	setBusinessMonitoring: {
		body: Joi.object({
			business_id: Joi.string().uuid().required(),
			customer_id: Joi.string().uuid().required(),
			enable_monitoring: Joi.boolean().required()
		})
	},

	getInvitationDetails: {
		query: Joi.object({
			customer_id: requiredUUID,
			business_id: requiredUUID,
			invitation_id: requiredUUID
		})
	},

	resendCustomerBusinessInvite: {
		params: Joi.object({
			businessID: requiredUUID,
			customerID: requiredUUID,
			invitationID: requiredUUID
		}),

		query: Joi.object({
			is_lightning_verification: Joi.boolean().optional()
		})
	},

	getApplicantBusinessInvites: {
		params: Joi.object({
			applicantID: requiredUUID
		})
	},

	validateBusiness: {
		body: Joi.object({
			name: Joi.string().trim().required(),
			dba_names: Joi.array()
				.items(
					Joi.object({
						name: Joi.string().trim().required()
					})
				)
				.optional(),
			tin: countryAwareTinSchema.optional(), // Country-aware TIN validation based on address_country
			npi: Joi.string().trim().max(10).optional(),
			npi_first_name: Joi.string().trim().max(50).optional(),
			npi_last_name: Joi.string().trim().max(50).optional(),
			canada_business_number: Joi.string().trim().optional(),
			canada_corporate_id: Joi.string().trim().optional(),
			invite_id: Joi.string().uuid().trim().optional(),
			address_line_1: Joi.string().trim().max(100).required(),
			address_line_2: Joi.string().allow("").trim().max(100).optional(),
			address_postal_code: Joi.string().trim().max(10).required(),
			address_city: Joi.string().trim().max(25).required(),
			address_state: Joi.string().trim().required(),
			address_country: Joi.string().trim().optional(),
			mailing_addresses: Joi.array()
				.items(
					Joi.object({
						address_line_1: Joi.string().trim().max(100).required(),
						address_line_2: Joi.string().allow("").trim().max(100).optional(),
						address_postal_code: Joi.string().trim().max(10).required(),
						address_city: Joi.string().trim().max(25).required(),
						address_state: Joi.string().trim().required(),
						address_country: Joi.string().trim().optional(),
						mobile: Joi.string().trim().verifyPhoneNumber().validPhoneNumberForRegion().max(15).optional()
					})
				)
				.optional(),
			mobile: Joi.string().trim().verifyPhoneNumber().validPhoneNumberForRegion().max(15).optional(),
			place_id: Joi.string().trim().optional(),
			additional_details: Joi.object({
				official_website: Joi.string().allow("").trim().max(255).optional(),
				public_website: Joi.string().allow("").trim().max(50).optional(),
				social_account: Joi.string().allow("").trim().max(50).optional(),
				industry: Joi.object({
					id: Joi.number().required(),
					code: Joi.string().trim().required(),
					name: Joi.string().trim().required()
				}).unknown(),
				naics_id: Joi.number().optional().allow(null),
				naics_code: Joi.number().optional().allow(null),
				naics_title: Joi.string().allow("").trim().max(255).optional().allow(null),
				mcc_id: Joi.number().optional().allow(null),
				mcc_code: Joi.number().optional().allow(null),
				mcc_title: Joi.string().allow("").trim().max(255).optional().allow(null)
			}).optional(),
			is_lightning_verification: Joi.boolean().optional()
		}).min(1),
		params: Joi.object({
			businessID: Joi.string().uuid().trim().required()
		})
	},

	acceptInvitation: {
		params: Joi.object({
			invitationID: requiredUUID
		})
	},

	singleBusinessEncryption: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			table_name: Joi.string().required(),
			column_name: Joi.string().required(),
			decrypt: Joi.boolean().optional()
		})
	},
	getBusinessByTin: {
		params: Joi.object({
			tin: Joi.string().trim().max(9).required()
		})
	},
	getBusinessByExternalId: {
		params: Joi.object({
			externalID: Joi.string().trim().required(),
			customerID: requiredUUID
		})
	},
	getCustomerBusiness: {
		params: Joi.object({
			businessID: requiredUUID,
			customerID: requiredUUID
		})
	},
	refreshScore: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			businessID: Joi.string().uuid().required()
		})
	},
	refreshScoreBusiness: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	refreshProcessingTime: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			customerID: Joi.string().uuid().optional()
		})
	},
	updateBusinessKybByID: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			businessID: Joi.string().uuid().required()
		})
	},

	purgeBusinesses: {
		body: Joi.object({
			business_ids: Joi.array().min(1).items(Joi.string().uuid())
		})
	},

	inviteCoApplicants: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			case_id: requiredUUID,
			// Validation for co applicants
			co_applicants: Joi.array()
				.items(
					Joi.object({
						first_name: Joi.string().required(),
						last_name: Joi.string().required(),
						email: Joi.emailextended()
							.noDisposableDomains()
							.lowercase()
							.trim()
							.required()
							.label("Email")
							.messages({ "string.email": `invalid Email: Please enter a valid email address` })
					})
				)
				.required()
		})
	},

	getCoApplicantInvites: {
		params: Joi.object({
			businessID: requiredUUID
		})
	},

	resendCoApplicantInvite: {
		params: Joi.object({
			businessID: requiredUUID,
			invitationID: requiredUUID
		}),

		query: Joi.object({
			is_lightning_verification: Joi.boolean().optional()
		})
	},

	revokeCoApplicantInvite: {
		params: Joi.object({
			businessID: requiredUUID,
			invitationID: requiredUUID
		})
	},

	requestInviteLink: {
		body: Joi.object({
			invite_token: Joi.string().trim().required()
		})
	},

	acceptInviteLinkRequest: {
		params: Joi.object({
			requestToken: Joi.string().trim().required()
		})
	},

	denyInviteLinkRequest: {
		params: Joi.object({
			requestToken: Joi.string().trim().required()
		})
	},

	addBusiness: {
		query: Joi.object({
			async: Joi.boolean().optional()
		}),
		params: Joi.object({
			customerID: requiredUUID
		}),
		body: Joi.object({
			...bulkBusinessBody,
			external_id: Joi.string().trim().optional(),
			name: Joi.string().trim().required(),
			tin: countryAwareTinSchema, // Country-aware TIN validation based on address_country
			is_corporate_entity: Joi.boolean().optional()
		})
			.pattern(ownerStringPattern, Joi.string().trim().optional()) // owner{n}_{ownerStringFields}
			.pattern(ownerEmailPattern, Joi.string().trim().email().optional())
			.pattern(ownerOwnershipPattern, Joi.number().optional())
			.pattern(dbaNamePattern, Joi.string().trim().optional()) // dba{n}_name
			.pattern(addrPattern, Joi.string().trim().optional()) // address{n}_{addrStringFields}
			.pattern(
				customFieldPattern,
				Joi.alternatives()
					.try(
						Joi.string(),
						Joi.number(),
						Joi.boolean(),
						Joi.object({
							label: Joi.string().required(),
							value: Joi.string().required()
						}),
						Joi.array().items(
							Joi.object({
								label: Joi.string().required(),
								value: Joi.string().required(),
								checkbox_type: Joi.string().allow("").required(),
								checked: Joi.boolean().required()
							})
						)
					)
					.optional()
			) // custom:{field}
	},

	postBulkProcessBusiness: {
		query: Joi.object({
			async: Joi.boolean().optional()
		}),
		params: Joi.object({
			customerID: requiredUUID,
			applicantID: Joi.string().uuid().optional()
		}),
		body: Joi.alternatives()
			.try(
				// JSON‐submissions
				Joi.array()
					.items(
						Joi.object({
							...bulkBusinessBody,
							external_id: Joi.string().trim().optional(),
							name: Joi.string().trim().required(),
							tin: countryAwareTinSchema, // Country-aware TIN validation based on address_country
							address_line_2: Joi.string().trim().allow("", null).optional()
						}).unknown()
					)
					.min(1)
					.required()
					.messages({
						"array.base": "Request payload must be an array of business objects.",
						"array.min": "At least one business object is required."
					}),
				// CSV‐submissions
				Joi.string().required()
			)
			.required()
			.messages({
				"alternatives.match": "Body must be either a JSON array of business objects or a raw CSV string."
			})
	},
	patchBulkProcessBusiness: {
		query: Joi.object({
			async: Joi.boolean().optional()
		}),
		params: Joi.object({
			customerID: requiredUUID,
			applicantID: Joi.string().uuid().optional()
		}),
		body: Joi.alternatives()
			.try(
				// JSON‐submissions
				Joi.array()
					.items(
						Joi.object({
							...bulkBusinessBody,
							external_id: Joi.string().trim().optional(),
							name: Joi.string().trim().optional(),
							tin: countryAwareTinSchema, // Country-aware TIN validation based on address_country
							address_line_2: Joi.string().trim().allow("", null).optional()
						}).unknown()
					)
					.min(1)
					.required()
					.messages({
						"array.base": "Request payload must be an array of business objects.",
						"array.min": "At least one business object is required."
					}),
				// CSV‐submissions
				Joi.string().required()
			)
			.required()
			.messages({
				"alternatives.match": "Body must be either a JSON array of business objects or a raw CSV string."
			})
	},
	updateBusiness: {
		query: Joi.object({
			async: Joi.boolean().optional(),
			businessID: Joi.string().uuid().optional()
		}),
		params: Joi.object({
			customerID: requiredUUID
		}),
		body: Joi.object({
			...bulkBusinessBody,
			external_id: Joi.string().trim().optional(),
			tin: countryAwareTinSchema, // Country-aware TIN validation based on address_country
			name: Joi.string().trim().optional()
		})
			.pattern(ownerStringPattern, Joi.string().trim().optional()) // owner{n}_{ownerStringFields}
			.pattern(ownerEmailPattern, Joi.string().trim().email().optional())
			.pattern(ownerUUIDPattern, Joi.string().uuid().optional())
			.pattern(ownerOwnershipPattern, Joi.number().optional())
			.pattern(dbaNamePattern, Joi.string().trim().optional()) // dba{n}_name
			.pattern(addrPattern, Joi.string().trim().optional()) // address{n}_{addrStringFields}
			.pattern(
				customFieldPattern,
				Joi.alternatives()
					.try(
						Joi.string(),
						Joi.number(),
						Joi.boolean(),
						Joi.object({
							label: Joi.string().required(),
							value: Joi.string().required()
						}),
						Joi.array().items(
							Joi.object({
								label: Joi.string().required(),
								value: Joi.string().required(),
								checkbox_type: Joi.string().allow("").required(),
								checked: Joi.boolean().required()
							})
						)
					)
					.optional()
			) // custom:{field}
	},

	assertTinValid: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			attempts: Joi.number().optional().allow(null, ""),
			customer_id: Joi.string().uuid().optional().allow(null, "")
		})
	},

	addCustomFieldsFromInvite: {
		params: Joi.object({
			inviteID: requiredUUID
		})
	},
	getRelatedBusinessByBusinessId: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		body: Joi.object({
			customer_id: Joi.string().uuid().optional().allow(null, "")
		})
	},
	getRelatedBusinessesAdmin: {
		params: Joi.object({
			businessID: requiredUUID
		}),
		query: Joi.object({
			pagination: Joi.boolean().optional(),
			page: Joi.number().integer().min(1).optional(),
			items_per_page: Joi.number().integer().optional(),
			sort: Joi.object({
				"db.created_at": Joi.string().valid("ASC", "DESC").optional(),
				"db.name": Joi.string().valid("ASC", "DESC").optional()
			}).unknown(true)
		}).unknown(true)
	},
	getRelatedBusinessesCustomer: {
		params: Joi.object({
			customerID: requiredUUID,
			businessID: requiredUUID
		}),
		query: Joi.object({
			pagination: Joi.boolean().optional(),
			page: Joi.number().integer().min(1).optional(),
			items_per_page: Joi.number().integer().optional(),
			sort: Joi.object({
				"db.created_at": Joi.string().valid("ASC", "DESC").optional(),
				"db.name": Joi.string().valid("ASC", "DESC").optional()
			}).unknown(true)
		}).unknown(true)
	},

	validateBusinessHasApplicant: {
		params: Joi.object({
			businessID: requiredUUID
		})
	},

	getPurgedBusinesses: {
		query: Joi.object({
			customerID: Joi.array().min(1).items(Joi.string().uuid())
		})
	},

	archiveBusinesses: {
		body: Joi.object({
			business_ids: Joi.array().min(1).items(Joi.string().uuid())
		})
	},

	unarchiveBusinesses: {
		body: Joi.object({
			business_ids: Joi.array().min(1).items(Joi.string().uuid())
		})
	},

	cloneBusiness: {
		params: Joi.object({
			customerID: requiredUUID,
			businessID: requiredUUID,
			caseID: requiredUUID
		}),
		body: Joi.object({
			businessDetails: Joi.object({
				name: Joi.string().optional().allow(null, ""),
				dba_name: Joi.string().optional().allow(null, ""),
				tin: Joi.string().optional().allow(null, ""),
				address_line_1: Joi.string().optional().allow(null, ""),
				address_line_2: Joi.string().optional().allow(null, ""),
				address_city: Joi.string().optional().allow(null, ""),
				address_state: Joi.string().optional().allow(null, ""),
				address_postal_code: Joi.string().optional().allow(null, ""),
				address_country: Joi.string().optional().allow(null, "")
			}).optional(),
			sectionsToClone: Joi.object({
				ownership: Joi.boolean().optional(),
				customFields: Joi.boolean().optional()
			}).optional()
		})
	},

	searchCustomerBusinesses: {
		params: Joi.object({
			customerID: requiredUUID
		}),
		query: Joi.object({
			query: Joi.string().trim().optional(),
			limit: Joi.number().integer().min(1).max(50).optional().default(10)
		})
	},

	checkDisposableDomain: {
		query: Joi.object({
			domain: Joi.string().trim().required()
		})
	},

	/**
	 * Internal schemas for custom fields (used by integration-service for inline editing)
	 */
	getCustomFieldTemplate: {
		params: Joi.object({
			customerID: requiredUUID
		})
	},

	getCustomFieldDefinitions: {
		params: Joi.object({
			templateId: requiredUUID
		})
	},

	getBusinessCustomFieldValues: {
		params: Joi.object({
			businessID: requiredUUID,
			caseID: requiredUUID
		}),
		query: Joi.object({
			templateId: requiredUUID
		})
	},

	updateBusinessCustomFieldValues: {
		params: Joi.object({
			businessID: requiredUUID,
			caseID: requiredUUID
		}),
		body: Joi.object({
			businessId: requiredUUID,
			templateId: requiredUUID,
			fields: Joi.array()
				.items(
					Joi.object({
						customer_field_id: requiredUUID,
						value: Joi.any().allow(null),
						type: Joi.string().trim().required(),
						value_id: Joi.string().uuid().optional()
					})
				)
				.min(1)
				.required(),
			userId: requiredUUID
		})
	}
};
