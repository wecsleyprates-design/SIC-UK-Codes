import { logger } from "#helpers";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

/**
 * Sanitize a Date or Date String to YYYY-MM-DD format or empty string if invalid
 * @param dateString 
 * @param formats 
 * @returns YYYY-MM-DD format or empty string if invalid
 */
export const sanitizeDate = (dateString: unknown, formats: string[] = ["YYYY-MM-DD", "MM/DD/YYYY", "MM-DD-YYYY"]) => {
	try {
		if (!dateString) {
			// returning an empty string because the sanitization of an empty string results in an empty string
			return "";
		}
		if (typeof dateString === "number") {
			dateString = new Date(dateString);
		}
		if (typeof dateString === "string") {
			const d = dayjs(dateString, formats, true);
			if (!d.isValid()) return "";
			dateString = d.toDate();
		}
		if (dateString instanceof Date) {
			const d = dayjs(dateString);
			if (!d.isValid()) return "";
			return d.format("YYYY-MM-DD"); // normalize
		}
		
	} catch (error: unknown) {
		logger.error( {error, dateString}, "Error sanitizing date");
	}
	return "";

};
