import { INTEGRATION_ID } from "#constants";
import { Fact } from "#lib/facts/types";

export const getMiddeskPeopleNames = (people: Partial<Fact<{ name: string }[]>> | undefined) => {
	if (!people) return [];
	if (Number(people["source.platformId"]) === INTEGRATION_ID.MIDDESK) return people.value ?? [];

	const alternative = people.alternatives?.find(alternative => Number(alternative.source) === INTEGRATION_ID.MIDDESK);

	return alternative?.value ?? [];
};
