/**
 * Convert equifax's age to date using the passed in date string
 * @param age - The age of the record (expressed in days or 999 when null/unknown)
 * @param dateString - MM/DD/YYYY format
 * @param extractMonth - YYYY/MM/DD format
 * @returns The date or null if the date is not available
 */
export const convertAgeToDate = (age: number, dateString: string, extractMonth?: string): Date | null => {
	// If age is 999 then the date is not available
	if (age === 999 || !(dateString || extractMonth)) {
		return null;
	}
	// Convert bmaExtractDate ( MM/DD/YYYY) or bmaExtractMonth (YYYY/MM/DD) to a date
	let month: string | undefined;
	let day: string | undefined;
	let year: string | undefined;
	try {
		if (dateString && typeof dateString === "string" && dateString.length === 10) {
			const dateParts = dateString.split("/");
			month = dateParts[0];
			day = dateParts[1];
			year = dateParts[2];
		} else if (extractMonth && typeof extractMonth === "string" && extractMonth.length === 10) {
			/// YYYY/MM/DD format
			const dateParts = extractMonth.split("/");
			month = dateParts[1];
			day = dateParts[2];
			year = dateParts[0];
		}
		if (!month || !day || !year || isNaN(Number(month)) || isNaN(Number(day)) || isNaN(Number(year))) {
			return null;
		}
		const date = new Date(Number(year), Number(month) - 1, Number(day));
		date.setDate(date.getDate() - age);
		return date;
	} catch (ex) {
		// couldn't parse the date, just return null;
		return null;
	}
};
