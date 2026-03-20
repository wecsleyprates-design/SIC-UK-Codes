import type { IntegrationPlatformId } from "#constants";
import { INTEGRATION_ID } from "#constants";

/**
 * Converts IntegrationPlatformId to its string code representation.
 */
export const getPlatformCodeById = (platformId: IntegrationPlatformId): string | undefined => {
	const entry = Object.entries(INTEGRATION_ID).find(([_, id]) => id === platformId);
	return entry?.[0];
};
