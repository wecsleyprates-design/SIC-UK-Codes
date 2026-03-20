export const normalizeBooleans = (obj: Record<string, any>, keys: string[]) => {
	for (const key of keys) {
		if (key in obj && typeof obj[key] === "string") {
			const val = (obj[key] as string).toLowerCase().trim();
			if (["true", "1", "on", "yes"].includes(val)) {
				obj[key] = true;
			} else if (["false", "0", "off", "no", ""].includes(val)) {
				obj[key] = false;
			}
		}
	}
};

/**
 * Normalizes phone number to 10 digits
 * Removes all non-numeric characters and ensures 10-digit format
 */
export const normalizePhoneNumber = (phoneNumber: string | null | undefined): string => {
	if (!phoneNumber) return ""; // Default fallback

	// Remove all non-numeric characters
	const digitsOnly = phoneNumber.replace(/\D/g, "");

	// If 11 digits and starts with 1, remove the 1
	if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
		return digitsOnly.slice(1);
	}

	// If 10 digits, return as is
	if (digitsOnly.length === 10) {
		return digitsOnly;
	}

	// If less than 10 digits, pad with 5s or return default
	if (digitsOnly.length < 10) {
		return ""; // Default fallback
	}

	// If more than 10 digits, take the last 10
	if (digitsOnly.length > 10) {
		return digitsOnly.slice(-10);
	}

	return ""; // Default fallback
};

/**
 * Removes all special characters and trims spaces
 */
export const removeSpecialCharacters = (str: string) => {
	return str
		.replace(/[^a-zA-Z0-9 ]/g, "")
		.replace(/\s+/g, " ")
		.trim();
};

/**
 * Normalize a string: lowercase and trim spaces.
 */
export const normalizeString = (str = "") => {
	return String(str).toLowerCase().trim();
};
