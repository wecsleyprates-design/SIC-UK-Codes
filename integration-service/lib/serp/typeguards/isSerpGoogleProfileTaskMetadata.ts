/**
 * Type guard to check if metadata contains name and address data
 * in the format expected by SerpGoogleProfile.fetchGoogleProfile
 */
export const isSerpGoogleProfileTaskMetadata = (metadata: unknown): metadata is { name: string; address: string } => {
	if (!metadata || typeof metadata !== "object") return false;
	const obj = metadata as Record<string, unknown>;
	return !!obj.name && !!obj.address;
};
