/**
 * Owner Converters for Trulioo Integration
 * 
 * Contains helper functions for converting owners from different sources
 * (Middesk, applicant flow, business_entity_people) to TruliooUBOPersonData format for PSC screening.
 * 
 * This module follows SRP by separating conversion logic from extraction logic,
 * and DRY by reusing conversion patterns across different owner sources.
 */

import type { BusinessOwner } from "#helpers/api";
import type { IBusinessEntityPerson } from "#types/db";
import type { TruliooUBOPersonData } from "./types";
import { logger } from "#helpers/logger";

/**
 * Convert BusinessOwner from Middesk/getBusinessDetails to TruliooUBOPersonData
 * @param owner - BusinessOwner from Middesk response
 * @returns TruliooUBOPersonData or null if invalid
 */
export function convertMiddeskOwnerToTruliooPerson(owner: BusinessOwner): TruliooUBOPersonData | null {
	try {
		// Validate required fields
		if (!owner.first_name && !owner.last_name) {
			logger.warn(`Middesk owner missing name information, skipping: ${JSON.stringify(owner)}`);
			return null;
		}

		const fullName = `${owner.first_name || ""} ${owner.last_name || ""}`.trim();
		if (!fullName) {
			logger.warn(`Middesk owner has empty name after trimming, skipping: ${JSON.stringify(owner)}`);
			return null;
		}

		// Convert to TruliooUBOPersonData format
		return {
			fullName,
			firstName: owner.first_name || "",
			lastName: owner.last_name || "",
			dateOfBirth: owner.date_of_birth || "",
			addressLine1: owner.address_line_1 || "",
			addressLine2: "", // Middesk owner doesn't have address_line_2 in BusinessOwner type
			city: owner.address_city || "",
			state: owner.address_state || "",
			postalCode: owner.address_postal_code || "",
			country: owner.address_country || "",
			email: owner.email || undefined,
			phone: owner.mobile || undefined,
			ownershipPercentage: owner.ownership_percentage || undefined,
			controlType: "UBO", // Middesk owners are typically UBOs
			title: owner.title?.title || undefined,
			// Middesk owners don't have nationality, passportNumber, or nationalId in BusinessOwner type
			nationality: undefined,
			passportNumber: undefined,
			nationalId: undefined
		};
	} catch (error) {
		logger.error(
			{ error, owner },
			`Error converting Middesk owner to Trulioo person: ${owner.first_name} ${owner.last_name}`
		);
		return null;
	}
}

/**
 * Convert owner from applicant flow (case service) to TruliooUBOPersonData
 * The owner structure from getOwners/getOwnersUnencrypted matches BusinessOwner type
 * @param owner - Owner from applicant flow (case service)
 * @returns TruliooUBOPersonData or null if invalid
 */
export function convertApplicantFlowOwnerToTruliooPerson(owner: BusinessOwner): TruliooUBOPersonData | null {
	// Reuse the same conversion logic as Middesk owners since they share the same structure
	return convertMiddeskOwnerToTruliooPerson(owner);
}

/**
 * Convert array of BusinessOwners to TruliooUBOPersonData array, filtering out invalid entries
 * @param owners - Array of BusinessOwners
 * @param source - Source identifier for logging (e.g., "Middesk", "Applicant Flow")
 * @returns Array of valid TruliooUBOPersonData
 */
export function convertOwnersToTruliooPersons(
	owners: BusinessOwner[] | null | undefined,
	source: string
): TruliooUBOPersonData[] {
	if (!owners || !Array.isArray(owners) || owners.length === 0) {
		return [];
	}

	const convertedPersons: TruliooUBOPersonData[] = [];
	
	for (const owner of owners) {
		const converted = convertMiddeskOwnerToTruliooPerson(owner);
		if (converted) {
			convertedPersons.push(converted);
		}
	}

	if (convertedPersons.length > 0) {
		logger.info(`Converted ${convertedPersons.length} valid owners from ${source} to Trulioo person format`);
	}

	return convertedPersons;
}

/**
 * Convert a Middesk-discovered officer (from business_entity_people table) to TruliooUBOPersonData.
 * These officers are discovered by Middesk from Secretary of State filings and have limited data
 * (name + titles only, no DOB/address/email/phone).
 *
 * @param person - IBusinessEntityPerson record from the Middesk BEV
 * @param businessCountry - Country of the business (used as fallback for person country)
 * @returns TruliooUBOPersonData or null if name is missing
 */
export function convertBusinessEntityPersonToTruliooPerson(
	person: IBusinessEntityPerson,
	businessCountry: string
): TruliooUBOPersonData | null {
	try {
		const trimmedName = person.name?.trim();
		if (!trimmedName) {
			logger.warn("Middesk-discovered officer has empty name, skipping");
			return null;
		}

		const nameParts = trimmedName.split(/\s+/);
		const firstName = nameParts[0] || "";
		const lastName = nameParts.slice(1).join(" ") || "";

		return {
			fullName: trimmedName,
			firstName,
			lastName,
			dateOfBirth: "",
			addressLine1: "",
			addressLine2: "",
			city: "",
			state: "",
			postalCode: "",
			country: businessCountry || "",
			controlType: "DIRECTOR",
			title: person.titles?.[0] || undefined
		};
	} catch (error) {
		logger.error(
			{ error, personName: person.name },
			"Error converting Middesk-discovered officer to Trulioo person"
		);
		return null;
	}
}

/**
 * Convert array of IBusinessEntityPerson (Middesk-discovered officers) to TruliooUBOPersonData array.
 * @param officers - Array of IBusinessEntityPerson records (submitted = false from Middesk BEV)
 * @param businessCountry - Country of the business
 * @returns Array of valid TruliooUBOPersonData
 */
export function convertDiscoveredOfficersToTruliooPersons(
	officers: IBusinessEntityPerson[] | null | undefined,
	businessCountry: string
): TruliooUBOPersonData[] {
	if (!officers || officers.length === 0) {
		return [];
	}

	const converted: TruliooUBOPersonData[] = [];

	for (const officer of officers) {
		const person = convertBusinessEntityPersonToTruliooPerson(officer, businessCountry);
		if (person) {
			converted.push(person);
		}
	}

	if (converted.length > 0) {
		logger.info(`Converted ${converted.length} Middesk-discovered officers to Trulioo person format`);
	}

	return converted;
}

/**
 * Deduplicate persons by fullName to avoid screening the same person multiple times
 * Keeps the first occurrence of each person
 * @param persons - Array of TruliooUBOPersonData
 * @returns Deduplicated array
 */
export function deduplicatePersons(persons: TruliooUBOPersonData[]): TruliooUBOPersonData[] {
	const seen = new Set<string>();
	const deduplicated: TruliooUBOPersonData[] = [];

	for (const person of persons) {
		const normalizedName = person.fullName.trim().toLowerCase();
		if (!seen.has(normalizedName)) {
			seen.add(normalizedName);
			deduplicated.push(person);
		} else {
			logger.debug(`Skipping duplicate person: ${person.fullName}`);
		}
	}

	if (deduplicated.length < persons.length) {
		logger.info(
			`Deduplicated ${persons.length} persons to ${deduplicated.length} unique persons`
		);
	}

	return deduplicated;
}
