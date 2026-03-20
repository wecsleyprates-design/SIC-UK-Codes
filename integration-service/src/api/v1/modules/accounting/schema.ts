import { joiExtended as Joi } from "#helpers/index";
import { AccountingRest } from "./accountingRest";

const needUuid = Joi.string().uuid().required();
const needString = Joi.string().min(1).required();

export const schema = {
	needBusinessId: {
		params: Joi.object({ business_id: needUuid })
	},
	getBalanceSheet: {
		params: Joi.object({ business_id: needUuid }),
		query: Joi.object({
			caseID: Joi.string().uuid().optional()
		})
	},
	getIncomeStatement: {
		params: Joi.object({ business_id: needUuid }),
		query: Joi.object({
			caseID: Joi.string().uuid().optional()
		})
	},
	needAccessToken: {
		query: Joi.object({
			access_token: needUuid
		})
	},
	createConnection: {
		params: Joi.object({
			public_token: needString,
			business_id: needUuid
		}),
		body: Joi.object({
			connection_phase: Joi.string().valid("ONBOARDING", "POST_ONBOARDING").optional()
		})
	},
	syncConnection: {
		params: Joi.object({
			access_token: needString,
			business_id: needUuid
		})
	},
	getReportByID: {
		params: Joi.object({
			business_id: needUuid,
			id: needUuid,
			report: Joi.string()
				.valid(...AccountingRest.VALID_REPORT_TABLES)
				.required()
		}),
		query: Joi.object().unknown()
	},
	getReport: {
		params: Joi.object({
			business_id: needUuid,
			case_id: Joi.string().uuid().optional(),
			task_id: Joi.string().uuid().optional(),
			report: Joi.string()
				.valid(...AccountingRest.VALID_REPORT_TABLES)
				.required()
		}),
		query: Joi.object({
			page: Joi.number().min(1).optional()
		}).unknown()
	},
	getObjectByID: {
		params: Joi.object({
			business_id: needUuid,
			id: needUuid,
			object: needString
		}),
		query: Joi.object().unknown()
	},
	getObject: {
		params: Joi.object({
			business_id: needUuid,
			object: needString
		}),
		query: Joi.object({
			page: Joi.number().min(1).optional()
		}).unknown()
	},
	taxStatusConsentInit: {
		params: Joi.object({
			business_id: needUuid
		}),
		body: Joi.object({
			case_id: Joi.string().uuid().optional(),
			redirect_endpoint: Joi.string()
				.valid(...AccountingRest.VALID_REDIRECT_ENDPOINTS)
				.optional(),
			connection_phase: Joi.string().valid("ONBOARDING", "POST_ONBOARDING").optional()
		}).min(1)
	},

	revokeTaxStatus: {
		params: Joi.object({
			businessID: needUuid
		})
	},

	revokeAccounting: {
		params: Joi.object({
			businessID: needUuid
		}),
		body: Joi.object({
			platforms: Joi.array().items({
				platform: Joi.string().required()
			}),
			invitation_id: Joi.string().uuid().optional()
		})
	},

	addBalanceSheet: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			case_id: Joi.string().uuid().required(),
			customer_id: Joi.string().uuid().optional(),
			validation_ocr_document_ids: Joi.array().items(Joi.string().uuid()).required()
		})
	},

	getAccountingStatements: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			case_id: Joi.string().uuid().optional()
		})
	},

	deleteBalanceSheet: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			documentID: Joi.string().uuid().required()
		})
	}
};
