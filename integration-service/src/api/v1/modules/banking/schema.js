import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	plaidTokenExchange: {
		body: Joi.object({
			public_token: Joi.string().optional(),
			case_id: Joi.string().uuid().optional(),
			connection_phase: Joi.string().valid("ONBOARDING", "POST_ONBOARDING").optional(),
			removed_institution_name: Joi.string().optional(),
			link_session_id: Joi.string().optional()
		}).xor("removed_institution_name", "link_session_id"),

		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getBankingTradeLines: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			case_id: Joi.string().uuid().optional(),
			score_trigger_id: Joi.string().uuid().optional()
		})
	},

	plaidLinkInit: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			invitation_id: Joi.string().uuid().optional()
		})
	},

	getDepositAccountInfo: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	setDepositAccountInfo: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			accountData: Joi.object({
				account_number: Joi.string().min(5).max(17).regex(/^\d+$/u).required(),
				bank_name: Joi.string().allow(null, ""),
				official_name: Joi.string().allow(null, ""),
				institution_name: Joi.string().allow(null, ""),
				verification_status: Joi.string().valid("VERIFIED", "UNVERIFIED").optional(),
				balance_current: Joi.number().precision(2).allow(null),
				balance_available: Joi.number().precision(2).allow(null, 0),
				balance_limit: Joi.number().precision(2).allow(null, 0),
				subtype: Joi.string().allow(null),
				type: Joi.string().required(),
				routing_number: Joi.string().length(9).regex(/^\d+$/u).required(),
				wire_routing_number: Joi.string().length(9).regex(/^\d+$/u).allow(null, ""),
				account_holder_name: Joi.string().allow(null, ""),
				account_holder_type: Joi.string().allow(null, ""),
				deposit_account: Joi.boolean().required(),
				currency: Joi.string().allow(null, ""),
			}).required()
		})
	},

	getAllBankingIntegrations: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getBankingInformation: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			caseID: Joi.string().uuid().optional(),
			score_trigger_id: Joi.string().uuid().optional() // we should deprecate this, we should fetch either by businessId or by caseId
		})
	},
	getBankingInformationByDate: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			beforeDate: Joi.date().required()
		})
	},
	refreshBankingAssets: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			case_id: Joi.string().uuid().optional(),
			days: Joi.number().optional().max(731).min(1)
		})
	},

	revokePlaidConnection: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	setAdditionalAccountInfo: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			accountData: Joi.object({
				bank_name: Joi.string().allow(null, ""),
				official_name: Joi.string().allow(null, ""),
				bank_account: Joi.string().min(5).max(17).regex(/^\d+$/u).required(),
				routing_number: Joi.string().length(9).regex(/^\d+$/u).required(),
				subtype: Joi.string().required(),
				account_holder_name: Joi.string().allow(null, ""),
				account_holder_type: Joi.string().allow(null, ""),
			}).required(),

			case_id: Joi.string().uuid().required()
		})
	},

	getAdditionalAccountInfo: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),

		query: Joi.object({
			case_id: Joi.string().uuid().optional()
		})
	},

	updateAdditionalAccountInfo: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			accountData: Joi.object({
				bank_name: Joi.string().allow(null, ""),
				official_name: Joi.string().allow(null, ""),
				bank_account: Joi.string().min(5).max(17).regex(/^\d+$/u).required(),
				routing_number: Joi.string().length(9).regex(/^\d+$/u).required(),
				subtype: Joi.string().required(),
				account_holder_name: Joi.string().allow(null, ""),
				account_holder_type: Joi.string().allow(null, ""),
			}).required(),

			case_id: Joi.string().uuid().required(),
			account_id: Joi.string().uuid().required()
		})
	},

	deleteAdditionalAccountInfo: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			case_id: Joi.string().uuid().required(),
			account_id: Joi.string().uuid().required()
		})
	},

	addBankStatement: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			case_id: Joi.string().uuid().required(),
			customer_id: Joi.string().uuid().optional(),
			validation_ocr_document_ids: Joi.array().items(Joi.string().uuid()).required()
		})
	},

	getBankStatements: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			case_id: Joi.string().uuid().optional()
		})
	},

	deleteBankStatement: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			documentID: Joi.string().uuid().required()
		})
	}
};
