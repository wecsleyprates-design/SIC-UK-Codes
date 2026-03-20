import type { IntegrationPlatformId } from "#constants";
import type { FactName } from "#lib/facts/types";
import { ADAPTER_REGISTRY } from "../../adapters/getAdapter";

/**
 * Given a list of changed fact names, returns the platform IDs
 * of adapters that depend on those facts.
 */
export const getPlatformIdsByChangedFacts = (changedFacts: FactName[]): IntegrationPlatformId[] => {
	const affectedPlatforms: IntegrationPlatformId[] = [];

	for (const [platformId, adapter] of Object.entries(ADAPTER_REGISTRY)) {
		if (!adapter || !adapter.factNames) continue;

		/** Check if any of the changed facts are used by this adapter */
		const hasAffectedFact = changedFacts.some(fact => adapter.factNames!.includes(fact));

		if (hasAffectedFact) {
			affectedPlatforms.push(Number(platformId) as IntegrationPlatformId);
		}
	}

	return affectedPlatforms;
};
