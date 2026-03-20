/**
 * People Fact Helpers
 * 
 * Contains helper functions for extracting and transforming people data
 * from various sources (Middesk, Trulioo, OpenCorporates, etc.)
 */

import type { TruliooScreenedPersonData } from "#lib/trulioo/common/types";

export type PeopleFactEntry = {
	name: string;
	titles: string[];
	jurisdictions?: string[];
	submitted?: boolean;
	source?: string[];
};

/**
 * Extracts people from Trulioo Person Screening (PSC) source
 * Transforms TruliooScreenedPersonData to PeopleFactEntry format
 * 
 * @param truliooPersonResponse - The Trulioo person screening response
 * @returns Promise resolving to array of people entries or undefined if no people found
 */
export async function extractPeopleFromTruliooPerson(
	truliooPersonResponse: any
): Promise<PeopleFactEntry[] | undefined> {
	const screenedPeople = truliooPersonResponse?.screenedPersons || [];
	if (!Array.isArray(screenedPeople) || screenedPeople.length === 0) {
		return undefined;
	}

	const people: PeopleFactEntry[] = [];

	screenedPeople.forEach((person: TruliooScreenedPersonData) => {
		const personName = person.fullName || `${person.firstName || ""} ${person.lastName || ""}`.trim();
		if (!personName) return;

		const titles: string[] = [];
		if (person.title) {
			titles.push(person.title);
		}
		if (person.controlType) {
			titles.push(person.controlType);
		}
		// Default title if none provided
		if (titles.length === 0) {
			titles.push("Owner/Controller");
		}

		people.push({
			name: personName,
			titles,
			jurisdictions: undefined // PSC doesn't provide jurisdiction info
		});
	});

	return people.length > 0 ? people : undefined;
}
