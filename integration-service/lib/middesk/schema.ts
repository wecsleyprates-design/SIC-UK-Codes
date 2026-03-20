import { INTEGRATION_ID } from "#constants";
import { z } from "zod";

export const verifyBusinessEntityPayloadSchema = z.object({
	name: z.string({
		required_error: "business name is required"
	}),
	addresses: z.array(
		z.object({
			address_line1: z.string({
				required_error: "address line 1 is required"
			}),
			address_line2: z.string().optional(),
			city: z.string({
				required_error: "city is required"
			}),
			state: z.string({
				required_error: "state is required"
			}),
			postal_code: z.string({
				required_error: "postal code is required"
			})
		})
	),
	tin: z.object({
		tin: z.string().optional()
	}),
	website: z
		.object({
			url: z.string()
		})
		.optional(),
	dba_names: z.array(z.string()).optional()
});

export const businessEntityVerificationParamsSchema = z.object({
	businessID: z
		.string({
			required_error: "Worth Business ID is required"
		})
		.uuid(),
	platformID: z.nativeEnum(INTEGRATION_ID).optional().nullable()
});

export const businessEntityVerificationUserInfoSchema = z.object({
	role: z.object({
		id: z.number({
			required_error: "User role id is required"
		}),
		code: z.string({
			required_error: "User role code is required"
		})
	}),
	user_id: z.string({
		required_error: "User ID is required"
	})
});

export const businessEntityVerificationHeadersSchema = z.object({
	authorization: z.string({
		required_error: "Authorization header is required"
	})
});

export const internalBusinessEntityVerificationSchema = z.object({
	name: z.string({ required_error: "Business name is required" }),
	addresses: z.array(
		z.object({
			address_line_1: z.string({ required_error: "Address line 1 is required" }),
			address_line_2: z.string().optional(),
			address_city: z.string({ required_error: "City address is required" }),
			address_state: z.string({ required_error: "State address is required" }),
			address_postal_code: z.string({ required_error: "Postal code is required" })
		})
	),
	tin: z.string().optional(),
	official_website: z.string().optional().nullable(),
	dba_names: z.array(z.string()).optional(),
	people: z
		.array(
			z.object({
				name: z.string({ required_error: "Person name is required" }),
				dob: z.string().optional()
			})
		)
		.optional()
});

export const internalUpdateBusinessEntityVerificationSchema = z.object({
	name: z.string({ required_error: "Business name is required" }),
	addresses: z.array(
		z.object({
			address_line_1: z.string({ required_error: "Address line 1 is required" }),
			address_line_2: z.string().nullable().optional(),
			address_city: z.string({ required_error: "City address is required" }),
			address_state: z.string({ required_error: "State address is required" }),
			address_postal_code: z.string({ required_error: "Postal code is required" })
		})
	),
	tin: z.object({
		tin: z.string().optional()
	}),
	website: z
		.object({
			url: z.string()
		})
		.optional(),
	dba_names: z.array(z.string()).optional()
});

export type InternalBusinessEntityVerification = z.infer<typeof internalBusinessEntityVerificationSchema>;

export type BusinessEntityVerificationParams = z.infer<typeof businessEntityVerificationParamsSchema>;
export type BusinessEntityVerificationUserInfo = z.infer<typeof businessEntityVerificationUserInfoSchema>;
export type BusinessEntityVerificationHeaders = z.infer<typeof businessEntityVerificationHeadersSchema>;
export type CreateBusinessEntityPayload = z.infer<typeof verifyBusinessEntityPayloadSchema>;

export const updateBusinessEntityPayloadSchema = z.intersection(
	internalUpdateBusinessEntityVerificationSchema.partial(),
	z.object({ isLightningVerification: z.boolean().optional() })
);
export interface UpdateBusinessEntityPayload {
	name: string;
	addresses: Array<{
		address_line_1: string;
		address_line_2?: string;
		address_city: string;
		address_state: string;
		address_postal_code: string;
	}>;
	tin?: {
		tin: string;
	};
	website?: {
		url: string;
	};
	dba_names?: string[];
	people?: Array<{
		name: string;
		dob?: string;
	}>;
}

// reference: https://docs.middesk.com/docs/lifecycle-of-a-business
export const verificationStatusUnion = z.union([
	z
		.literal("open")
		.describe(
			"The request for the Business has been received, but Middesk has not yet kicked off the searches for this Business."
		),
	z.literal("pending").describe("Middesk has kicked off searches for this Business, but has not yet completed them."),
	z.literal("in_audit").describe("Middesk is required to Audit and ensure the quality of this Business."),
	z
		.literal("in_review")
		.describe(
			"The Business is ready to be reviewed by the Middesk client. Action items for the client are listed in the Review Resource."
		),
	z.literal("approved").describe("The Middesk client moves the Business to an approved status."),
	z.literal("rejected").describe("The Middesk client moves the Business to a rejected status.")
]);

export type VerificationStatus = z.infer<typeof verificationStatusUnion>;

export const webhookEventSchema = z.object({
	type: z.string(),
	id: z.string().uuid(),
	object: z.literal("event"),
	data: z.object({
		object: z.unknown()
	})
});

export type VerificationRreviewWebhookEvent = z.infer<typeof webhookEventSchema>;

export const businessEntityWebsiteResponse = z.object({
	object: z.literal("website"),
	id: z.string().uuid(),
	business_id: z.string().uuid(),
	url: z.string(),
	status: z.string(),
	title: z.string(),
	description: z.string(),
	domain: z.object({
		domain: z.string(),
		creation_date: z.string().nullable(),
		expiration_date: z.string().nullable(),
		registrar: z.object({}).optional()
	}),
	pages: z.array(
		z.object({
			category: z.string(),
			url: z.string(),
			text: z.string(),
			screenshot_url: z.string()
		})
	),
	parked: z.boolean(),
	business_name_match: z.boolean(),
	addresses: z.array(z.object({})).optional(),
	phone_numbers: z.array(z.object({})).optional()
});

export const businessEntitySchema = z.object({
	object: z.literal("business"),
	id: z.string().uuid(),
	name: z.string(),
	external_id: z.string().nullable(),
	// we will always supply a unique_external_id
	unique_external_id: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
	status: z.string(),
	tags: z.array(z.string()),
	submitted: z.any().optional(),
	watchlist: z
		.object({
			object: z.literal("watchlist"),
			id: z.string(),
			hit_count: z.number(),
			agencies: z
				.array(
					z.object({
						name: z.string(),
						abbr: z.string(),
						org: z.string()
					})
				)
				.optional(),
			lists: z
				.array(
					z.object({
						object: z.literal("watchlist_source"),
						agency: z.string(),
						agency_abbr: z.string(),
						organization: z.string(),
						title: z.string(),
						abbr: z.string(),
						results: z
							.array(
								z.object({
									object: z.literal("watchlist_result"),
									id: z.string(),
									entity_name: z.string(),
									entity_aliases: z.array(z.any()).optional(),
									listed_at: z.string(),
									agency_information_url: z.string().optional(),
									agency_list_url: z.string().optional(),
									score: z.number(),
									addresses: z
										.array(
											z.object({
												full_address: z.string()
											})
										)
										.optional(),
									url: z.string().optional(),
									list_country: z.string().optional(),
									list_url: z.string().optional(),
									list_region: z.string().optional(),
									categories: z.array(z.string()).optional()
								})
							)
							.optional()
					})
				)
				.optional()
		})
		.optional(),
	actions: z
		.array(
			z
				.object({
					id: z.string().uuid(),
					note: z.string().optional(),
					metadata: z.any()
				})
				.passthrough()
		)
		.optional(),
	addresses: z.array(
		z.object({
			object: z.literal("address"),
			id: z.string().uuid(),
			address_line1: z.string().nullable(),
			address_line2: z.string().nullable(),
			city: z.string().nullable(),
			state: z.string().nullable(),
			postal_code: z.string().nullable(),
			full_address: z.string().nullable(),
			latitude: z.number().nullable(),
			longitude: z.number().nullable(),
			submitted: z.boolean(),
			deliverable: z.boolean(),
			property_type: z.string().nullable(),
			cmra: z.boolean(),
			created_at: z.string(),
			updated_at: z.string(),
			sources: z.array(
				z
					.object({
						id: z.string().uuid(),
						type: z.string()
					})
					// useful for capturing unknown fields
					.passthrough()
			)
		})
	),
	names: z.array(
		z.object({
			object: z.literal("name"),
			id: z.string().uuid(),
			name: z.string(),
			submitted: z.boolean(),
			type: z.string(),
			business_id: z.string().uuid(),
			sources: z.array(z.unknown())
		})
	),
	registrations: z.array(
		z.object({
			object: z.literal("registration"),
			id: z.string().uuid(),
			business_id: z.string().uuid(),
			name: z.string(),
			status: z.string(),
			sub_status: z.string(),
			status_details: z.string(),
			jurisdiction: z.string(),
			entity_type: z.string(),
			file_number: z.string(),
			addresses: z.array(z.string()),
			officers: z.array(z.unknown()),
			registered_agent: z.unknown(),
			registration_date: z.string(),
			state: z.string(),
			source: z.string()
		})
	),
	review: z.object({
		object: z.literal("review"),
		id: z.string().uuid(),
		status: z.string(),
		created_at: z.string(),
		updated_at: z.string(),
		completed_at: z.string().nullable(),
		tasks: z
			.array(
				z.object({
					category: z.string(),
					key: z.string(),
					name: z.string(),
					message: z.string(),
					label: z.string(),
					sub_label: z.string(),
					status: z.string(),
					sources: z.array(
						z
							.object({
								id: z.string().uuid(),
								type: z.string()
							})
							// useful for capturing unknown fields
							.passthrough()
					)
				})
			)
			.optional()
	}),
	people: z.array(
		z
			.object({
				object: z.literal("person"),
				name: z.string(),
				submitted: z.boolean(),
				titles: z.array(z.object({ object: z.string(), title: z.string() })).optional(),
				sources: z.array(z.object({ id: z.string().uuid(), type: z.string(), metadata: z.unknown() })).optional(),
				people_bankruptcies: z.array(
					z.object({
						object: z.literal("person_bankruptcy"),
						id: z.string().uuid(),
						case_number: z.string(),
						case_updates: z.array(z.unknown()).optional(),
						chapter: z.number().nullable(),
						court: z.string().optional(),
						case_link: z.string().url().nullable().optional(),
						filing_date: z.date().nullable().optional(),
						debtors: z.array(z.unknown()).optional(),
						person_id: z.string().nullable().optional()
					})
				)
			})
			.optional()
	),
	phone_numbers: z.array(
		z
			.object({
				object: z.literal("phone_number"),
				phone_number: z.string()
			})
			.optional()
	),
	website: businessEntityWebsiteResponse,
	tin: z
		.object({
			tin: z.string()
		})
		.optional(),
	subscription: z.string().nullable(),
	formation: z
		.object({
			entity_type: z.string(),
			formation_date: z.string(),
			formation_state: z.string(),
			created_at: z.string(),
			updated_at: z.string()
		})
		.optional(),
	industry_classification: z.object({
		object: z.literal("industry_classification"),
		status: z.string(),
		categories: z.array(
			z.object({
				classification_system: z.string(),
				name: z.string(),
				sector: z.string(),
				category: z.string(),
				score: z.number(),
				high_risk: z.boolean(),
				naics_codes: z.array(z.string()),
				sic_codes: z.array(z.string()),
				mcc_codes: z.array(z.string()),
				prohibited_labels: z.unknown().nullable()
			})
		)
	})
});

export type BusinessEntityVerificationResponse = z.infer<typeof businessEntitySchema>;
export type BusinessEntityWebsiteResponse = z.infer<typeof businessEntityWebsiteResponse>;
export type BusinessEntityReviewTask = NonNullable<
	z.infer<typeof businessEntitySchema.shape.review.shape.tasks>
>[number];
export type BusinessEntityAddress = z.infer<typeof businessEntitySchema.shape.addresses>[number];
export type BusinessEntityRegistration = z.infer<typeof businessEntitySchema.shape.registrations>[number];
