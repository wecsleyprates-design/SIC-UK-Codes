/**
 * Helper functions for extracting directors/officers from Trulioo responses
 * Implements the business logic for determining which directors to include based on flow type
 */

import { logger } from "#helpers/logger";
import type { TruliooDirector, TruliooBusinessData } from "../common/types";
import { extractDirectorsOfficersFromTrulioo } from "../common/utils";

/**
 * Options for extracting directors
 */
export interface ExtractDirectorsOptions {
	/**
	 * Raw Trulioo clientData response
	 */
	clientData: any;
	/**
	 * Business data from Trulioo response (may contain explicit directors/ubos)
	 */
	businessData?: TruliooBusinessData;
	/**
	 * Business state/jurisdiction (used for extraction)
	 */
	businessState: string;
	/**
	 * Whether Advanced Watchlists is enabled (US businesses only)
	 */
	advancedWatchlistsEnabled: boolean;
	/**
	 * Optional function to parse fullAddress from officers
	 * Used in truliooBusinessResultsStorage where fullAddress parsing is needed
	 */
	parseFullAddress?: (fullAddress: string) => Record<string, any>;
}

/**
 * Extracts directors/officers from Trulioo response based on flow type
 *
 * Business Rules:
 * - Advanced Watchlists (US): Extract from StandardizedDirectorsOfficers (comprehensive extraction)
 * - Standard Flow (International): Use explicitly returned directors/ubos, fallback to StandardizedDirectorsOfficers
 *
 * "For the standard Trulioo watchlist flow, we only want to submit
 * the owners that Trulioo returns (directors/officers) and any owners added by the applicant"
 *
 * @param options - Extraction options
 * @returns Array of directors/officers or undefined if none found
 */
export async function extractDirectorsForPSCScreening(
	options: ExtractDirectorsOptions
): Promise<TruliooDirector[] | undefined> {
	const { clientData, businessData, businessState, advancedWatchlistsEnabled, parseFullAddress } = options;

	if (advancedWatchlistsEnabled) {
		// Advanced Watchlists: Extract from StandardizedDirectorsOfficers (comprehensive extraction)
		const extractedOfficers = extractDirectorsOfficersFromTrulioo(clientData, businessState);
		const directors: TruliooDirector[] = (extractedOfficers || []).map((officer: any) => {
			const director: TruliooDirector = {
				fullName: officer.name,
				title: officer.titles?.length > 0 ? officer.titles[0] : undefined
			};

			// Parse fullAddress if available and parser function provided
			if (officer.fullAddress && parseFullAddress) {
				Object.assign(director, parseFullAddress(officer.fullAddress));
			}

			return director;
		});

		logger.info(`Advanced Watchlists: Extracted ${directors.length} directors/officers from StandardizedDirectorsOfficers`);
		return directors.length > 0 ? directors : undefined;
	}

	// Standard flow: Use only explicitly returned directors from Trulioo (if any)
	let directors: TruliooDirector[] | undefined = businessData?.directors;

	// If no explicit directors, extract from StandardizedDirectorsOfficers as fallback
	if (!directors || directors.length === 0) {
		const extractedOfficers = extractDirectorsOfficersFromTrulioo(clientData, businessState);
		directors = (extractedOfficers || []).map((officer: any) => {
			const director: TruliooDirector = {
				fullName: officer.name,
				title: officer.titles?.length > 0 ? officer.titles[0] : undefined
			};

			// Parse fullAddress if available and parser function provided
			if (officer.fullAddress && parseFullAddress) {
				Object.assign(director, parseFullAddress(officer.fullAddress));
			}

			return director;
		});

		if (directors.length > 0) {
			logger.info(`Standard flow: Extracted ${directors.length} directors/officers from StandardizedDirectorsOfficers (Trulioo's returned data)`);
		} else {
			logger.info(`Standard flow: No directors/officers returned by Trulioo (neither explicit fields nor StandardizedDirectorsOfficers)`);
		}
	} else {
		logger.info(`Standard flow: Using ${directors.length} explicitly returned directors/officers from Trulioo`);
	}

	return directors && directors.length > 0 ? directors : undefined;
}
