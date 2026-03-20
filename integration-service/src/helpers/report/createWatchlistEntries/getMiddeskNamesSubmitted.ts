import { INTEGRATION_ID } from "#constants";
import { Fact } from "#lib/facts/types";

export const getMiddeskNamesSubmitted = (names_submitted: Partial<Fact<{ name: string }[]>> | undefined) => {
	if (!names_submitted) return [];
	if (Number(names_submitted["source.platformId"]) === INTEGRATION_ID.MIDDESK) return names_submitted.value ?? [];

	const alternative = names_submitted.alternatives?.find(alternative => Number(alternative.source) === INTEGRATION_ID.MIDDESK);

	return alternative?.value ?? [];
};
