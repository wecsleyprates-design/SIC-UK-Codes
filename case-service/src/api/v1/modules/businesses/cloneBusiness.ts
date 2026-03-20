import { logger, producer } from "#helpers/index";
import type { UserInfo } from "#types";
import { v4 as uuid } from "uuid";
import { sendEventToGatherWebhookData, sendEventToFetchAdverseMedia } from "#common";
import { WEBHOOK_EVENTS } from "#constants";
import { customerLimits } from "../onboarding/customer-limits";
import { BulkCreateBusinessMap } from "./maps/bulkCreateBusinessMap";
import { caseManagementService as caseService } from "../case-management/case-management";
import { UUID } from "crypto";
import { decryptEin } from "#utils";
import { onboarding } from "../onboarding/onboarding";
import { kafkaEvents, kafkaTopics } from "#constants/index";
import type { Business, Case } from "@joinworth/types/dist/types/cases";
import type { Business as BusinessType } from "#types/business";

interface CloneBusinessParams {
	customerID: UUID;
	businessID: UUID;
	caseID: UUID;
}

interface CloneBusinessBody {
	businessDetails?: {
		name?: string;
		dba_name?: string;
		tin?: string;
		address_line_1?: string;
		address_line_2?: string;
		address_city?: string;
		address_state?: string;
		address_postal_code?: string;
		address_country?: string;
	};
	sectionsToClone?: {
		ownership?: boolean;
		customFields?: boolean;
	};
}

interface AuditContext {
	sourceCaseID: UUID;
	sourceBusinessID: UUID;
	sourceBusinessName: string;
	customerID: UUID;
	userID: UUID;
}

export class CloneBusiness {
	static async cloneBusiness(params: CloneBusinessParams, body: CloneBusinessBody, userInfo: UserInfo) {
		const { customerID, businessID: sourceBusinessID, caseID: sourceCaseID } = params;

		const { businessDetails = {}, sectionsToClone = {} } = body;

		try {
			const [sourceCaseData, sourceBusinessNames, sourceBusinessAddresses] = await Promise.all([
				caseService.internalGetCaseByID({ caseID: sourceCaseID }),
				caseService.getBusinessNames({ businessID: sourceBusinessID }),
				caseService.getBusinessAddresses({ businessID: sourceBusinessID })
			]);

			if (!sourceCaseData) {
				throw new Error(`Source case ${sourceCaseID} not found`);
			}

			const sourceBusinessData = sourceCaseData?.business;

			const dbaNamesPayload = CloneBusiness.buildDbaPayload(sourceBusinessNames, businessDetails?.dba_name);
			const additionalAddressesPayload = CloneBusiness.buildAdditionalAddressesPayload(sourceBusinessAddresses);

			// Fetch bypass_ssn and skip_credit_check from the customer business configs
			const customerBusinessConfigs = await onboarding.getCustomerBusinessConfigs({
				customerID,
				businessID: sourceBusinessID
			});

			const skipCreditCheck = customerBusinessConfigs[0]?.config?.skip_credit_check;
			const bypassSsn = customerBusinessConfigs[0]?.config?.bypass_ssn;

			// Determine TIN value - only decrypt source TIN if no TIN provided in businessDetails
			let tinValue = businessDetails.tin;
			if (!tinValue && sourceBusinessData?.tin) {
				tinValue = decryptEin(sourceBusinessData.tin);
			}

			// Build base business payload
			const businessDetailsPayload = {
				external_id: uuid(),
				quick_add: true,
				name: businessDetails.name || sourceBusinessData?.name,
				...dbaNamesPayload,
				tin: tinValue,
				address_line_1: businessDetails.address_line_1 || sourceBusinessData?.address_line_1,
				address_line_2: businessDetails.address_line_2 || sourceBusinessData?.address_line_2,
				address_city: businessDetails.address_city || sourceBusinessData?.address_city,
				address_state: businessDetails.address_state || sourceBusinessData?.address_state,
				address_postal_code: businessDetails.address_postal_code || sourceBusinessData?.address_postal_code,
				address_country: businessDetails.address_country || sourceBusinessData?.address_country,
				...additionalAddressesPayload,
				industry: sourceBusinessData?.industry?.id || sourceBusinessData?.industry?.name,
				naics_code: sourceBusinessData?.naics_code,
				naics_title: sourceBusinessData?.naics_title,
				mcc_code: sourceBusinessData?.mcc_code,
				mcc_title: sourceBusinessData?.mcc_title,
				official_website: sourceBusinessData?.official_website,
				mobile: sourceBusinessData?.mobile,
				skip_credit_check: skipCreditCheck,
				bypass_ssn: bypassSsn
			};

			// Add ownership data if requested
			let ownershipPayload = {};
			if (sectionsToClone.ownership) {
				const owners = sourceCaseData?.owners;
				ownershipPayload = CloneBusiness.buildOwnershipPayload(owners);
			}

			// Add custom fields data if requested
			let customFieldsPayload = {};
			if (sectionsToClone.customFields) {
				customFieldsPayload = await CloneBusiness.buildCustomFieldsPayload(customerID, sourceBusinessID, sourceCaseID);
			}

			// Build final payload
			const aggregatedPayload = {
				...businessDetailsPayload,
				...ownershipPayload,
				...customFieldsPayload
			};

			// Remove null/undefined/empty values
			const finalPayload = CloneBusiness.removeEmptyValues(aggregatedPayload);

			const auditContext: AuditContext = {
				sourceCaseID,
				sourceBusinessID,
				sourceBusinessName: sourceBusinessData?.name,
				customerID,
				userID: userInfo.user_id as UUID
			};

			const result = await CloneBusiness.executeBusinessCreation(finalPayload, customerID, userInfo, auditContext);

			return {
				businessId: result.business.id,
				caseId: result.case.id
			};
		} catch (error) {
			logger.error(
				{
					sourceBusinessID,
					sourceCaseID,
					customerID,
					userID: userInfo.user_id,
					error
				},
				`Error cloning business: ${error instanceof Error ? error.message : JSON.stringify(error)}`
			);
			throw error;
		}
	}

	// Execute the business creation utilizing the BulkCreateBusinessMap
	static async executeBusinessCreation(
		businessPayload: Record<string, any>,
		customerID: UUID,
		userInfo: UserInfo,
		auditContext: AuditContext
	): Promise<{ business: Business.BusinessRecord; case: Case.CaseRecord; metadata: Record<string, unknown> }> {
		try {
			const input = new Map(Object.entries(businessPayload));
			const mapper = new BulkCreateBusinessMap(input);

			mapper.setAdditionalMetadata({
				userID: userInfo.user_id,
				customerID: customerID,
				riskMonitoring: false,
				async: false
			});

			// Execute the mapper workflow
			await mapper.match();
			await mapper.validate();
			await mapper.execute();

			// Get the created business and case
			const metadata = mapper.getAdditionalMetadata();
			const newBusiness: Business.BusinessRecord = metadata.data_businesses;
			const newCase: Case.CaseRecord = metadata.data_cases?.[0];

			if (!newBusiness || !newCase) {
				throw new Error("Failed to create business");
			}

			const sanitizedMetadata = mapper.sanitizeMetadata();

			// Execute post-processing
			await CloneBusiness.executePostProcessing(customerID, newBusiness, newCase, auditContext);

			return {
				business: newBusiness,
				case: newCase,
				metadata: sanitizedMetadata
			};
		} catch (error) {
			logger.error(
				{
					businessPayload,
					error
				},
				`Error creating business: ${error instanceof Error ? error.message : JSON.stringify(error)}`
			);
			throw error;
		}
	}

	// If dba_name is provided from request payload, use that as single dba1_name
	// Otherwise, build payload from the non-primary (DBA) business names
	// It is unlikely that a business will have more than 1 DBA name, but the API supports multiple
	static buildDbaPayload = (businessNames: BusinessType.BusinessName[], providedDbaName?: string) => {
		if (providedDbaName) {
			return {
				dba1_name: providedDbaName
			};
		}
		if (!businessNames || !Array.isArray(businessNames)) return {};

		// Get non-primary business names (DBAs)
		const dbaNames = businessNames
			.filter(name => !name.is_primary)
			.map(name => name.name)
			.filter(name => name);

		// Map to dba1_name, dba2_name, etc.
		const dbaPayload = {};
		dbaNames.forEach((name, index) => {
			dbaPayload[`dba${index + 1}_name`] = name;
		});

		return dbaPayload;
	};

	static buildAdditionalAddressesPayload = (businessAddresses: BusinessType.BusinessAddress[]) => {
		if (!businessAddresses || !Array.isArray(businessAddresses)) return {};

		// Get non-primary addresses (additional addresses)
		const additionalAddresses = businessAddresses
			.filter(address => !address.is_primary)
			.filter(address => address.line_1); // Must have at least line_1

		// Map to address2_, address3_, etc. (address1_ is handled separately in main payload)
		const addressPayload = {};
		additionalAddresses.forEach((address, index) => {
			const addressNumber = index + 2; // Start from address2_ since address1_ is primary
			addressPayload[`address${addressNumber}_line_1`] = address.line_1;
			addressPayload[`address${addressNumber}_apartment`] = address.apartment;
			addressPayload[`address${addressNumber}_city`] = address.city;
			addressPayload[`address${addressNumber}_state`] = address.state;
			addressPayload[`address${addressNumber}_country`] = address.country;
			addressPayload[`address${addressNumber}_postal_code`] = address.postal_code;
			addressPayload[`address${addressNumber}_mobile`] = address.mobile;
		});

		return addressPayload;
	};

	private static async buildCustomFieldsPayload(customerId: UUID, sourceBusinessId: UUID, sourceCaseId: UUID) {
		const sourceCustomFields = await caseService.getCustomFields({
			businessID: sourceBusinessId,
			caseID: sourceCaseId,
			customerID: customerId
		});

		if (sourceCustomFields.length === 0) {
			logger.info(`No custom fields found for source business ${sourceBusinessId}`);
			return {};
		}

		const formattedFieldsPayload = sourceCustomFields.reduce(
			(acc, field) => ({
				...acc,
				[`custom:${field.field_code}`]: field.value
			}),
			{}
		);

		return formattedFieldsPayload;
	}

	private static buildOwnershipPayload(owners: BusinessType.Owner[]) {
		if (!owners || !Array.isArray(owners)) return {};

		return owners.reduce((acc, owner, i) => {
			const decryptedSSN = owner?.ssn ? decryptEin(owner.ssn) : null;
			return {
				...acc,
				[`owner${i + 1}_first_name`]: owner.first_name,
				[`owner${i + 1}_last_name`]: owner.last_name,
				[`owner${i + 1}_ssn`]: decryptedSSN,
				[`owner${i + 1}_email`]: owner.email,
				[`owner${i + 1}_mobile`]: owner.mobile,
				[`owner${i + 1}_dob`]: owner.date_of_birth,
				[`owner${i + 1}_title`]: owner.title?.title,
				[`owner${i + 1}_ownership_percentage`]: owner.ownership_percentage,
				[`owner${i + 1}_owner_type`]: owner.owner_type,
				[`owner${i + 1}_address_line_1`]: owner.address_line_1,
				[`owner${i + 1}_address_line_2`]: owner.address_line_2,
				[`owner${i + 1}_address_city`]: owner.address_city,
				[`owner${i + 1}_address_state`]: owner.address_state,
				[`owner${i + 1}_address_postal_code`]: owner.address_postal_code,
				[`owner${i + 1}_address_country`]: owner.address_country
			};
		}, {});
	}

	private static removeEmptyValues(payload: Record<string, any>) {
		return Object.fromEntries(Object.entries(payload).filter(([_, v]) => v != null && v !== ""));
	}

	private static async executePostProcessing(
		customerID: UUID,
		newBusiness: Business.BusinessRecord,
		newCase: Case.CaseRecord,
		auditContext: AuditContext
	) {
		try {
			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: newBusiness.id });
			await sendEventToFetchAdverseMedia(newBusiness.id as UUID, customerID, newCase.id as UUID);
			await customerLimits.addBusinessCount(customerID, newBusiness.id as UUID);
			await CloneBusiness.sendAuditEvent(newBusiness, newCase, auditContext);
		} catch (error) {
			logger.error({ error }, `Post-processing failed for business ${newBusiness.id}`);
		}
	}

	private static async sendAuditEvent(
		newBusiness: Business.BusinessRecord,
		newCase: Case.CaseRecord,
		auditContext: AuditContext
	) {
		const clonedAuditMessage = {
			customer_id: auditContext.customerID,
			business_id: newBusiness.id,
			business_name: newBusiness.name,
			case_id: newCase.id,
			cloned_from_business_id: auditContext.sourceBusinessID,
			cloned_from_business_name: auditContext.sourceBusinessName,
			cloned_from_case_id: auditContext.sourceCaseID,
			user_id: auditContext.userID
		};

		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [{
				key: newBusiness.id,
				value: {
					event: kafkaEvents.BUSINESS_CLONED_AUDIT,
					...clonedAuditMessage
				}
			}]
		});
	}
}
