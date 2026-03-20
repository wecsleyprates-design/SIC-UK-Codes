import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

/**
 * Convert a date string received from the UI (MM/DD/YYYY) to ISO format (YYYY-MM-DD).
 * Returns null when the input is empty or invalid.
 */
export const toISO = (mdy?: string | null): string | null => {
	if (!mdy || !mdy.trim()) return null;
	const parsed = dayjs(mdy, "MM/DD/YYYY", true);
	return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

/**
 * Convert an ISO date string (YYYY-MM-DD or full ISO timestamp) to display format (MM/DD/YYYY).
 * Returns null when the input is empty or invalid.
 */
export const toMDY = (iso?: string | null): string | null => {
	if (!iso || !iso.trim()) return null;
	// Accept variants like YYYY-MM-DD, full ISO timestamp, or DB timestamp with space.
	const datePart = iso.split(/[T ]/)[0]; // take portion before "T" or space
	const parsed = dayjs(datePart, "YYYY-MM-DD", true);
	return parsed.isValid() ? parsed.format("MM/DD/YYYY") : null;
};
