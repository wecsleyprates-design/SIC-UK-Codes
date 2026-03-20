import { logger } from "#helpers";
import type { MapperField } from "#types";
import { applicantConfig } from "../../../applicant-config/applicant-config";
import type { Mapper } from "../../mapper";
import type { AgingConfig } from "../../types";
import { validateAgingConfigThresholds } from "../bulkValidators";
import { assertTruthy } from "../utils";

export async function validateApplicantConfigFields(mapper: Mapper, mappedFields: MapperField[]) {
	const agingField = mappedFields.find(f => f.column === "aging_config");
	if (agingField) {
		validateAgingConfigThresholds(agingField);
	}
}

export async function processApplicantConfigFields(mapper: Mapper, fields: MapperField[]) {
	const metadata = mapper.getAdditionalMetadata();
	const businessID = metadata.data_businesses?.id;
	const customerID = metadata.customerID;
	const agingConfig = fields.reduce((acc, field) => {
		if (field.table === "data_business_applicant_configs" && field.column === "aging_config") {
			// The field.value already contains the full AgingConfig object
			return field.value as AgingConfig;
		}
		return acc;
	}, {} as AgingConfig);
	if (!businessID) {
		logger.info(agingConfig, "No business ID found in metadata, skipping aging config processing");
		return;
	}
	await applicantConfig.addOrUpdateApplicantConfigForBusiness(businessID, customerID, 1, agingConfig);
	logger.info(`Completed processing aging config for business ID: ${businessID}`);
}

export function getApplicantConfigFields(): MapperField[] {
	return [
		{
			column: "aging_config",
			description: "Configuration for business application aging thresholds and custom messages",
			table: "data_business_applicant_configs",
			dataType: "json",
			required: false,
			sanitize: async (_, value: any): Promise<null | object> => {
				if (!value) return null;

				let config: any;
				if (typeof value === "string") {
					try {
						config = JSON.parse(value);
					} catch {
						return null;
					}
				} else if (typeof value === "object") {
					config = value;
				} else {
					return null;
				}

				// Validate structure
				if (!config.thresholds || typeof config.thresholds !== "object") {
					return null;
				}

				const { thresholds, custom_messages } = config;

				// Validate thresholds
				if (
					("low" in thresholds && typeof thresholds.low !== "number") ||
					("medium" in thresholds && typeof thresholds.medium !== "number") ||
					("high" in thresholds && typeof thresholds.high !== "number")
				) {
					return null;
				}

				// Validate custom_messages if provided
				if (custom_messages) {
					if (
						typeof custom_messages !== "object" ||
						(custom_messages.low && typeof custom_messages.low !== "string") ||
						(custom_messages.medium && typeof custom_messages.medium !== "string") ||
						(custom_messages.high && typeof custom_messages.high !== "string")
					) {
						return null;
					}
				}

				return config;
			},
			validate: async (_, field) => {
				if (!field.value) return;

				const config = field.value as any;
				const { thresholds } = config;

				assertTruthy(
					thresholds.low >= 0 &&
						thresholds.medium >= 0 &&
						thresholds.high >= 0 &&
						thresholds.low < thresholds.medium &&
						thresholds.medium < thresholds.high,
					field
				);
			}
		}
	];
}
