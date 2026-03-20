import { z } from "zod";

const customerIdParams = z.object({
	customerId: z
		.string({
			required_error: "Customer ID is required"
		})
		.uuid()
});

const customerSettingsBody = z.object({
	primaryCompanyLogo: z.string().optional(),
	secondaryCompanyLogo: z.string().optional(),
	welcomeBackgroudImage: z.string().optional(),
	primaryBackgroundColor: z.string().optional(),
	secondaryBackgroundColor: z.string().optional(),
	buttonColor: z.string().optional(),
	onboardingEmailBody: z.string().optional(),
	onBoardingEmailButtonText: z.string().optional(),
	buttonTextColor: z.string().optional(),
	progressBarColor: z.string().optional(),
	termsAndConditionsLink: z.string().optional(),
	privacyPolicyLink: z.string().optional(),
	companySupportEmailAddress: z.string().optional(),
	customURL: z.string().optional(),
	thankYouMessageTitle: z.string().optional(),
	thankYouMessageBodyText: z.string().optional(),
	domain: z.string({
		required_error: "Domain is required"
	})
});

const updatePartialCustomerSettingsBody = customerSettingsBody.and(
	z.object({
		domain: z.string().optional()
	})
);

const uploadFileCustomerSettings = z.object({
	type: z.enum(["primaryCompanyLogo", "secondaryCompanyLogo", "welcomeBackgroundImage", "termsAndConditions"]),
	file: z.any(),
	domain: z.string()
});

export type CustomerIdParams = z.infer<typeof customerIdParams>;
export type CustomerSettingsBody = z.infer<typeof customerSettingsBody>;
export type UpdatePartialCustomerSettingsBody = z.infer<typeof updatePartialCustomerSettingsBody>;

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.joinworth\.com$/;
const addIdentityInSES = z.object({
	email: z
		.string({
			required_error: "Email is required"
		})
		.regex(emailPattern, {
			message: "The email must follow the format <something>@<something>.joinworth.com"
		})
});

export const schema = {
	createCustomerSettings: z.object({
		params: customerIdParams,
		body: customerSettingsBody
	}),
	updatePartialCustomerSettings: z.object({
		params: customerIdParams,
		body: updatePartialCustomerSettingsBody
	}),
	uploadFileCustomerSettings: z.object({
		params: customerIdParams,
		body: uploadFileCustomerSettings
	}),
	addIdentityInSES: z.object({
		body: addIdentityInSES
	})
};
