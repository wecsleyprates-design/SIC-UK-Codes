/**
 * Helper class for Trulioo Person Source data processing
 * Extracts and transforms person screening data from various sources
 */

import type { UUID } from "crypto";
import type { IRequestResponse } from "#types/db";
import { logger } from "#helpers/logger";
import { extractWatchlistResultsFromTruliooResponse, convertToUUIDFormat } from "#lib/trulioo/common/utils";

/**
 * Normalized watchlist hit structure
 */
export interface NormalizedWatchlistHit {
	listType: string;
	listName: string;
	sourceAgencyName?: string;
	listCountry?: string;
	url?: string;
	matchDetails?: string;
	confidence?: number;
}

/**
 * Person data from business_entity_people table
 */
interface PersonRow {
	name?: string;
	metadata?: string | Record<string, unknown>;
}

/**
 * Transformed person data for Fact Engine
 */
export interface TransformedPerson {
	fullName?: string;
	firstName?: string;
	lastName?: string;
	screeningResults: {
		watchlistHits: NormalizedWatchlistHit[];
		provider: string;
		screenedAt: string;
		[key: string]: any;
	};
	[key: string]: any;
}

/**
 * Result of loading screened persons from people table
 */
export interface LoadedScreenedPersons {
	screenedPersons: TransformedPerson[];
	confidence: number;
	updatedAt: Date;
}

/**
 * Helper class for Trulioo Person Source operations
 */
export class TruliooPersonSourceHelper {
	/**
	 * Loads screened persons from business_entity_people table when no records exist in request_response
	 * This ensures KYB Watchlists tab shows hits even when webhook updated people table but not request_response
	 */
	static async loadScreenedPersonsFromPeopleTable(businessID: UUID): Promise<LoadedScreenedPersons | null> {
		const { db: dbHelper } = await import("#helpers/knex");
		const peopleRows = await dbHelper("integration_data.business_entity_people")
			.select("integration_data.business_entity_people.name", "integration_data.business_entity_people.metadata")
			.join(
				"integration_data.business_entity_verification",
				"integration_data.business_entity_verification.id",
				"integration_data.business_entity_people.business_entity_verification_id"
			)
			.where("integration_data.business_entity_verification.business_id", businessID);

		const screenedFromPeople: TransformedPerson[] = [];
		const seenNames = new Set<string>();

		for (const row of peopleRows as PersonRow[]) {
			if (!row?.metadata) continue;

			const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
			const watchlistHits = this.extractWatchlistHitsFromMetadata(meta);

			const personName = row.name || "Unknown";
			if (seenNames.has(personName)) continue;
			seenNames.add(personName);

			screenedFromPeople.push({
				fullName: personName,
				screeningResults: {
					watchlistHits: watchlistHits || [],
					provider: "",
					screenedAt: (meta.screenedAt as string) || new Date().toISOString()
				}
			});
		}

		if (screenedFromPeople.length === 0) {
			return null;
		}

		return {
			screenedPersons: screenedFromPeople,
			confidence: 0.7,
			updatedAt: new Date()
		};
	}

	/**
	 * Extracts watchlist hits from metadata object
	 * Handles multiple formats: screeningResults.watchlistHits, watchlistResults, or sources array
	 */
	static extractWatchlistHitsFromMetadata(meta: Record<string, any>): NormalizedWatchlistHit[] {
		const fromSources = (meta.sources as any[])?.filter((s: any) => s.type === "watchlist_result") || [];
		const fromScreening = Array.isArray(meta.screeningResults?.watchlistHits)
			? meta.screeningResults.watchlistHits
			: Array.isArray(meta.watchlistResults)
				? meta.watchlistResults
				: [];

		if (fromScreening.length > 0) {
			return fromScreening;
		}

		// Transform sources array to normalized format
		return fromSources.map((s: any) => ({
			listType: s.listType || "SANCTIONS",
			listName: s.listName || s.metadata?.title || "",
			sourceAgencyName: s.sourceAgencyName || s.metadata?.agency,
			listCountry: s.listCountry || s.list_country,
			url: s.url,
			matchDetails: s.matchDetails || s.metadata?.entity_name,
			confidence: s.confidence ?? s.score
		}));
	}

	/**
	 * Extracts person name from business_entity_people table using external_id
	 * The external_id in request_response corresponds to the inquiryId in business_entity_people.source
	 */
	static async extractPersonNameFromPeopleTable(
		businessID: UUID,
		externalId: string
	): Promise<{ name?: string; firstName?: string; lastName?: string } | null> {
		try {
			const { db: dbHelper } = await import("#helpers/knex");
			const uuidFormattedExternalId = convertToUUIDFormat(externalId);

			const personRecord = await dbHelper("integration_data.business_entity_people")
				.select("integration_data.business_entity_people.name", "integration_data.business_entity_people.metadata")
				.join(
					"integration_data.business_entity_verification",
					"integration_data.business_entity_people.business_entity_verification_id",
					"integration_data.business_entity_verification.id"
				)
				.where("integration_data.business_entity_verification.business_id", businessID)
				// Use andWhere with callback to properly group OR conditions
				// This ensures: WHERE business_id = X AND (source LIKE Y OR source LIKE Z)
				// Without this, the OR would be at the top level, potentially returning records from other businesses
				.andWhere(function () {
					this.whereRaw("integration_data.business_entity_people.source::text LIKE ?", [`%${externalId}%`]).orWhereRaw(
						"integration_data.business_entity_people.source::text LIKE ?",
						[`%${uuidFormattedExternalId}%`]
					);
				})
				.first();

			if (!personRecord) {
				return null;
			}

			let firstName: string | undefined;
			let lastName: string | undefined;

			// Try to get firstName/lastName from metadata if available
			try {
				const metadata =
					typeof personRecord.metadata === "string" ? JSON.parse(personRecord.metadata) : personRecord.metadata;
				if (metadata?.personData) {
					firstName = metadata.personData.firstName;
					lastName = metadata.personData.lastName;
				}
			} catch (e) {
				// Ignore metadata parsing errors
			}

			return {
				name: personRecord.name,
				firstName,
				lastName
			};
		} catch (error) {
			logger.debug(
				{ error, externalId },
				`Could not fetch person name from business_entity_people for external_id ${externalId}`
			);
			return null;
		}
	}

	/**
	 * Extracts watchlist results from business_entity_people table as fallback
	 * Used when request_response has no watchlist data (e.g., webhook-updated PSC)
	 */
	static async extractWatchlistResultsFromPeopleTable(
		businessID: UUID,
		inquiryId: string
	): Promise<NormalizedWatchlistHit[] | null> {
		try {
			const { db: dbHelper } = await import("#helpers/knex");
			const uuidFormattedExternalId = convertToUUIDFormat(String(inquiryId));

			const personRows = await dbHelper("integration_data.business_entity_people")
				.select("integration_data.business_entity_people.metadata")
				.join(
					"integration_data.business_entity_verification",
					"integration_data.business_entity_verification.id",
					"integration_data.business_entity_people.business_entity_verification_id"
				)
				.where("integration_data.business_entity_verification.business_id", businessID)
				// Use andWhere with callback to properly group OR conditions
				// This ensures: WHERE business_id = X AND (source LIKE Y OR source LIKE Z)
				// Without this, the OR would be at the top level, potentially returning records from other businesses
				.andWhere(function () {
					this.whereRaw("integration_data.business_entity_people.source::text LIKE ?", [`%${inquiryId}%`]).orWhereRaw(
						"integration_data.business_entity_people.source::text LIKE ?",
						[`%${uuidFormattedExternalId}%`]
					);
				});

			for (const personRow of personRows as PersonRow[]) {
				if (!personRow?.metadata) continue;

				const meta = typeof personRow.metadata === "string" ? JSON.parse(personRow.metadata) : personRow.metadata;
				const watchlistHits = this.extractWatchlistHitsFromMetadata(meta);

				if (watchlistHits.length > 0) {
					logger.debug(
						`person source: Using watchlist from business_entity_people for business ${businessID}, inquiryId ${inquiryId}, count: ${watchlistHits.length}`
					);
					return watchlistHits;
				}
			}

			return null;
		} catch (err) {
			logger.debug(
				{ err, inquiryId },
				`person source: Fallback business_entity_people watchlist failed for ${inquiryId}`
			);
			return null;
		}
	}

	/**
	 * Normalizes watchlist results from various formats to standard format
	 */
	static normalizeWatchlistHits(watchlistResults: any[] | undefined | null): NormalizedWatchlistHit[] {
		if (!watchlistResults || !Array.isArray(watchlistResults)) {
			return [];
		}

		return watchlistResults.map((hit: any) => ({
			listType: hit.listType || "SANCTIONS",
			listName: hit.listName || "",
			sourceAgencyName: hit.sourceAgencyName,
			listCountry: hit.listCountry,
			url: hit.url,
			matchDetails: hit.matchDetails,
			confidence: hit.confidence
		}));
	}

	/**
	 * Transforms a person response to the format expected by Fact Engine
	 */
	static transformPersonResponse(
		response: any,
		personName?: string,
		personFirstName?: string,
		personLastName?: string,
		watchlistResults?: NormalizedWatchlistHit[]
	): TransformedPerson {
		return {
			...response,
			fullName: personName || response.fullName,
			firstName: personFirstName || response.firstName,
			lastName: personLastName || response.lastName,
			// Transform watchlistResults to screeningResults.watchlistHits format.
			// NOTE: We intentionally keep the original watchlistResults on the object for backward compatibility.
			// New consumers should prefer screeningResults.watchlistHits as the canonical location.
			screeningResults: {
				watchlistHits: watchlistResults || [],
				provider: "",
				screenedAt: response.screenedAt || new Date().toISOString(),
				// Preserve any existing screeningResults fields
				...(response.screeningResults || {})
			}
		};
	}

	/**
	 * Calculates confidence score based on person screening results
	 */
	static calculatePersonScreeningConfidence(screenedPersons: TransformedPerson[]): number {
		if (screenedPersons.length === 0) {
			return 0.3; // Lower confidence if no persons screened
		}

		let confidence = 0.6; // Base confidence for having screened persons

		// Increase confidence based on screening status
		const completedScreenings = screenedPersons.filter(
			(person: any) =>
				person.screeningStatus === "completed" || person.screeningResults?.screeningStatus === "completed"
		).length;

		if (completedScreenings > 0) {
			const completionRate = completedScreenings / screenedPersons.length;
			confidence += completionRate * 0.2; // Up to 0.2 additional confidence based on completion rate
		}

		// Increase confidence if we have screening results
		const hasResults = screenedPersons.some(
			(person: any) =>
				person.screeningResults?.watchlistHits !== undefined && Array.isArray(person.screeningResults.watchlistHits)
		);
		if (hasResults) {
			confidence += 0.1; // Additional confidence for having screening results
		}

		// Cap confidence at 0.95 (never 100% confident)
		if (confidence > 0.95) {
			confidence = 0.95;
		}

		return confidence;
	}

	/**
	 * Processes all PSC screening records and transforms them into screenedPersons format
	 */
	static async processPSCRecords(
		businessID: UUID,
		allRecords: IRequestResponse<any>[]
	): Promise<{ screenedPersons: TransformedPerson[]; mostRecentUpdatedAt?: Date }> {
		const allScreenedPersons: TransformedPerson[] = [];
		// Deduplication: track seen person names to avoid duplicates in UI
		// This is important when multiple request_response records exist for the same person
		const seenPersonNames = new Set<string>();
		let mostRecentUpdatedAt: Date | undefined;

		for (const record of allRecords) {
			try {
				const response = typeof record.response === "string" ? JSON.parse(record.response) : record.response;

				// Extract screenedPersons from this record
				if (response?.screenedPersons && Array.isArray(response.screenedPersons)) {
					// If already in screenedPersons format, deduplicate by name before adding
					for (const person of response.screenedPersons) {
						const name = person.fullName || `${person.firstName || ""} ${person.lastName || ""}`.trim();
						if (name && !seenPersonNames.has(name)) {
							seenPersonNames.add(name);
							allScreenedPersons.push(person);
						}
					}
				} else if (response) {
					// Extract watchlist results from the response
					let watchlistResults = response.watchlistResults;

					// If watchlistResults is not already extracted, try to extract it from the full response structure
					if (!watchlistResults || !Array.isArray(watchlistResults) || watchlistResults.length === 0) {
						const extracted = extractWatchlistResultsFromTruliooResponse(response);
						if (extracted && extracted.length > 0) {
							watchlistResults = extracted;
						}
					}

					// Try to get person name from business_entity_people if not in response
					let personName = response.fullName || response.personName || response.person_name;
					let personFirstName = response.firstName || response.personFirstName || response.person_first_name;
					let personLastName = response.lastName || response.personLastName || response.person_last_name;

					// If name is missing, try to find it in business_entity_people using the inquiryId
					if (!personName && record.external_id) {
						const personData = await this.extractPersonNameFromPeopleTable(businessID, record.external_id);
						if (personData) {
							personName = personData.name;
							personFirstName = personData.firstName || personFirstName;
							personLastName = personData.lastName || personLastName;
						}
					}

					// Construct fullName if we have firstName/lastName but not fullName
					if (!personName && (personFirstName || personLastName)) {
						personName = `${personFirstName || ""} ${personLastName || ""}`.trim();
					}

					// Fallback: when request_response has no watchlist data, use business_entity_people
					const inquiryId = record.external_id ?? record.request_id;
					if ((!watchlistResults || !Array.isArray(watchlistResults) || watchlistResults.length === 0) && inquiryId) {
						const fallbackWatchlistResults = await this.extractWatchlistResultsFromPeopleTable(businessID, inquiryId);
						if (fallbackWatchlistResults && fallbackWatchlistResults.length > 0) {
							watchlistResults = fallbackWatchlistResults;
						}
					}

					logger.debug(
						`person source: Transforming response for business ${businessID}, has watchlistResults: ${!!watchlistResults}, watchlistResults length: ${Array.isArray(watchlistResults) ? watchlistResults.length : "not array"}, personName: ${personName || "N/A"}`
					);

					// Normalize watchlist results
					const normalizedWatchlistHits = this.normalizeWatchlistHits(watchlistResults);

					// Transform person response
					const transformedPerson = this.transformPersonResponse(
						response,
						personName,
						personFirstName,
						personLastName,
						normalizedWatchlistHits
					);

				logger.debug(
					`person source: Transformed person has screeningResults.watchlistHits length: ${Array.isArray(transformedPerson.screeningResults?.watchlistHits) ? transformedPerson.screeningResults.watchlistHits.length : "not array"}`
				);

				// Deduplicate by person name - skip if already seen
				if (personName && seenPersonNames.has(personName)) {
					logger.debug(
						`person source: Skipping duplicate person "${personName}" for business ${businessID}`
					);
				} else {
					if (personName) {
						seenPersonNames.add(personName);
					}
					allScreenedPersons.push(transformedPerson);
				}
			}

				// Track the most recent updatedAt across all records
				const recordUpdatedAt = record.request_received ?? record.requested_at;
				if (recordUpdatedAt) {
					const recordDate = recordUpdatedAt instanceof Date ? recordUpdatedAt : new Date(recordUpdatedAt);
					if (!mostRecentUpdatedAt || recordDate > mostRecentUpdatedAt) {
						mostRecentUpdatedAt = recordDate;
					}
				}
			} catch (error) {
				logger.warn(
					{ error, record },
					`Error parsing response from request_response record for business ${businessID}`
				);
			}
		}

		return {
			screenedPersons: allScreenedPersons,
			mostRecentUpdatedAt
		};
	}
}
