import { joiExtended as Joi } from "#helpers/index";

const IntegrationSettingUpdatable = Joi.object({
	status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
	mode: Joi.string().valid("SANDBOX", "PRODUCTION", "MOCK").optional()
}).unknown(false);

// gAuthenticate cannot be ACTIVE unless gVerify is ACTIVE
const GAuthenticateSettingUpdatable = IntegrationSettingUpdatable.custom((value, helpers) => {
	// Access Joi's ancestor chain to inspect parent objects and sibling fields
	const ancestors = (helpers as any)?.state?.ancestors || [];

	// Find the settings container that contains both gauthenticate and gverify fields
	const settingsContainer =
		ancestors.find((a: any) => a && typeof a === "object" && a.gverify !== undefined) || ancestors[0];
	const gverifyStatus = settingsContainer?.gverify?.status;

	// Enforce the dependency rule
	if (value?.status === "ACTIVE" && gverifyStatus !== "ACTIVE") {
		return helpers.error("integration.gauthenticate.dependency");
	}
	return value;
}).messages({
	"integration.gauthenticate.dependency": "gAuthenticate cannot be ACTIVE unless gVerify is ACTIVE"
});

export const schema = {
	addCustomerIntegrationSettings: {
		body: Joi.object({
		settings: Joi.object({
			bjl: IntegrationSettingUpdatable.optional(),
			equifax: IntegrationSettingUpdatable.optional(),
			gverify: IntegrationSettingUpdatable.optional(),
			gauthenticate: GAuthenticateSettingUpdatable.optional(),
			website: IntegrationSettingUpdatable.optional(),
			npi: IntegrationSettingUpdatable.optional(),
			identity_verification: IntegrationSettingUpdatable.optional(),
			adverse_media: IntegrationSettingUpdatable.optional(),
			payment_processors: IntegrationSettingUpdatable.optional(),
			advanced_watchlist: IntegrationSettingUpdatable.optional()
		}).required(),
			customerID: Joi.string().uuid().required()
		})
			.required()
			.messages({
				"object.base": "data_integration_settings must be an object",
				"any.required": "data_integration_settings is required"
			})
	},

	updateIntegrationStatusForCustomer: {
		params: Joi.object({
			customerID: Joi.string().uuid().required()
		}),
		body: Joi.array()
			.items(
				Joi.object({
					integrationStatusId: Joi.string().uuid().required(),
					newStatus: Joi.string().valid("ENABLED", "DISABLED").required()
				})
			)
			.required()
	},
	getIntegrationStatusForCustomer: {
		params: Joi.object({ customerID: Joi.string().uuid().required() })
	},

	patchCustomerIntegrationSetting: {
		params: Joi.object({
			customerID: Joi.string().uuid().required(),
		integrationName: Joi.string()
			.valid(
				"bjl",
				"equifax",
				"gverify",
				"gauthenticate",
				"website",
				"npi",
				"identity_verification",
				"adverse_media",
				"payment_processors",
				"advanced_watchlist"
			)
			.required()
		}),
		body: Joi.object({
			status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
			mode: Joi.string().valid("SANDBOX", "PRODUCTION", "MOCK").optional()
		})
			.min(1)
			.messages({
				"object.min": "At least one field (status or mode) must be provided"
			})
	}
};
