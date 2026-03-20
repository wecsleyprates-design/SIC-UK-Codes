import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

export const getDate = string => (([year, month, day]) => ({ day, month, year }))(string.split("-"));

export const getTime = string => (([hour, minutes]) => ({ hour, minutes }))(string.split(":"));

export function getPeriodDay(inputDate) {
	const today = new Date(inputDate);
	const month = today.getMonth();
	const day = daysInMonth(month + 1, today.getFullYear());
	return day;
}

function daysInMonth(month, year) {
	return new Date(year, month, 0).getDate();
}

export const getLastMonthFirstDate = () => {
	const currentDate = new Date();

	// Set the date to the 1st of the current month
	currentDate.setUTCDate(1);

	// Subtract one month
	currentDate.setUTCMonth(currentDate.getUTCMonth() - 1);

	// Ensure the time is set to the start of the day (midnight)
	currentDate.setUTCHours(0, 0, 0, 0);

	return currentDate;
};

export const getStartEndUTC = (year, month) => {
	// Create a Date object for the start date (first day of the month at 00:00:00 UTC)
	const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));

	// Create a Date object for the end date (last day of the month at 23:59:59 UTC)
	// Get the last day of the month
	const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

	return {
		startDate: startDate.toISOString(),
		endDate: endDate.toISOString()
	};
};

/**
 * Convert a date string (ISO, timestamp, or DB format) to canonical format (YYYY-MM-DD).
 * Returns null when the input is empty or invalid.
 *
 * @param input - The date string to convert. Accepts ISO, timestamp, or DB date formats.
 * @returns The date in YYYY-MM-DD format, or null if input is empty or invalid.
 */
export const toYMD = input => {
	if (input == null) return null; // handles null or undefined

	const str = `${input}`.trim(); // safely coerce to string and trim
	if (!str) return null; // handle empty or whitespace-only

	// Handle ISO, timestamp, or DB date strings
	const datePart = str.split(/[T ]/)[0];
	let parsed = dayjs(datePart, "YYYY-MM-DD", true);

	// Fallback for general valid date strings
	if (!parsed.isValid()) parsed = dayjs(str);

	return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

/**
 * Convert an ISO date string (YYYY-MM-DD or full ISO timestamp) to display format (MM/DD/YYYY).
 * Returns empty string when the input is empty or invalid.
 *
 * @param iso - The date string to convert. Accepts ISO, timestamp, or DB date formats.
 * @returns The date in MM/DD/YYYY format, or empty string if input is empty or invalid.
 */
export const toMDY = iso => {
	if (iso == null || !iso) return "";

	// Handle Date objects
	if (iso instanceof Date) {
		return dayjs(iso).isValid() ? dayjs(iso).format("MM/DD/YYYY") : "";
	}

	// Convert to string and handle variants like YYYY-MM-DD, full ISO timestamp, or DB timestamp with space.
	const dateStr = `${iso}`.trim();
	if (!dateStr) return "";

	const datePart = dateStr.split(/[T ]/)[0]; // take portion before "T" or space
	let parsed = dayjs(datePart, "YYYY-MM-DD", true);
	// Fallback for general valid date strings if strict parsing fails
	if (!parsed.isValid()) {
		parsed = dayjs(datePart);
	}
	return parsed.isValid() ? parsed.format("MM/DD/YYYY") : "";
};
