import { UUID } from "crypto";
import { customerIntegrationSettingsRepository } from "./repository";
import {
	type CustomerIntegrationSettingsData,
	type CustomerIntegrationSettingsSettingsData,
	type IntegrationOptions
} from "./types";
import {
	getCustomerOnboardingStagesSettings,
	getOnboardingCustomerSettings,
	db,
	logger,
	getFlagValue,
	producer
} from "#helpers/index";
import { sqlQuery, sqlTransaction } from "#helpers/database";
import {
	CUSTOM_ONBOARDING_SETUP,
	ERROR_CODES,
	DEFAULT_CUSTOMER_INTEGRATION_SETTINGS,
	INTEGRATION_ENABLE_STATUS,
	FEATURE_FLAGS,
	kafkaTopics,
	kafkaEvents
} from "#constants";
import { CustomerIntegrationSettingsApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { UserInfo } from "#types/common";

class CustomerIntegrationSettings {
	async createOrUpdate(
		customerId: UUID,
		settings: CustomerIntegrationSettingsSettingsData,
		userInfo?: UserInfo
	): Promise<CustomerIntegrationSettingsData & { message?: string }> {
		// Load existing settings to preserve all keys
		const existing = await customerIntegrationSettingsRepository.findById(customerId);

		// Start from existing or empty object
		const mergedSettings: CustomerIntegrationSettingsSettingsData = existing?.settings || {};

		// Apply updates: initialize missing keys from defaults, then overwrite status/mode
		Object.keys(settings).forEach(key => {
			const incoming = settings[key];
			if (!incoming) return;

			// Initialize when key does not exist using defaults (if known)
			// If key is unknown (no defaults) and does not exist, skip initializing metadata.
			if (!mergedSettings[key] && DEFAULT_CUSTOMER_INTEGRATION_SETTINGS[key]) {
				mergedSettings[key] = { ...DEFAULT_CUSTOMER_INTEGRATION_SETTINGS[key] };
			}

			// Merge only status/mode onto existing or defaulted object
			mergedSettings[key] = {
				...mergedSettings[key],
				...(incoming.status ? { status: incoming.status } : {}),
				...(incoming.mode ? { mode: incoming.mode } : {})
			};
		});

		// Validation logic on merged state

		// If gverify becomes INACTIVE, automatically set gauthenticate to INACTIVE
		if (
			mergedSettings.gverify?.status === INTEGRATION_ENABLE_STATUS.INACTIVE &&
			mergedSettings.gauthenticate?.status === INTEGRATION_ENABLE_STATUS.ACTIVE
		) {
			mergedSettings.gauthenticate.status = INTEGRATION_ENABLE_STATUS.INACTIVE;
		}

		if (mergedSettings.gverify?.status === INTEGRATION_ENABLE_STATUS.ACTIVE) {
			const onboardingCustomerSettings = await getOnboardingCustomerSettings(customerId);
			const customOnboarding = onboardingCustomerSettings.find(
				item => item.code === CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
			);
			if (customOnboarding?.is_enabled) {
				const customerOnboardingStagesSettings = await getCustomerOnboardingStagesSettings(
					customerId,
					CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
				);

				const { bankingStage, ownershipStage } = customerOnboardingStagesSettings.reduce(
					(acc, stage) => {
						if (stage.stage_code === "banking") acc.bankingStage = stage;
						if (stage.stage_code === "ownership") acc.ownershipStage = stage;
						return acc;
					},
					{ bankingStage: null, ownershipStage: null }
				);

				if (!bankingStage || !bankingStage.is_enabled) {
					throw new CustomerIntegrationSettingsApiError(
						"The Banking page is disabled in the onboarding settings. Please enable it before turning on the GIACT gVerify feature.",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				} else if (bankingStage.is_skippable) {
					throw new CustomerIntegrationSettingsApiError(
						"The Banking page is skippable in the onboarding settings. Please make it non-skippable before enabling the GIACT gVerify feature.",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}

				if (mergedSettings?.gauthenticate?.status === INTEGRATION_ENABLE_STATUS.ACTIVE) {
					if (!ownershipStage || !ownershipStage.is_enabled) {
						throw new CustomerIntegrationSettingsApiError(
							"The Ownership page is disabled in the onboarding settings. Please enable it before turning on the GIACT gAuthenticate feature.",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					} else if (ownershipStage.is_skippable) {
						throw new CustomerIntegrationSettingsApiError(
							"The Ownership page is skippable in the onboarding settings. Please make it non-skippable before enabling the GIACT gAuthenticate feature.",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					}
				}
			}
		}
		let message;
		if (existing) {
			await customerIntegrationSettingsRepository.update(customerId, mergedSettings);
			message = "Customer Integration Settings was successfully updated.";
		} else {
			await customerIntegrationSettingsRepository.create(customerId, mergedSettings);
			message = "Customer Integration Settings was successfully created.";
		}

		const upToDateCustomerIntegrationSettings = (await customerIntegrationSettingsRepository.findById(
			customerId
		)) as CustomerIntegrationSettingsData;

		// Send Kafka event to update module permissions
		const equifaxEnabled = mergedSettings?.equifax?.status === INTEGRATION_ENABLE_STATUS.ACTIVE;
		const idvEnabled = mergedSettings?.identity_verification?.status === INTEGRATION_ENABLE_STATUS.ACTIVE;

	await producer.send({
		topic: kafkaTopics.BUSINESS,
		messages: [
			{
				key: customerId,
				value: {
					event: kafkaEvents.UPDATE_CUSTOMER_INTEGRATION_SETTINGS,
					customer_id: customerId,
					module_permissions: { equifax_credit_score: equifaxEnabled, identity_verification: idvEnabled },
					user_id: userInfo?.user_id
				}
			}
		]
	});
		return { ...upToDateCustomerIntegrationSettings, message };
	}

	async updateSingleIntegrationSetting(
		customerId: UUID,
		integrationName: string,
		updates: { status?: string; mode?: string },
		userInfo?: UserInfo
	): Promise<CustomerIntegrationSettingsData & { message?: string }> {
		// Load existing settings to preserve all keys
		const existing = await customerIntegrationSettingsRepository.findById(customerId);

		// Start from existing settings or default settings
		const mergedSettings: CustomerIntegrationSettingsSettingsData =
			existing?.settings || DEFAULT_CUSTOMER_INTEGRATION_SETTINGS;

		// Create the single integration update object
		const singleIntegrationUpdate: CustomerIntegrationSettingsSettingsData = {
			[integrationName]: {
				...(mergedSettings[integrationName] || DEFAULT_CUSTOMER_INTEGRATION_SETTINGS[integrationName] || {}),
				...(updates.status ? { status: updates.status } : {}),
				...(updates.mode ? { mode: updates.mode } : {})
			}
		};

		// Use the existing createOrUpdate method with the single integration update
		const result = await this.createOrUpdate(customerId, singleIntegrationUpdate, userInfo);

		// Add specific message for single integration update
		const integrationExists = existing?.settings?.[integrationName];
		const message = integrationExists
			? `${integrationName} integration setting was successfully updated.`
			: `${integrationName} integration setting was successfully created.`;

		return { ...result, message };
	}

	async findById(customerID: UUID) {
		let integrationSettings = await customerIntegrationSettingsRepository.findById(customerID);

		const useGiactStrategy = await getFlagValue(FEATURE_FLAGS.DOS_830_GIACT_STRATEGY_PATTERN, null, false);

		// filter out the SANDBOX and MOCK options for the giact gverify and gauthenticate integration setting if the feature flag is disabled
		if (!useGiactStrategy && integrationSettings?.settings?.gverify && integrationSettings?.settings?.gauthenticate) {
			integrationSettings.settings.gverify.options = ["PRODUCTION", "DISABLE"] as IntegrationOptions[];
			integrationSettings.settings.gauthenticate.options = ["PRODUCTION", "DISABLE"] as IntegrationOptions[];
		}

		const integrationStatus = await this.getIntegrationStatusForCustomer(customerID);
		const processorOrchestrationStatus = integrationStatus?.find(
			(item: { integration_code: string }) => item.integration_code === "processor_orchestration"
		);

		if (processorOrchestrationStatus) {
			if (!integrationSettings) {
				integrationSettings = { customer_id: customerID, settings: {} };
			}
			if (!integrationSettings.settings) {
				integrationSettings.settings = {};
			}
			if (!integrationSettings.settings.processor_orchestration) {
				integrationSettings.settings.processor_orchestration = {
					status: "INACTIVE",
					code: "PROCESSOR_ORCHESTRATION" as any,
					label: "Processor Orchestration",
					description: "Enable processor orchestration for payment processing.",
					mode: "PRODUCTION",
					options: ["PRODUCTION", "DISABLE"]
				};
			}
			integrationSettings.settings.processor_orchestration.isEnabled =
				processorOrchestrationStatus.status === "ENABLED";
		}

		return integrationSettings;
	}

	async updateIntegrationStatusForCustomer(
		customerId: UUID,
		updates: Array<{
			integrationStatusId: UUID;
			newStatus: "ENABLED" | "DISABLED";
		}>
	) {
		const upserts = updates.map(({ integrationStatusId, newStatus }) => ({
			customer_id: customerId,
			integration_status_id: integrationStatusId,
			status: newStatus
		}));

		// Use insert + onConflict to handle all updates in one DB call
		await db("integrations.data_customer_integration_status")
			.insert(upserts)
			.onConflict(["customer_id", "integration_status_id"])
			.merge(["status"]);
	}

	async getIntegrationStatusForCustomer(customerId: UUID) {
		const result = await db("integrations.core_integration_status as cis")
			.leftJoin("integrations.data_customer_integration_status as dcis", function () {
				this.on("cis.id", "=", "dcis.integration_status_id").andOn("dcis.customer_id", "=", db.raw("?", [customerId]));
			})
			.select(
				"cis.id as integration_status_id",
				"cis.integration_code",
				"cis.integration_label",
				db.raw("COALESCE(dcis.status, cis.status) as status")
			);
		return result;
	}

	// This API will be used to sync all customers from case settings to integration settings and only be once in lifetime
	// TODO: Remove this API after running it once on all environments
	async syncAllCustomers(userInfo) {
		const isFlagEnabled = await getFlagValue(FEATURE_FLAGS.DOS_822_MOVE_EFX_SETTING_FROM_CASE_TO_INTEGRATION, {
			key: "user",
			email: userInfo.email
		});
		if (!isFlagEnabled) {
			throw new CustomerIntegrationSettingsApiError(
				"feature flag is not enabled for this admin",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		const rows = await db("public.data_customer_integration_settings").select("customer_id");
		const customerIds: UUID[] = rows.map(r => r.customer_id);

		const toStatus = (enabled?: boolean) =>
			enabled ? INTEGRATION_ENABLE_STATUS.ACTIVE : INTEGRATION_ENABLE_STATUS.INACTIVE;

		const concurrency = 10;
		const chunks: UUID[][] = [];
		for (let i = 0; i < customerIds.length; i += concurrency) chunks.push(customerIds.slice(i, i + concurrency));
		for (const group of chunks) {
			await Promise.allSettled(
				group.map(async customerId => {
					const onboardingCustomerSettings = await getOnboardingCustomerSettings(customerId).catch(() => []);
					const customOnboarding = onboardingCustomerSettings.find(
						item => item.code === CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
					);
					let idvEnabled = false;
					if (customOnboarding?.is_enabled) {
						const customerOnboardingStagesSettings = await getCustomerOnboardingStagesSettings(
							customerId,
							CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
						);
						const { ownershipStage } = customerOnboardingStagesSettings.reduce(
							(acc, stage) => {
								if (stage.stage_code === "ownership") acc.ownershipStage = stage;
								return acc;
							},
							{ ownershipStage: null }
						);

						if (ownershipStage) {
							const idvDisabledField = ownershipStage?.config?.fields?.find(
								(f: { name: string }) => f.name === "Disable Identity Verification"
							);
							if (idvDisabledField && !idvDisabledField.status) {
								idvEnabled = true;
							}
						}
					}

					const equifaxEnabled = Boolean(
						onboardingCustomerSettings?.find((s: any) => s.code === "equifax_credit_score_setup")?.is_enabled
					);

					await customerIntegrationSettings.createOrUpdate(
						customerId,
						{
							equifax: { status: toStatus(equifaxEnabled) } as any,
							identity_verification: { status: toStatus(idvEnabled) } as any
						},
						userInfo
					);
				})
			);
		}
		return { processed: customerIds.length };
	}

	private filterSettingsByCustomerType(
		settings: CustomerIntegrationSettingsSettingsData,
		customerType: "PRODUCTION" | "SANDBOX"
	): CustomerIntegrationSettingsSettingsData {
		const PRODUCTION_OPTIONS: ("PRODUCTION" | "SANDBOX" | "MOCK" | "DISABLE")[] = ["PRODUCTION", "DISABLE"];
		const PRODUCTION_SAFE_MODES = new Set(["PRODUCTION", "DISABLE"]);

		const filteredSettings: CustomerIntegrationSettingsSettingsData = {};

		for (const [key, setting] of Object.entries(settings)) {
			if (!setting) continue;

			let filteredOptions: ("PRODUCTION" | "SANDBOX" | "MOCK" | "DISABLE")[];
			let adjustedMode = setting.mode;

			if (customerType === "PRODUCTION") {
				filteredOptions = PRODUCTION_OPTIONS;
				if (!PRODUCTION_SAFE_MODES.has(setting.mode)) {
					adjustedMode = "PRODUCTION";
				}
			} else {
				// SANDBOX customers get parent's actual options (respects integration capabilities)
				filteredOptions = setting.options;
				const validModes = new Set(setting.options);
				if (!validModes.has(setting.mode)) {
					adjustedMode = "SANDBOX";
				}
			}

			filteredSettings[key as keyof CustomerIntegrationSettingsSettingsData] = {
				status: setting.status,
				code: setting.code,
				label: setting.label,
				description: setting.description,
				mode: adjustedMode,
				options: filteredOptions
			};
		}

		return filteredSettings;
	}

	async copyCustomerIntegrationSettingsFromParent(
		parentCustomerId: UUID,
		childCustomerId: UUID,
		childCustomerType: "PRODUCTION" | "SANDBOX"
	): Promise<CustomerIntegrationSettingsData & { message?: string }> {
		try {
			// Get parent customer's integration settings
			const parentSettings = await customerIntegrationSettingsRepository.findById(parentCustomerId);

			if (!parentSettings) {
				logger.info(`No integration settings found for parent customer ${parentCustomerId}`);
				return {
					customer_id: childCustomerId,
					settings: DEFAULT_CUSTOMER_INTEGRATION_SETTINGS,
					message: "No parent integration settings to copy returned default settings."
				};
			}

			// Filter settings based on child customer type
			const filteredSettings = this.filterSettingsByCustomerType(parentSettings.settings, childCustomerType);

			// Check if child customer already has integration settings
			const childSettings = await customerIntegrationSettingsRepository.findById(childCustomerId);

			let result;
			if (childSettings) {
				// Update existing settings with filtered parent's settings
				result = await customerIntegrationSettingsRepository.update(childCustomerId, filteredSettings);
				logger.info(
					`Successfully updated integration settings for child customer ${childCustomerId} with parent customer ${parentCustomerId} settings (filtered for ${childCustomerType})`
				);
			} else {
				// Create new settings with filtered parent's settings
				result = await customerIntegrationSettingsRepository.create(childCustomerId, filteredSettings);
				logger.info(
					`Successfully copied integration settings from parent customer ${parentCustomerId} to child customer ${childCustomerId} (filtered for ${childCustomerType})`
				);
			}

			return {
				...result,
				message: childSettings
					? "Integration settings updated from parent customer successfully."
					: "Integration settings copied from parent customer successfully."
			};
		} catch (error) {
			logger.error(
				error,
				`Error copying integration settings from parent ${parentCustomerId} to child ${childCustomerId}:`
			);
			throw error;
		}
	}

	async copyCustomerIntegrationStatusFromParent(
		parentCustomerId: UUID,
		childCustomerId: UUID
	): Promise<{ message?: string }> {
		try {
			// Get parent customer's integration status
			const parentStatusQuery = `SELECT dcis.*, cis.integration_code, cis.integration_label
				FROM integrations.data_customer_integration_status dcis
				LEFT JOIN integrations.core_integration_status cis ON cis.id = dcis.integration_status_id
				WHERE dcis.customer_id = $1`;

			const parentStatusResult = await sqlQuery({ sql: parentStatusQuery, values: [parentCustomerId] });

			if (parentStatusResult.rows.length === 0) {
				logger.info(`No integration status found for parent customer ${parentCustomerId}`);
				return { message: "No parent integration status to copy." };
			}

			// Get existing integration status for child customer
			const childStatusQuery = `SELECT dcis.*, cis.integration_code, cis.integration_label
				FROM integrations.data_customer_integration_status dcis
				LEFT JOIN integrations.core_integration_status cis ON cis.id = dcis.integration_status_id
				WHERE dcis.customer_id = $1`;

			const childStatusResult = await sqlQuery({ sql: childStatusQuery, values: [childCustomerId] });
			const existingChildStatus = new Map();

			// Create a map of existing child status by integration_status_id
			childStatusResult.rows.forEach((status: any) => {
				existingChildStatus.set(status.integration_status_id, status);
			});

			const updateStatusQuery = `UPDATE integrations.data_customer_integration_status SET 
				status = $1
				WHERE id = $2 AND customer_id = $3`;

			const insertStatusQuery = `INSERT INTO integrations.data_customer_integration_status (customer_id, integration_status_id, status) 
				VALUES ($1, $2, $3)`;

			const queries: string[] = [];
			const values: any[] = [];
			let updateCount = 0;
			let insertCount = 0;

			// Process each parent status
			parentStatusResult.rows.forEach((parentStatus: any) => {
				const existingChildStatusRecord = existingChildStatus.get(parentStatus.integration_status_id);

				if (existingChildStatusRecord) {
					// Update existing status
					queries.push(updateStatusQuery);
					values.push([parentStatus.status, existingChildStatusRecord.id, childCustomerId]);
					updateCount++;
				} else {
					// Insert new status
					queries.push(insertStatusQuery);
					values.push([childCustomerId, parentStatus.integration_status_id, parentStatus.status]);
					insertCount++;
				}
			});

			// Execute all queries in a transaction
			if (queries.length > 0) {
				await sqlTransaction(queries, values);
			}

			logger.info(
				`Successfully processed ${parentStatusResult.rows.length} integration status records from parent customer ${parentCustomerId} to child customer ${childCustomerId}. Updated: ${updateCount}, Inserted: ${insertCount}`
			);

			return {
				message: `Successfully processed ${parentStatusResult.rows.length} integration status records from parent customer. Updated: ${updateCount}, Inserted: ${insertCount}`
			};
		} catch (error) {
			logger.error(
				error,
				`Error copying integration status from parent ${parentCustomerId} to child ${childCustomerId}:`
			);
			throw error;
		}
	}

	async isCustomerIntegrationSettingEnabled(customerId: UUID, integrationSettingKey: string) {
		const customerSettings = await this.findById(customerId);
		return customerSettings?.settings?.[integrationSettingKey]?.status === INTEGRATION_ENABLE_STATUS.ACTIVE;
	}
}

export const customerIntegrationSettings = new CustomerIntegrationSettings();
