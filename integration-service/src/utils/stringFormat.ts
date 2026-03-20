/**
 * Gets the short business name by removing common prefixes and suffixes.
 * @param {string} businessName - The full business name to shorten.
 * @returns {string} The shortened business name.
 */
export const getShortBusinessName = (businessName: string): string => {
	// List of common prefixes to remove (e.g., "The", "A", "An")
	const prefixes = /^(the|a|an)\s+/i;

	// List of common suffixes to remove (e.g., LLC, Inc.)
	const suffixes = /[\s,]*(llc|inc\.?|ltd|corp\.?|co\.?|plc|p\.?c\.?|s\.?a\.?|\(.*\))$/i;

	let shortName: string = "";

	// Step 1: Remove prefix if present
	try {
		shortName = businessName.replace(prefixes, "");
	} catch (error) {}

	// Step 2: Remove suffix if present
	try {
		shortName = shortName.replace(suffixes, "");
	} catch (error) {}

	// Step 3: Trim extra spaces
	return shortName.trim();
};

export const trimAndTitleCase = (str?: string | null) =>
	str
		?.trim()
		.toLowerCase()
		.replace(/\b\w/g, char => char.toUpperCase())
		.replace(/undefined/gi, "") || null;

export const checkHTMLTag = (str: string) => {
	const htmlStartRegex = /^<[^>]+>/;
	return htmlStartRegex.test(str.trim());
};

export const removeHTMLTags = (str: string) => str.replace(/<[^>]*>/g, "");

/**
 * Sanitize a string for logging, replacing newlines with underscores to prevent log injection.
 * @param {string} str - The string to sanitize.
 * @returns {string} The sanitized string.
 */
export const sanitizeForLog = (str: string): string => {
	return String(str).replace(/[\r\n]+/g, "_");
};
