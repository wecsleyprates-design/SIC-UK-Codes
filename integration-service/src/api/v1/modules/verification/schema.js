import { z } from "zod";

import { INTEGRATION_ID } from "#constants/integrations.constant";
import { joiExtended as Joi } from "#helpers/index";
import { businessEntityVerificationParamsSchema, internalBusinessEntityVerificationSchema, updateBusinessEntityPayloadSchema, webhookEventSchema } from "#lib/middesk";
import { truliooWebhookSchema } from "#lib/trulioo/trulioo.schema";

export const schema = {
	createInquiry: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	completeInquiry: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getPersonaDetails: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getAllVerificationIntegrations: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	verifyBusinessEntity: z.object({
		params: businessEntityVerificationParamsSchema
	}),

	internalVerifyBusinessEntity: z.object({
		params: businessEntityVerificationParamsSchema,
		body: internalBusinessEntityVerificationSchema
	}),

	updateBusinessEntity: z.object({
		params: businessEntityVerificationParamsSchema,
		body: updateBusinessEntityPayloadSchema
	}),

	handleVerificationWebhook: z.object({
		body: webhookEventSchema
	}),

	handleInternationalBusinessWebhook: z.object({
		body: truliooWebhookSchema
	}),

	getEntityVerificationDetails: z.object({
		params: businessEntityVerificationParamsSchema
	}),
	idvEnrollApplicant: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			applicantID: Joi.string().uuid().required(),
			platformID: Joi.number()
				.valid(...Object.values(INTEGRATION_ID))
				.optional()
		})
	},
	idvTokenApplicant: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			applicantID: Joi.string().uuid().required()
		})
	},
	idvEnroll: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			platformID: Joi.number()
				.valid(...Object.values(INTEGRATION_ID))
				.optional()
		})
	},

	businessWebsiteDetailsGathering: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},

	getBusinessWebsiteDetails: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		}),
		query: Joi.object({
			case_id: Joi.string().uuid().optional(),
			score_trigger_id: Joi.string().uuid().optional()
		})
	},

	getVerificationPeople: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	openCorporatesMatch: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	zoomInfoMatch: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	// KYB verification schemas
	triggerKYBVerification: {
		params: Joi.object({
			businessID: Joi.string().uuid().required().messages({
				"string.guid": "Business ID must be a valid UUID",
				"any.required": "Business ID is required"
			})
		})
	},

	npiMatch: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			caseID: Joi.string().uuid().required(),
			npiID: Joi.string().required().length(10),
			oldNpiID: Joi.string().optional().allow(null).length(10)
		})
	},

	fetchHealthcareProviderDetailsByBusinessId: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	fetchHealthcareProviderDetailsByBusinessAndCase: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			caseID: Joi.string().uuid().required() // caseID is required for fetching healthcare provider details by case ID
		})
	},
	fetchDoctorsDetails: {
		body: Joi.object({
			business_id: Joi.string().uuid().optional(),
			case_id: Joi.string().uuid().optional(),
			score_trigger_id: Joi.string().uuid().optional()
		}).or("business_id", "case_id", "score_trigger_id"),
		query: Joi.object({
			doctor_licenses: Joi.boolean().optional(),
			reviews: Joi.boolean().optional()
		})
	},

	bulkMatch: {
		// allow body to be passed as a string or an object
		body: Joi.alternatives().try(Joi.object({}).unknown(true), Joi.string())
	},
	match: {
		params: Joi.object({
			businessID: Joi.string().uuid().required(),
			platformID: Joi.number()
				.optional()
				.valid(...Object.values(INTEGRATION_ID))
		})
	},
	getVerificationForBusinessOwners: {
		params: Joi.object({
			businessID: Joi.string().uuid().required()
		})
	},
	matchPro: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
			businessID: Joi.string().uuid().required()
		}),
		body: Joi.object({
			icas: Joi.array()
				.items(Joi.string().pattern(/^[A-Za-z0-9]+$/))
				.max(100)
				.optional()
		}).optional()
	},
	bulkMatchPro: {
		// allow body to be passed as array of objects
		body: Joi.alternatives().try(Joi.array().items(Joi.object({
			customer_id: Joi.string().uuid().required(),
			business_id: Joi.string().uuid().required()
		})))
	},
	getIDVSchema: {
		params: Joi.object({
			countryCode: Joi.string().required().length(2)
		})
	},
	getIDVTemplate: {
		params: Joi.object({
			templateID: Joi.string().required()
		})
	},
	idvValidate: {
		// Essentially the same as the Plaid IDV Create Request
		body: Joi.object({
			phone_number: Joi.string().optional(),
			date_of_birth: Joi.string().optional(),
			ip_address: Joi.string().optional(),
			email_address: Joi.string().optional(),
			name: Joi.object({ given_name: Joi.string(), family_name: Joi.string() }).optional(),
			address: Joi.object({
				street: Joi.string().allow(null),
				street2: Joi.string().allow(null),
				city: Joi.string().allow(null),
				postal_code: Joi.string().allow(null),
				region: Joi.string().allow(null),
				country: Joi.string()
			}).required(),
			id_number: Joi.object({
				type: Joi.string().optional(),
				value: Joi.string().optional()
			}).optional()
		}).unknown(false)
	}
};