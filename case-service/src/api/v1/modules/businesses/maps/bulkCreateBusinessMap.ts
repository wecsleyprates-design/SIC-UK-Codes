import { envConfig } from "#configs/index";
import { db } from "#helpers/index";
import { Business, type MapperDefinition } from "#types/index";
import { redactFields } from "#utils";
import { v4 as uuid } from "uuid";
import { Mapper, MapperError } from "../mapper";
import {
	getBusinessMailingAddressesFields,
	collectMailingAddresses,
	getBusinessNamesFields,
	collectBusinessNames,
	processIntegrationData,
	validateIntegrationData,
	processApplicantFields,
	validateApplicantFields,
	validateOwnerFields,
	processOwnerFields,
	processCustomFields,
	processBusinessFields,
	validateBusinessFields,
	getApplicantConfigFields,
	processApplicantConfigFields,
	validateApplicantConfigFields,
	relBusinessCustomerMonitoringFields,
	getApplicantFields,
	getBusinessFields,
	getOwnerFields,
	getIntegrationDataFields,
	getCustomFields
} from "./fields";
import type { UUID } from "crypto";

/* Instructions on how to parse a BulkCreateBusiness run */

// Construct "owner{n}_" fields for n = 2, 3, 4, 5

export class BulkCreateBusinessMap extends Mapper {
	private static _MAP: MapperDefinition | undefined;

	// Lazily build the map so field factories (e.g. getOwnerFields) only run when the mapper is actually used.
	static get MAP(): MapperDefinition {
		if (this._MAP) return this._MAP;
		this._MAP = {
			preValidate: async (mapper: BulkCreateBusinessMap) => {
				const businessIDField = mapper.getMappedFieldForColumn<string>("id", "data_businesses");
				if (businessIDField?.value) {
					throw new MapperError(`The business ID field must not be provided`, businessIDField);
				}
			},
			tables: {
				data_business_names: {
					order: -2,
					validate: collectBusinessNames,
					process: async () => {
						// do nothing - processing is handled in the validate step and persisted in the data_business stage
						return Promise.resolve();
					},
					fields: getBusinessNamesFields()
				},
				data_business_addresses: {
					order: -1,
					fields: getBusinessMailingAddressesFields(),
					process: collectMailingAddresses
				},
				data_businesses: {
					order: 0,
					validate: validateBusinessFields,
					process: processBusinessFields,
					prefill: {
						applicant: {
							applicant_id: (mapper: Mapper) => {
								const applicantIdFromInput = 
									mapper.getInputValue<string>("applicant_id") ||
									mapper.getInputValue<string>("applicantid");
								return applicantIdFromInput || envConfig.ENTERPRISE_APPLICANT_ID;
							}
						},
						data_businesses: {
							created_by: (mapper: Mapper) => mapper.getAdditionalMetadata().userID,
							updated_by: (mapper: Mapper) => mapper.getAdditionalMetadata().userID,
							status: () => Business.Status.UNVERIFIED
						},
						rel_business_customer_monitoring: {
							customer_id: (mapper: Mapper) => mapper.getAdditionalMetadata().customerID,
							created_by: (mapper: Mapper) => mapper.getAdditionalMetadata().userID
						},
						integration_data: {
							run_id: (mapper: Mapper) => mapper.getRunId()
						}
					},
					fields: getBusinessFields()
				},
				data_business_applicant_configs: {
					order: 1,
					fields: getApplicantConfigFields(),
					validate: validateApplicantConfigFields,
					process: processApplicantConfigFields
				},
				rel_business_customer_monitoring: {
					order: 2,
					prefill: {
						rel_business_customer_monitoring: {
							business_id: (mapper: Mapper) => {
								return mapper.getAdditionalMetadata()?.data_businesses?.id;
							},
							is_monitoring_enabled: (mapper: Mapper) => {
								return mapper.getAdditionalMetadata().riskMonitoring;
							}
						}
					},
					fields: relBusinessCustomerMonitoringFields,
					onConflict: query =>
						query.onConflict(["business_id", "customer_id"]).merge({
							metadata: db.raw("?? || EXCLUDED.??", ["rel_business_customer_monitoring.metadata", "metadata"])
						})
				},
				data_owners: {
					order: 3,
					fields: getOwnerFields("create"),
					validate: validateOwnerFields,
					process: processOwnerFields
				},
				applicant: {
					order: 4,
					fields: getApplicantFields(),
					validate: validateApplicantFields,
					process: processApplicantFields
				},
				integration_data: {
					order: 5,
					fields: getIntegrationDataFields(),
					validate: validateIntegrationData,
					process: processIntegrationData
				},
				data_business_custom_fields: {
					order: 6,
					fields: getCustomFields(),
					process: processCustomFields
				}
			}
		};
		return this._MAP;
	}

	constructor(input: Map<string, any>, runId = uuid(), threshold = 0.2) {
		super(BulkCreateBusinessMap.MAP, input, { runId: runId as UUID, threshold, knexInstance: db });
	}

	public sanitizeMetadata() {
		const metadata = super.sanitizeMetadata();
		// Keep `integration_data` and `metadata` in bulk responses, but mask sensitive values within them.
		return redactFields(metadata, ["is_deleted", "deleted_at", "deleted_by"]);
	}
}
