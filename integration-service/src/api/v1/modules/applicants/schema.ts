import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getBusinessPlaidTransactions: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getBusinessTransactionAccounts: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getBusinessStats: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getAccountBalances: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getBalanceSheetStats: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getIncomeStatementStats: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	exportBusinessTransactionsAsCSV: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			caseID: Joi.string().uuid().optional(),
			platform: Joi.string().optional(),
			period: Joi.string().valid("All Time", "7 Days", "1 Month", "3 Months", "1 Year").optional(),
			"filter_account_name": Joi.string().optional()
		}).unknown(true)
	}
};
