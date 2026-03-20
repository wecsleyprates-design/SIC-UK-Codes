import { CASE_STATUS } from "#constants/case-status.constant";

export const getStringValue = (value: any, valueToGet: string): string => {
	if (!value || !valueToGet) {
		return "";
	}

	// If it's a string that looks like JSON, try to parse it
	if (typeof value === "string" && value.startsWith("{")) {
		try {
			const parsed = JSON.parse(value);
			// If it's an empty object or array, return empty string
			if (typeof parsed === "object" && Object.keys(parsed).length === 0) {
				return "";
			}
			// If it has content, you might want to stringify it back or handle differently
			if (parsed[valueToGet]) {
				return String(parsed[valueToGet]);
			}
			return "";
		} catch (_error) {
			// If parsing fails, treat as regular string
		}
	}

	return String(value);
};

export const getCaseStatusText = (code: number): string => {
	return Object.entries(CASE_STATUS).find(([, v]) => v === code)?.[0] ?? "UNKNOWN";
};
