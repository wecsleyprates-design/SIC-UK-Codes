import { CASE_STATUS, CASE_TYPE, kafkaEvents, kafkaTopics } from "#constants";
import { businessLookupHelper, type LookupBusinessRequest } from "#helpers/businessLookupHelper";
import { producer } from "#helpers/kafka";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { Business, KafkaMessage, MapperDefinition, MapperField } from "#types/index";
import { encryptEin } from "#utils/encryption";
import { SerializableMap } from "#utils/serialization";
import { redactFields } from "#utils";
import { v4 as uuid } from "uuid";
import { caseManagementService } from "../../case-management/case-management";
import { businesses } from "../businesses";
import { Mapper, MapperError } from "../mapper";
import { envConfig } from "#configs/env.config";
import { validateBusiness } from "../validateBusiness";
import type { UUID } from "crypto";
import { TIN_BEHAVIOR } from "#constants";
import { AgingConfig } from "../types";
import { applicantConfig } from "../../applicant-config/applicant-config";
import { validateAgingConfigThresholds } from "./bulkValidators";
import { dispatchSynchronousStateUpdate } from "#helpers";
import { BusinessState, type BusinessStateTable } from "../businessState";
import type { StateTable } from "#utils/stateMachine";
import { AddressUtil } from "#utils";
import {
	getBusinessNamesFields,
	collectBusinessNames,
	getBusinessFields,
	getIntegrationDataFields,
	getBusinessMailingAddressesFields,
	collectMailingAddresses,
	relBusinessCustomerMonitoringFields,
	getCustomFields,
	getApplicantConfigFields,
	getOwnerFields,
	updateProcessOwnerFields,
	updateValidateOwnerFields,
	processCustomFields
} from "./fields/";

const dropRequired = (field: MapperField) => {
	return { ...field, required: false };
};

export class BulkUpdateBusinessMap extends Mapper {
	private static _MAP: MapperDefinition | undefined;

	// Lazily build the map so field factories (e.g. getOwnerFields) only run when the mapper is actually used.
	static get MAP(): MapperDefinition {
		if (this._MAP) return this._MAP;
		this._MAP = {
			/* Global validation for the entire map */
			preValidate: async (mapper: Mapper) => {
				const metadata = mapper.getAdditionalMetadata();
				const { customerID } = metadata;

				if (!customerID) {
					throw new Error("A customer ID is required to update a business");
				}

				const fields = mapper.getMappedFields();
				const businessIdField = fields.find(f => f.table === "data_businesses" && f.column === "id");
				const externalIDField = fields.find(
					f => f.column === "external_id" && f.table === "rel_business_customer_monitoring"
				);
				const tinField = fields.find(f => f.column === "tin" && f.table === "data_businesses");
				let businessList: Business.Record[];
				let business: Business.Record;
				let updateBusinessID: UUID = businessIdField?.value ?? metadata.data_businesses?.id;
				if (!updateBusinessID && metadata.businessID) {
					updateBusinessID = metadata.businessID;
				}

				try {
					businessList = (await businessLookupHelper(
						{
							businessID: updateBusinessID,
							customerID,
							externalID: externalIDField?.value,
							tin: tinField?.value
						} as LookupBusinessRequest,
						TIN_BEHAVIOR.PLAIN
					)) as Business.Record[];
					if (!businessList[0]?.id) {
						throw new MapperError("Business ID not returned from lookup");
					}
					business = businessList[0];
				} catch (_ex) {
					throw new MapperError("Business not found");
				}

				const originalState = await BusinessState.forBusiness(business.id as UUID, customerID);

				const customerBusiness = originalState.getState().rel_business_customer_monitoring;
				if (!customerBusiness?.external_id) {
					throw new MapperError("Business not associated with customer");
				}

				const currentCase = originalState.getState().onboarding_case;
				if (currentCase) {
					mapper.addAdditionalMetadata({ data_cases: currentCase });
				}

				mapper.addAdditionalMetadata({
					data_businesses: business,
					businessID: business.id,
					originalState: originalState
				});
			},
			postValidate: async (mapper: Mapper) => {
				// Make sure we're actually updating something
				const {
					originalState,
					dba_names,
					mailing_addresses,
					owners
				}: {
					originalState: BusinessState;
					dba_names: undefined | { name: string; is_primary?: boolean }[];
					mailing_addresses: undefined | Business.BusinessAddress[];
					owners: undefined | Business.Owner[];
				} = mapper.getAdditionalMetadata();

				const fields = mapper.getMappedFields();
				if (fields.length === 0) {
					throw new MapperError("No fields to update");
				}

				// Build a patched plain state by overlaying mapped field values on top of the original plain state
				const patchedPlain = {
					...originalState.getState("plain"),
					data_business_names: dba_names ?? originalState.getState().data_business_names ?? [],
					data_business_addresses: mailing_addresses ?? originalState.getState().data_business_addresses ?? [],
					data_business_owners: owners ?? originalState.getState().data_business_owners ?? []
				};

				const mutateState = (target: BusinessStateTable, path: string, value: unknown) => {
					const segments = path.split(".").filter(Boolean);
					let cursor = target;
					for (let i = 0; i < segments.length; i++) {
						const segment = segments[i];
						const isLast = i === segments.length - 1;
						if (isLast) {
							cursor[segment] = value;
							return;
						}
						if (cursor[segment] == null || typeof cursor[segment] !== "object") {
							cursor[segment] = {};
						}
						cursor = cursor[segment];
					}
				};

				fields.forEach(field => {
					const pathKey =
						field.pathKey ??
						(field.concat && field.providedKey
							? `${String(field.table)}.${String(field.column)}.${String(field.providedKey)}`
							: `${String(field.table)}.${String(field.column)}`);
					if (pathKey.indexOf("[]") === -1) {
						mutateState(patchedPlain, pathKey, field.value);
					}
				});

				// Create a new state from the patched plain state and diff against the original
				const newState = originalState.cloneWithState(patchedPlain);

				const flatDiff = originalState.diffFlat(newState);
				const changed = Object.entries(flatDiff).map(([path, entry]) => {
					return {
						path,
						previousValue: entry.previousValue,
						newValue: entry.newValue
					};
				});

				// Return early, nothing to work through if no changes were provided in request body
				// noChanges property will not appear on response object when there are changes present in request body
				if (changed.length === 0) {
					mapper.addAdditionalMetadata({ noChanges: true });
					return;
				}

				logger.debug({ businessID: originalState.getId(), changed }, `Changed fields: ${JSON.stringify(changed)}`);
				// Store as map keyed by path so downstream in-scope checks work
				mapper.addAdditionalMetadata({ changes: flatDiff });
			},
			tables: {
				data_business_addresses: {
					order: -2,
					fields: getBusinessMailingAddressesFields().map(dropRequired),
					// Addresses are handled upstream; skip default insert/update to avoid invalid column names
					validate: collectMailingAddresses,
					// Ensure `data_businesses` table runs even when only mailing addresses are provided.
					// Mapper execution only processes tables that have mapped fields; `prefill` injects a field
					// into `data_businesses` so its `process` handler persists `mailing_addresses`.
					prefill: {
						data_businesses: {
							id: (mapper: Mapper) =>
								mapper.getAdditionalMetadata()?.businessID ?? mapper.getAdditionalMetadata()?.data_businesses?.id
						}
					},
					process: async () => {
						// do nothing
						return Promise.resolve();
					}
				},
				data_owners: {
					order: -1,
					validate: updateValidateOwnerFields,
					fields: getOwnerFields("update"),
					process: updateProcessOwnerFields
				},
				data_business_names: {
					order: -1,
					validate: collectBusinessNames,
					// Ensure `data_businesses` table runs even when only DBA fields are provided.
					// Mapper execution only processes tables that have mapped fields; `prefill` injects a field
					// into `data_businesses` so its `process` handler persists `dba_names`.
					prefill: {
						data_businesses: {
							id: (mapper: Mapper) =>
								mapper.getAdditionalMetadata()?.businessID ?? mapper.getAdditionalMetadata()?.data_businesses?.id
						}
					},
					process: async () => {
						// Do nothing --- logic is handled in validate step and actual processing is handled in the data_business stage
						return Promise.resolve();
					},
					fields: getBusinessNamesFields()
				},
				rel_business_customer_monitoring: {
					order: 0,
					fields: relBusinessCustomerMonitoringFields.map(dropRequired),
					validate: async (mapper: Mapper, fields: MapperField[]) => {
						const metadata = mapper.getAdditionalMetadata();
						const { originalState, customerID }: { originalState: BusinessState; customerID: UUID } = metadata;
						const relBusinessCustomerMonitoring = originalState.getState().rel_business_customer_monitoring;

						// Update metadata column with new metadata we've mapped (to unset fields, we need to provide them as null)
						const newMetadata: Record<string, unknown> = mapper
							.getMappedFields()
							.filter(f => f.value !== undefined)
							.reduce(
								(acc, f) => {
									// Handle fields with concat == true
									if (f.concat && f.providedKey && f.dataType == "json") {
										// If the field should be concatenated, add its value to the existing value
										acc = { ...(acc || {}), ...{ [f.providedKey]: f.value } };
									} else if (f.providedKey) {
										acc[f.providedKey] = f.value;
									}
									return acc;
								},
								// Make sure we're starting with a COPY of the data, not a reference to it
								JSON.parse(JSON.stringify(relBusinessCustomerMonitoring?.metadata ?? {})) || {}
							);
						if (Object.keys(newMetadata).length > 0) {
							mapper.addAdditionalMetadata({ rel_business_customer_monitoring: newMetadata });
						}
						const newExternalID = fields.find(
							f => f.column === "external_id" && f.table === "rel_business_customer_monitoring"
						)?.value;
						if (newExternalID && relBusinessCustomerMonitoring?.external_id !== newExternalID) {
							logger.debug(
								`Updating external id!! old=${relBusinessCustomerMonitoring?.external_id}; new ={$newExternalID}`
							);
							// Make sure this isn't taken yet...
							const existingUseOfExternalID = await businesses.getBusinessByExternalId(
								newExternalID as string,
								customerID
							);
							if (existingUseOfExternalID?.length > 0) {
								throw new MapperError(
									`External ID of ${newExternalID} already in use by businessId=${existingUseOfExternalID[0].id}`
								);
							}
							mapper.addAdditionalMetadata({ newExternalID: newExternalID });
						}
					},
					process: async (mapper: Mapper) => {
						const metadata = mapper.getAdditionalMetadata();
						const { customerID, businessID, rel_business_customer_monitoring, newExternalID } = metadata;

						if (rel_business_customer_monitoring) {
							await db("rel_business_customer_monitoring")
								.update({ metadata: rel_business_customer_monitoring })
								.where({ business_id: businessID, customer_id: customerID });
						}
						if (newExternalID) {
							await db("rel_business_customer_monitoring")
								.update({ external_id: newExternalID })
								.where({ business_id: businessID, customer_id: customerID });
						}
					}
				},
				data_businesses: {
					order: 1,
					validate: async (mapper: Mapper, businessFields: MapperField[]) => {
						const metadata = mapper.getAdditionalMetadata();
						const { data_businesses: business }: { data_businesses: Business.Record } = metadata;
						if (business.status === Business.Status.VERIFIED) {
							const filledNameFields = businessFields.filter(
								f => f.column === "name" && !!f.value && business.name !== f.value
							);
							if (filledNameFields.length > 0) {
								throw new MapperError("Business name cannot be updated for verified businesses", filledNameFields[0]);
							}
						}
					},
					process: async (mapper: Mapper, mappedFields: MapperField[]) => {
						// Return early, nothing to work through if no changes were provided in request body
						if (mapper.getAdditionalMetadata()?.noChanges) {
							return;
						}
						/* For now we're not supporting updating anything in the business except industry, but we need to find the right record */
						const bulkMapper = mapper as BulkUpdateBusinessMap;
						const {
							data_businesses,
							businessID,
							dba_names,
							userID,
							mailing_addresses,
							changes
						}: {
							data_businesses: Business.Record;
							businessID: UUID;
							dba_names: undefined | { name: string; is_primary?: boolean }[];
							userID: UUID;
							mailing_addresses: undefined | Business.BusinessAddress[];
							changes: Record<string, any>;
						} = mapper.getAdditionalMetadata();

						// Only run validateBusiness if there are inscope changes
						let inScopeToUpdateBusinessDirect = false;
						let inScopeToValidate = false;
						if (changes && Object.keys(changes).length > 0) {
							const inScopeForValidation: string[] = [
								"data_business_names.__self",
								"data_business_addresses.__self",
								"data_business_owners.__self",
								"data_businesses.tin"
							];
							const inScopeForUpdateBusinessDirect: string[] = [
								// DBA names & Addresses are persisted via validateBusiness.
								"data_business_names.__self",
								"data_business_addresses.__self",
								"data_businesses.official_website",
								"data_businesses.public_website",
								"data_businesses.social_account",
								"data_businesses.mobile",
								"data_businesses.industry",
								"data_businesses.naics_id",
								"data_businesses.mcc_id",
								"data_businesses.name",
								"data_businesses.address_line_1",
								"data_businesses.address_line_2",
								"data_businesses.address_postal_code",
								"data_businesses.address_city",
								"data_businesses.address_state",
								"data_businesses.address_country"
							];
							inScopeToValidate = Object.keys(changes).some(key => inScopeForValidation.includes(key));
							inScopeToUpdateBusinessDirect = Object.keys(changes).some(key =>
								inScopeForUpdateBusinessDirect.includes(key)
							);
						}
						if (!inScopeToValidate && !inScopeToUpdateBusinessDirect) {
							logger.debug({ changes }, "No in-scope changes found, skipping validateBusiness");
							return;
						}
						const authorization = bulkMapper.getAuth();
						const dbTIN = data_businesses.tin != null && data_businesses.tin !== "" ? data_businesses.tin : null; // has to explicitly check or else it defaults to ''
						type FieldMap = Record<string, any>;
						const mappedBusinessFields = mappedFields.reduce<FieldMap>(
							(acc, f) => {
								if (f.column === "tin") {
									// Only include TIN if provided explicitly in this update
									if (f.value !== undefined && f.value !== null && data_businesses["tin"] !== f.value) {
										acc["tin"] = f.value;
									}
								} else if (f.value != null && data_businesses[f.column] !== f.value) {
									acc[f.column] = f.value;
								} else if (data_businesses[f.column] && f.value != null) {
									acc[f.column] = data_businesses[f.column];
								}
								return acc;
							},

							{ tin: dbTIN, name: data_businesses?.name } // initial accumulator has the DB TIN and name
						);

						// TIN Encryption
						if (mappedBusinessFields.tin) {
							mappedBusinessFields.tin = encryptEin(String(mappedBusinessFields.tin));
						}

						const businessUpdate = {
							...mappedBusinessFields,
							id: businessID,
							dba_names,
							user_id: envConfig.ENTERPRISE_APPLICANT_ID ?? userID
						};

						if (businessID && inScopeToUpdateBusinessDirect && Object.keys(businessUpdate).length > 0) {
							logger.debug(
								`businessId=${businessID} updating business with new fields ${JSON.stringify(businessUpdate)}`
							);
							await businesses.updateBusiness(businessUpdate);
						}

						const applicantID = mapper.getMappedValueForColumn<UUID>(
							"applicant_id",
							"applicant",
							envConfig.ENTERPRISE_APPLICANT_ID as UUID
						);

						const businessEgg = Object.entries(data_businesses).reduce((acc, [fieldName, existingValue]) => {
							const mappedValue = mappedFields.find(
								f => f.column === fieldName && f.table === "data_businesses"
							)?.value;
							acc[fieldName] = mappedValue != undefined ? mappedValue : existingValue;

							return acc;
						}, {} as Business.Egg);

						const validationRequest = {
							tin: businessEgg.tin as UUID,
							address_line_1: businessEgg.address_line_1,
							address_line_2: businessEgg.address_line_2,
							address_postal_code: businessEgg.address_postal_code,
							address_city: businessEgg.address_city,
							address_state: businessEgg.address_state,
							address_country: businessEgg.address_country,
							mobile: businessEgg.mobile,
							name: businessEgg.name,
							official_website: businessEgg.official_website,
							case_type: CASE_TYPE.ONBOARDING,
							...(mailing_addresses && { mailing_addresses: AddressUtil.sanitizeAddresses(mailing_addresses) }),
							...(dba_names && { dba_names: dba_names })
						};

						// re-order validations on updated business
						try {
							await validateBusiness(businessID as UUID, validationRequest, applicantID as UUID, {
								shouldRunSerpSearch: true,
								authorization,
								isBulk: true,
								userInfo: { user_id: applicantID }
							});
						} catch (err) {
							logger.error(Error, `Error validating business update: ${JSON.stringify(err)}`);
						}

						const updatedBusiness = await businesses.getBusinessByID({
							businessID: data_businesses.id,
							tinBehavior: TIN_BEHAVIOR.MASK
						});
						mapper.addAdditionalMetadata({ data_businesses: updatedBusiness });
					},
					fields: getBusinessFields().map(f =>
						f.column === "tin" ? { ...dropRequired(f), isReadonly: false } : dropRequired(f)
					)
				},
				data_business_applicant_configs: {
					order: 2,
					fields: getApplicantConfigFields(),
					validate: (mapper: Mapper, mappedFields: MapperField[]): void => {
						const agingField = mappedFields.find(f => f.column === "aging_config");
						if (agingField) {
							validateAgingConfigThresholds(agingField);
						}
					},
					process: async (mapper: Mapper, fields: MapperField[]) => {
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
						}
						await applicantConfig.addOrUpdateApplicantConfigForBusiness(businessID, customerID, 1, agingConfig);
						logger.info(`Completed processing aging config for business ID: ${businessID}`);
					}
				},
				integration_data: {
					fields: getIntegrationDataFields(),
					order: 3,
					validate: async (mapper: Mapper) => {
						// Generate a map of new integration data
						const integrationData = mapper.getPossibleFields()?.reduce((acc, field) => {
							const mappedFields = mapper.getMappedFields()?.filter(f => f.column === field.column);
							// Send message with the "model_field" if available, otherwise the normal column name
							const columnKey = field.model_field ?? field.column;
							acc.set(columnKey, acc.get(columnKey) || null);
							if (mappedFields) {
								for (const mappedField of mappedFields) {
									if (field.concat) {
										const currentValue = acc.get(columnKey) ?? {};
										const newValue = {
											...currentValue,
											[mappedField.providedKey ?? mappedField.column]: mappedField.value
										};
										acc.set(columnKey, newValue);
									} else {
										acc.set(columnKey, mappedField.value || null);
									}
								}
							}
							return acc;
						}, new SerializableMap<string, any>());
						integrationData.set("runId", mapper.getRunId());
						mapper.addAdditionalMetadata({ integration_data: Object.fromEntries(integrationData) });
					},
					process: async (mapper: Mapper) => {
						// This just sends a kafka message with the fields
						const metadata = mapper.getAdditionalMetadata();
						const { businessID, data_cases, customerID, userID, integration_data } = metadata;
						let caseInUse = data_cases;
						if (!data_cases?.id) {
							// Generate a new case
							caseInUse = await caseManagementService.createCaseFromEgg({
								business_id: businessID,
								customer_id: customerID,
								applicant_id: data_cases.applicant_id,
								case_type: CASE_TYPE.APPLICATION_EDIT,
								status: CASE_STATUS.SUBMITTED,
								created_by: userID,
								updated_by: userID
							});
							mapper.addAdditionalMetadata({ data_cases: caseInUse });
						}
						const kafkaMessage: KafkaMessage.MapperIntegrationDataUploaded = {
							id: metadata.id,
							case_id: caseInUse.id,
							business_id: businessID,
							customer_id: customerID,
							user_id: userID,
							created_at: new Date(),
							data: integration_data,
							trigger: "BulkUpdateBusinessMap"
						};
						const payload = {
							topic: kafkaTopics.BUSINESS,
							messages: [
								{
									key: businessID,
									value: {
										event: kafkaEvents.INTEGRATION_DATA_UPLOADED,
										...kafkaMessage
									}
								}
							]
						};
						await producer.send(payload);
					}
				},
				data_business_custom_fields: {
					order: 4,
					fields: getCustomFields(),
					process: (mapper: Mapper, fields: MapperField[]) => processCustomFields(mapper, fields, false)
				}
			}
		};
		return this._MAP;
	}

	public async execute(): Promise<void> {
		await super.execute();
		await this.recordActualChanges();
	}

	private async recordActualChanges(): Promise<void> {
		const metadata = this.getAdditionalMetadata();
		const {
			businessID,
			customerID,
			originalState
		}: { businessID: UUID; customerID: UUID | null; originalState: BusinessState } = metadata;

		const currentState = await BusinessState.forBusiness(businessID as UUID, customerID ?? undefined);

		const changes = originalState.diffFlat(currentState);
		if (Object.keys(changes).length > 0) {
			this.addAdditionalMetadata({ changes });
			logger.debug(`Changed fields (persisted): ${JSON.stringify(changes)}`);

			await this.emitChanges({
				customerId: customerID,
				businessId: businessID,
				previousState: originalState.getState(),
				currentState: currentState.getState(),
				changes
			});
			try {
				void (await dispatchSynchronousStateUpdate(businessID, {
					customerId: customerID,
					businessId: businessID,
					previousState: originalState.getState(),
					currentState: currentState.getState(),
					changes
				}));
			} catch (error) {
				if (Error.isError(error)) {
					logger.error(
						{ message: "Failed to dispatch synchronous state update", error, businessID, customerID },
						`Failed to dispatch synchronous state update for business ${businessID} and customer ${customerID}: ${error.message}`
					);
				}
			}
		}
	}

	private async emitChanges(args: {
		customerId?: UUID | null;
		businessId: UUID;
		previousState: StateTable<BusinessStateTable>;
		currentState: StateTable<BusinessStateTable>;
		changes: any;
	}): Promise<void> {
		const { customerId, businessId, previousState, currentState, changes } = args;
		await producer.send({
			topic: kafkaTopics.BUSINESS,
			messages: [
				{
					key: businessId,
					value: JSON.stringify({
						event: kafkaEvents.BUSINESS_STATE_UPDATE_EVENT,
						source: "bulk_update_business_map",
						customerId,
						businessId,
						previousState,
						currentState,
						changes
					})
				}
			]
		});
	}

	constructor(input: Map<string, any>, runId = uuid(), threshold = 0.2) {
		// Overwrite the base map with the new map
		super(BulkUpdateBusinessMap.MAP, input, { runId: runId as UUID, threshold, knexInstance: db });
	}

	public sanitizeMetadata() {
		const metadata = super.sanitizeMetadata();
		delete metadata.original_data_businesses;
		// `changes` is used for internal processing/telemetry; don't return it to clients.
		delete metadata.changes;
		// Keep `integration_data` and `metadata` in bulk responses, but mask sensitive values within them.
		const scrubbed = redactFields(metadata, ["is_deleted", "deleted_at", "deleted_by"]);
		return scrubbed;
	}
}
