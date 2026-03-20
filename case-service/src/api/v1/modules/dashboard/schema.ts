import { joiExtended as Joi } from "#helpers/index";

export const schema = {
	getDecisionStats: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},

	averageScoreStats: {
		params: Joi.object({
			customerID: Joi.string().uuid().trim().required()
		})
	},

	getBusinessScoreRangeStats: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},

	getCustomerPortfolio: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},

	industryExposure: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},

	totalApplicaitons: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			timezone: Joi.string().optional(),
			team_performance: Joi.boolean().optional(),
			filter_date: Joi.object({
				period: Joi.string().valid("DAY", "WEEK", "MONTH", "YEAR")
			}).optional(),
			filter: Joi.object({
				"db.industry": Joi.array().items(Joi.number()).optional(),
				"dc.assignee": Joi.array().items(Joi.string().uuid()).optional()
			}).optional()
		})
	},

	applicationReceivedApprovedStats: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		query: {
			filter_date: Joi.object({
				period: Joi.string().valid("DAY", "WEEK", "MONTH", "YEAR"),
				timezone: Joi.string().optional(),
				last: Joi.number().integer().min(0).optional(),
				interval: Joi.number().integer().min(1).optional()
			}),
			filter: Joi.object({
				"db.industry": Joi.array().items(Joi.number()).optional(),
				"dc.assignee": Joi.array().items(Joi.string().uuid()).optional()
			}).optional()
		}
	},

	teamPerformanceStats: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			timezone: Joi.string().optional(),
			filter_date: Joi.object({
				period: Joi.string().valid("DAY", "WEEK", "MONTH", "YEAR"),
				last: Joi.number().integer().min(0).optional()
			}).optional(),
			filter: Joi.object({
				"dc.assignee": Joi.array().items(Joi.string().uuid()).optional()
			}).optional()
		})
	},

	timeToApproval: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			filter_date: Joi.object({
				period: Joi.string().valid("DAY", "WEEK", "MONTH", "YEAR").optional(),
				last: Joi.number().integer().min(0).optional(),
				timezone: Joi.string().optional()
			}).optional(),
			filter: Joi.object({
				"dc.assignee": Joi.array().items(Joi.string().uuid()).optional(),
				"db.industry": Joi.array().items(Joi.number()).optional()
			}).optional()
		})
	},
	pipelineStats: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			timezone: Joi.string().optional(),
			filter_date: Joi.object({
				period: Joi.string().valid("DAY", "WEEK", "MONTH", "YEAR"),
				last: Joi.number().integer().min(0).optional()
			}).optional(),
			filter: Joi.object({
				"dc.assignee": Joi.array().items(Joi.string().uuid()).optional(),
				"dc.industry": Joi.array().items(Joi.number()).optional()
			}).optional()
		})
	}
};
