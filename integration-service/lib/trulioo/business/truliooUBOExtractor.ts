import { TruliooBase } from "../common/truliooBase";
import {
	TruliooUBOPersonData,
	TruliooPSCFormData,
	TruliooScreenedPersonData,
	TruliooBusinessData,
	TruliooFlowResult,
	TruliooPersonInquiryResult,
	TruliooError
} from "../common/types";
import { logger } from "#helpers/logger";
import { TruliooFactory } from "../utils/truliooFactory";
import { db } from "#helpers/knex";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { sanitizeLog } from "../common/utils";
import type { IBusinessEntityPerson } from "#types/db";
import type { UUID } from "crypto";
import {
	convertOwnersToTruliooPersons,
	convertDiscoveredOfficersToTruliooPersons,
	deduplicatePersons
} from "../common/ownerConverters";
import { TruliooUBORepository } from "./truliooUBORepository";
import { ApplicantFlowOwnersClient } from "./applicantFlowOwnersClient";

/**
 * Trulioo UBO Extractor
 *
 * Orchestrates the extraction and PSC screening of UBOs/Directors by aggregating
 * person data from multiple sources (Trulioo KYB response, Middesk-discovered
 * officers, and applicant-flow owners) and submitting them to Trulioo PSC.
 *
 * Lives in the Trulioo lib because Trulioo PSC is the _consumer_ of all person
 * data — it owns the screening flow, the TruliooBase context, and the PSC API
 * calls. The Middesk/applicant-flow data is fetched via injected dependencies
 * (TruliooUBORepository, ApplicantFlowOwnersClient) to keep cross-provider
 * coupling behind clean interfaces.
 *
 * If the cross-provider aggregation grows more complex, consider extracting
 * the person-gathering logic into a shared `lib/psc/` or `core/psc/` module.
 */
export class TruliooUBOExtractor {
	private truliooBase: TruliooBase;
	private truliooUBORepository: TruliooUBORepository;
	private applicantFlowOwnersClient: ApplicantFlowOwnersClient;

	constructor(
		truliooBase: TruliooBase,
		truliooUBORepository?: TruliooUBORepository,
		applicantFlowOwnersClient?: ApplicantFlowOwnersClient
	) {
		this.truliooBase = truliooBase;
		this.truliooUBORepository = truliooUBORepository ?? new TruliooUBORepository();
		this.applicantFlowOwnersClient = applicantFlowOwnersClient ?? new ApplicantFlowOwnersClient();
	}

	/**
	 * Extract UBOs/Directors from business verification response and automatically screen them
	 * This follows the same pattern as Middesk - business verification automatically handles people
	 *
	 * Note: This method is only called after shouldScreenPSCsForBusiness has verified that:
	 * - For US businesses: Advanced Watchlists toggle is enabled
	 * - For non-US businesses: International KYB is enabled
	 *
	 * @param businessEntityVerificationId - Internal verification ID
	 * @param businessData - Trulioo business data
	 * @param flowResult - Trulioo flow result
	 * @param taskId - Optional task ID from KYB verification to propagate to PSC records
	 * @param advancedWatchlistsEnabled - Optional flag indicating if Advanced Watchlists is enabled (for US businesses)
	 */
	async extractAndScreenUBOsDirectors(
		businessEntityVerificationId: string,
		businessData: TruliooBusinessData,
		flowResult: TruliooFlowResult,
		taskId?: string,
		advancedWatchlistsEnabled?: boolean
	): Promise<TruliooScreenedPersonData[]> {
		try {
			logger.info(`Extracting and screening UBOs/Directors for business: ${this.truliooBase.getBusinessId()}`);

			// Extract persons from Trulioo business response
			// For US businesses with Advanced Watchlists enabled, this will also fetch owners from Middesk and applicant flow
			const personsToScreen = await this.extractPersonsFromBusinessData(businessData, advancedWatchlistsEnabled);

			if (personsToScreen.length === 0) {
				logger.info(`No UBOs/Directors found in business verification response`);
				return [];
			}

			logger.info(`Found ${personsToScreen.length} UBOs/Directors to screen automatically`);

			// Screen all persons concurrently using Trulioo PSC flow (like Middesk does automatically)
			const screeningPromises = personsToScreen.map(async person => {
				try {
					// ATOMIC LOCK: Try to insert the person into business_entity_people with ignore on conflict.
					// This ensures only one process triggers the PSC screening for this specific person.
					const personName = person.fullName;
					const initialPersonRecord: Partial<IBusinessEntityPerson> = {
						business_entity_verification_id: businessEntityVerificationId as UUID,
						name: personName,
						submitted: true,
						source: JSON.stringify([{ type: "trulioo_psc", provider: "trulioo", id: personName, controlType: person.controlType }]),
						titles: person.title ? [person.title] : []
					};

					const lockResult = await db<IBusinessEntityPerson>("integration_data.business_entity_people")
						.insert(initialPersonRecord)
						.onConflict(["business_entity_verification_id", "name"])
						.ignore()
						.returning("id");

					if (!lockResult || lockResult.length === 0) {
						logger.info(`PSC screening already triggered for person ${sanitizeLog(personName)} in verification ${businessEntityVerificationId}, skipping duplicate trigger.`);
						return null;
					}

						return await this.screenPersonWithPSCFlow(person, businessEntityVerificationId, businessData, taskId);
				} catch (error: unknown) {
					logger.error(error, `Error screening person ${person.fullName}:`);
					// Return null for failed screenings - we'll filter these out
					return null;
				}
			});

			// Wait for all screenings to complete and filter out failed ones
			const screeningResults = await Promise.all(screeningPromises);
			const screenedPersons = screeningResults.filter((result): result is TruliooScreenedPersonData => result !== null);

			logger.info(`Successfully screened ${screenedPersons.length} UBOs/Directors`);
			return screenedPersons;
		} catch (error: unknown) {
			logger.error(error, `Error in UBO/Director extraction and screening:`);
			// Don't throw error here as this is supplementary to business verification
			return [];
		}
	}

	/**
	 * Extract persons (UBOs/Directors) from Trulioo business verification response
	 *
	 * For US businesses with Advanced Watchlists enabled (verified by shouldScreenPSCsForBusiness before this is called),
	 * also includes:
	 * - Officers discovered by Middesk from Secretary of State filings (via integration_data.business_entity_people)
	 * - Owners from the applicant flow (via getOwnersUnencrypted from case-service)
	 *
	 * The Middesk-discovered officers are fetched directly from the integration_data.business_entity_people table
	 * with submitted=false, ensuring we only get officers discovered by Middesk (not applicant-submitted people,
	 * which would duplicate the applicant flow owners).
	 *
	 * @param businessData - Trulioo business data
	 * @param advancedWatchlistsEnabled - Optional flag indicating if Advanced Watchlists is enabled (for US businesses)
	 * @returns Array of persons to screen
	 */
	private async extractPersonsFromBusinessData(
		businessData: TruliooBusinessData,
		advancedWatchlistsEnabled?: boolean
	): Promise<TruliooUBOPersonData[]> {
		const persons: TruliooUBOPersonData[] = [];

		try {
			const truliooPersons = this.extractPersonsFromTruliooResponse(businessData);
			persons.push(...truliooPersons);

			const isUSBusiness = this.isUSBusiness(businessData.country);
			let middeskDiscoveredCount = 0;
			let applicantFlowCount = 0;

			// Applicant flow owners are always included (they have rich data: DOB, address, email, phone)
			logger.info("Fetching owners from applicant flow for PSC screening");
			const applicantFlowOwners = await this.fetchApplicantFlowOwners();
			const convertedApplicantOwners = convertOwnersToTruliooPersons(
				applicantFlowOwners,
				"Applicant Flow"
			);
			applicantFlowCount = convertedApplicantOwners.length;
			persons.push(...convertedApplicantOwners);

			if (isUSBusiness && advancedWatchlistsEnabled) {
				logger.info(
					"US business with Advanced Watchlists enabled - fetching Middesk-discovered officers"
				);

				const discoveredOfficers = await this.fetchMiddeskDiscoveredOfficers();
				const convertedOfficers = convertDiscoveredOfficersToTruliooPersons(
					discoveredOfficers,
					businessData.country || "US"
				);
				middeskDiscoveredCount = convertedOfficers.length;
				persons.push(...convertedOfficers);
			}

			const deduplicatedPersons = deduplicatePersons(persons);

			logger.info(
				`Extracted ${deduplicatedPersons.length} unique persons from all sources ` +
				`(Trulioo: ${truliooPersons.length}, Applicant Flow: ${applicantFlowCount}, ` +
				`Middesk Discovered: ${middeskDiscoveredCount})`
			);

			return deduplicatedPersons;
		} catch (error: unknown) {
			logger.error(error, "Error extracting persons from business data:");
			return persons;
		}
	}

	/**
	 * Extract persons from Trulioo business verification response (directors/officers)
	 * This is the original extraction logic for non-US businesses
	 */
	private extractPersonsFromTruliooResponse(
		businessData: TruliooBusinessData
	): TruliooUBOPersonData[] {
		const persons: TruliooUBOPersonData[] = [];

		// Trulioo business verification may return UBO/Director information
		// This would depend on the specific Trulioo flow configuration
		if (businessData.ubos && Array.isArray(businessData.ubos)) {
			for (const ubo of businessData.ubos) {
				// Validate required UBO data
				if (!ubo.firstName && !ubo.lastName && !ubo.fullName) {
					logger.warn(`UBO missing name information, skipping: ${JSON.stringify(ubo)}`);
					continue;
				}

				persons.push({
					fullName: ubo.fullName || `${ubo.firstName || ""} ${ubo.lastName || ""}`.trim(),
					firstName: ubo.firstName || "",
					lastName: ubo.lastName || "",
					dateOfBirth: ubo.dateOfBirth || "",
					addressLine1: ubo.address?.addressLine1 || businessData.address?.addressLine1 || "",
					addressLine2: ubo.address?.addressLine2 || businessData.address?.addressLine2 || "",
					city: ubo.address?.city || businessData.address?.city || "",
					state: ubo.address?.state || businessData.address?.state || "",
					postalCode: ubo.address?.postalCode || businessData.address?.postalCode || "",
					country: ubo.address?.country || businessData.address?.country || "",
					email: ubo.email,
					phone: ubo.phone,
					ownershipPercentage: ubo.ownershipPercentage,
					controlType: "UBO",
					title: ubo.title,
					nationality: ubo.nationality,
					passportNumber: ubo.passportNumber,
					nationalId: ubo.nationalId
				});
			}
		}

		if (businessData.directors && Array.isArray(businessData.directors)) {
			for (const director of businessData.directors) {
				// Validate required Director data
				if (!director.firstName && !director.lastName && !director.fullName) {
					logger.warn(`Director missing name information, skipping: ${JSON.stringify(director)}`);
					continue;
				}

				persons.push({
					fullName: director.fullName || `${director.firstName || ""} ${director.lastName || ""}`.trim(),
					firstName: director.firstName || "",
					lastName: director.lastName || "",
					dateOfBirth: director.dateOfBirth || "",
					addressLine1: director.address?.addressLine1 || businessData.address?.addressLine1 || "",
					addressLine2: director.address?.addressLine2 || businessData.address?.addressLine2 || "",
					city: director.address?.city || businessData.address?.city || "",
					state: director.address?.state || businessData.address?.state || "",
					postalCode: director.address?.postalCode || businessData.address?.postalCode || "",
					country: director.address?.country || businessData.address?.country || "",
					email: director.email,
					phone: director.phone,
					controlType: "DIRECTOR",
					title: director.title,
					nationality: director.nationality,
					passportNumber: director.passportNumber,
					nationalId: director.nationalId
				});
			}
		}

		return persons;
	}

	/**
	 * Check if business country is US
	 */
	private isUSBusiness(country: string | undefined): boolean {
		if (!country) {
			return false;
		}
		const normalized = country.toUpperCase().trim();
		return normalized === "US" || normalized === "USA";
	}

	/**
	 * Fetch officers discovered by Middesk from Secretary of State filings.
	 * Reads from integration_data.business_entity_people table, filtering by:
	 * - The Middesk BEV (platform_id = MIDDESK) for this business
	 * - submitted = false (only SoS-discovered officers, not applicant-submitted people)
	 *
	 * These officers have limited data (name + titles only, no DOB/address/email/phone),
	 * but including them in PSC screening closes the compliance gap where Middesk-discovered
	 * officers were previously not being screened.
	 */
	private async fetchMiddeskDiscoveredOfficers(): Promise<IBusinessEntityPerson[]> {
		try {
			const businessId = this.truliooBase.getBusinessId();
			const discoveredOfficers = await this.truliooUBORepository.fetchMiddeskDiscoveredOfficers(
				businessId as UUID
			);

			if (!discoveredOfficers || discoveredOfficers.length === 0) {
				logger.info("No Middesk-discovered officers found for business");
				return [];
			}

			logger.info(`Fetched ${discoveredOfficers.length} Middesk-discovered officers from business_entity_people`);
			return discoveredOfficers;
		} catch (error: unknown) {
			logger.warn(
				{ error, businessId: this.truliooBase.getBusinessId() },
				"Error fetching Middesk-discovered officers - continuing without them"
			);
			return [];
		}
	}

	/**
	 * Fetch owners from applicant flow (case service)
	 * Returns owners array or empty array on error
	 */
	private async fetchApplicantFlowOwners(): Promise<Array<import("#helpers/api").BusinessOwner> | null> {
		try {
			const businessId = this.truliooBase.getBusinessId();
			const owners = await this.applicantFlowOwnersClient.getOwnersUnencryptedByBusinessId(
				businessId as UUID
			);

			if (owners && Array.isArray(owners) && owners.length > 0) {
				logger.info(`Fetched ${owners.length} owners from applicant flow`);
				return owners;
			}

			return null;
		} catch (error: unknown) {
			logger.warn(
				{ error, businessId: this.truliooBase.getBusinessId() },
				"Error fetching owners from applicant flow - continuing without applicant flow owners"
			);
			return null;
		}
	}

	/**
	 * Screen individual person using Trulioo PSC flow
	 * Returns the screened person data (like Middesk does)
	 * @param personData - Person data to screen
	 * @param businessEntityVerificationId - Internal verification ID
	 * @param businessData - Trulioo business data
	 * @param taskId - Optional task ID from KYB verification to propagate to PSC records
	 */
	private async screenPersonWithPSCFlow(
		personData: TruliooUBOPersonData,
		businessEntityVerificationId: string,
		businessData: TruliooBusinessData,
		taskId?: string
	): Promise<TruliooScreenedPersonData> {
		try {
			logger.info(`Screening person: ${personData.fullName}`);

			// Create TruliooPerson instance for PSC screening
			const truliooPerson = TruliooFactory.createPerson(this.truliooBase.getBusinessId());

			// Create business context data for PSC flow from businessData parameter
			const country = businessData.country;
			if (!country) {
				throw new Error(
					`Missing country information for business entity verification ID: ${businessEntityVerificationId}`
				);
			}

			const businessContext: TruliooPSCFormData = {
				companyName: businessData.name || "Unknown Company",
				companyCountryIncorporation: country,
				companyStateAddress: businessData.state || "",
				companyCity: businessData.city || "",
				companyZip: businessData.postalCode || ""
			};

			// Create person verification inquiry with business entity verification ID and taskId
			const inquiryResult = await truliooPerson.createPersonInquiry(
				personData,
				businessContext,
				businessEntityVerificationId,
				taskId
			);

			logger.info(`Person screening initiated for ${personData.fullName}: ${inquiryResult.data?.inquiry_id}`);

			// Store person record in business_entity_people table
			await this.storePersonScreeningRecord(personData, businessEntityVerificationId, inquiryResult);

			// Return the screened person data (like Middesk does)
			return {
				...personData,
				// Add screening results to the person data
				screeningStatus: "completed",
				screeningResults: inquiryResult
			};
		} catch (error: unknown) {
			logger.error(error, `Error screening person ${personData.fullName}:`);

			// Convert to controlled error following Middesk pattern
			if (error instanceof VerificationApiError) {
				throw error; // Already controlled
			}
			throw new VerificationApiError(
				`Failed to screen person ${personData.fullName}: ${error instanceof Error ? error.message : "Unknown error"}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}

	/**
	 * Store person screening record in business_entity_people table
	 */
	private async storePersonScreeningRecord(
		personData: TruliooUBOPersonData,
		businessEntityVerificationId: string,
		inquiryResult: TruliooPersonInquiryResult
	): Promise<void> {
		try {
			// Normalize source field to array format to match Middesk structure
			// Use inquiry_id as id when available, with fallback for cases where inquiry_id is not provided
			const inquiryId = inquiryResult.data?.inquiry_id;
			const sourceObject: {
				type: string;
				provider: string;
				id: string;
				controlType?: string;
				inquiryId?: string;
			} = {
				type: "trulioo_psc",
				provider: "trulioo",
				id: inquiryId || `${businessEntityVerificationId}-${personData.fullName}`,
				controlType: personData.controlType
			};
			// Only include inquiryId if it's available to avoid redundancy with id field
			if (inquiryId) {
				sourceObject.inquiryId = inquiryId;
			}

			const personRecord = {
				business_entity_verification_id: businessEntityVerificationId as UUID,
				name: personData.fullName,
				submitted: true,
				source: JSON.stringify([sourceObject]),
				titles: personData.title ? [personData.title] : [],
				metadata: JSON.stringify({
					personData,
					inquiryResult,
					controlType: personData.controlType,
					ownershipPercentage: personData.ownershipPercentage,
					email: personData.email,
					phone: personData.phone,
					nationality: personData.nationality,
					screenedAt: new Date().toISOString()
				})
			};

			// Insert or update the person record
			await db<IBusinessEntityPerson>("integration_data.business_entity_people")
				.insert(personRecord)
				.onConflict(["business_entity_verification_id", "name"])
				.merge();

			logger.info(`Person screening record stored for: ${personData.fullName}`);
		} catch (error: unknown) {
			logger.error(error, `Error storing person screening record for ${personData.fullName}:`);

			// Convert to controlled error following Middesk pattern
			if (error instanceof VerificationApiError) {
				throw error; // Already controlled
			}
			throw new VerificationApiError(
				`Failed to store person screening record for ${personData.fullName}: ${error instanceof Error ? error.message : "Unknown error"}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}
}
