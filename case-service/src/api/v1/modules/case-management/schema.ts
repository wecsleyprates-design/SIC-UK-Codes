import { joiExtended as Joi } from "#helpers/index";
import { ADDITIONAL_DOCUMENTS_ACCEPTED_FILE_TYPES } from "#constants/index";

export const schema = {
	getCaseByID: {
		params: Joi.object({
			caseID: Joi.string().uuid().trim().required(),
			customerID: Joi.string().uuid().trim().required()
		})
	},

	getStandaloneCaseByID: {
		params: Joi.object({
			caseID: Joi.string().uuid().trim().required()
		})
	},

	internalGetCaseByID: {
		params: Joi.object({
			caseID: Joi.string().uuid().trim().required()
		}),
		query: Joi.object({
			include_custom_fields: Joi.boolean().default(false)
		})
	},

	createCase: {
		body: Joi.object({
			first_name: Joi.string().trim().required(),
			last_name: Joi.string().trim().required(),
			email: Joi.emailextended()
				.noDisposableDomains()
				.trim()
				.required()
				.label("Email")
				.messages({ "string.email": `invalid Email: Please enter a valid email address` }),
			mobile: Joi.string().trim().verifyPhoneNumber().validPhoneNumberForRegion().optional(),
			business_name: Joi.string().trim().required(),
			business_mobile: Joi.string().trim().verifyPhoneNumber().validPhoneNumberForRegion().optional()
		}),
		params: Joi.object({
			customerID: Joi.string().uuid().trim().required()
		})
	},

	getApplicantsBusinesses: {
		params: Joi.object({
			applicantID: Joi.string().uuid().trim().required()
		})
	},

	updateCaseStatus: {
		params: Joi.object({
			customerID: Joi.string().uuid().trim().required(),
			caseID: Joi.string().uuid().trim().required()
		}),
		body: Joi.object({
			status: Joi.string().required(),
			assignee: Joi.string().uuid().optional(),
			comment: Joi.string().uuid().optional()
		})
	},

	getCaseStatusReportGeneration: {
		body: Joi.object({
			caseID: Joi.string().uuid(),
			businessID: Joi.string().uuid(),
			customerID: Joi.string().uuid().optional()
		}).or("caseID", "businessID")
	},

	requestAdditionalInfo: {
		params: Joi.object({
			caseID: Joi.string().uuid().required(),
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			subject: Joi.string().trim().required(),
			body: Joi.string().trim().required(),
			documents_required: Joi.boolean().default(false),
			stages: Joi.array()
				.items(
					Joi.object({
						id: Joi.string().required(),
						stage: Joi.string().required(),
						label: Joi.string().required(),
						priority_order: Joi.number().required()
					})
				)
				.optional(),
			applicant: Joi.object({
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
			}).optional()
		})
	},

	informationUpdate: {
		params: Joi.object({
			caseID: Joi.string().uuid().required()
		})
	},

	getInformationRequest: {
		params: Joi.object({
			caseID: Joi.string().uuid().required()
		})
	},

	uploadAdditionalDocuments: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			caseID: Joi.string().uuid().required()
		}),
		files: Joi.array()
			.items(
				Joi.object({
					fieldname: Joi.string().required(),
					originalname: Joi.string().required(),
					encoding: Joi.string().required(),
					mimetype: Joi.string()
						.valid(...Object.keys(ADDITIONAL_DOCUMENTS_ACCEPTED_FILE_TYPES))
						.required()
						.messages({
							"any.only": "Only PDF, image, Word, Excel, and CSV files are allowed"
						}),
					size: Joi.number()
						.min(1)
						.max(5 * 1024 * 1024) // 5 MB max size
						.required()
						.messages({
							"number.max": "Each file must be 5MB or smaller",
							"number.min": "File size must be greater than 0"
						}),
					buffer: Joi.binary(),
					destination: Joi.string(),
					filename: Joi.string(),
					path: Joi.string()
				})
			)
			.min(1)
			.max(20)
			.required()
			.messages({
				"array.min": `At least one file is required`,
				"array.max": "You can upload a maximum of 20 files",
				"object.size": `File size must be greater than 0`
			})
	},

	getDocuments: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			caseID: Joi.string().uuid().optional()
		})
	},

	reassignCase: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			caseID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			assignee: Joi.alternatives()
				.try(
					Joi.string().uuid(), // Allow uuid for assignment
					Joi.valid(null) // Allow null for unassignment
				)
				.required()
		})
	},

	getCaseDetailsExport: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		})
	},
	decryptSSN: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			caseID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			businessID: Joi.string().uuid().required(),
			ownerID: Joi.string().uuid().required()
		})
	}
};
