import type { FactName } from "#lib/facts/types";
import { getPlatformCodeById } from "./getPlatformCodeById";
import { getPlatformIdsByChangedFacts } from "./getPlatformIdsByChangedFacts";

/**
 * Given a list of changed fact names, returns the platform codes (strings)
 * of adapters that depend on those facts.
 */
export const getPlatformCodesByChangedFacts = (changedFacts: FactName[]): string[] => {
	const platformIds = getPlatformIdsByChangedFacts(changedFacts);
	return platformIds.map(id => getPlatformCodeById(id)).filter((code): code is string => code !== undefined);
};
