import { logger } from "#helpers/logger";
import { sources, type SourceName } from "./sources";
import { z } from "zod-v4";
import type { Fact, FactName, SimpleFact } from "./types";
import type { IntegrationPlatformId } from "#constants";

/**
 * Given a platform ID, extract all the facts that are associated with that platform
 * @param platformId
 * @param facts
 * @returns Facts
 */
export const extractFactsForPlatformId = (platformId: IntegrationPlatformId, facts: Fact[]): Fact[] => {
	const sourceNames = Object.keys(sources).filter(
		key => sources[key].platformId == platformId || sources[key].platformId === -1
	);
	if (!sourceNames || sourceNames.length === 0) {
		return [];
	}
	return extractFactsForSourceNames(sourceNames as SourceName[], facts);
};

/**
 * Given a source name, extract all the facts that are associated with that source
 * @param sourceNames
 * @param facts
 * @returns Facts
 */
export const extractFactsForSourceNames = (sourceNames: SourceName | SourceName[], facts: Fact[]): Fact[] => {
	if (!Array.isArray(sourceNames) && typeof sourceNames === "string") {
		sourceNames = [sourceNames];
	}
	const factsWithDirectSource = facts.filter(fact => sourceNames.includes(fact.source?.name as SourceName));
	const factNamesWithDirectSource = factsWithDirectSource.map(fact => fact.name);

	const allFactNames = getAllFactsThatDependOnFacts(factNamesWithDirectSource, facts);
	// Turn into a set to remove duplicates
	const allFactNamesSet = new Set(allFactNames);
	const filteredFacts = facts.filter(fact => allFactNamesSet.has(fact.name));

	logger.debug(
		`Facts that depend upon ${sourceNames}: ${filteredFacts.length} fact options for ${allFactNamesSet.size} fact names :: ${Array.from(allFactNamesSet)}`
	);
	return filteredFacts;
};

/**
 * Recursively get all fact names that depend on the given fact names
 * @param factNames
 * @param facts
 * @returns Fact names
 */
export const getAllFactsThatDependOnFacts = (factNames: string[], facts: Fact[]): string[] => {
	// Use a Set to track processed facts and avoid duplicates
	const processedFacts = new Set<string>(factNames);
	const result = [...factNames];

	let newDependentFacts: string[] = factNames;

	// Iterative approach instead of recursive to avoid call stack issues
	while (newDependentFacts.length > 0) {
		const factsWithDependencies = facts.filter(
			fact =>
				fact.dependencies?.some(dependency => newDependentFacts.includes(dependency)) && !processedFacts.has(fact.name)
		);

		newDependentFacts = [];

		for (const fact of factsWithDependencies) {
			if (!processedFacts.has(fact.name)) {
				processedFacts.add(fact.name);
				result.push(fact.name);
				newDependentFacts.push(fact.name);
			}
		}
	}

	return result;
};

export const safeParseInputAgainstSchema = (fact: Fact, input: unknown): boolean => {
	if (!fact.schema) {
		return true;
	}
	if (!(fact.schema instanceof z.ZodType)) {
		return false;
	}
	return fact.schema.safeParse(input).success;
};

/**
 * Throws if the input does not conform to the schema, otherwise returns void
 *
 * Expected to return (so not error) if there's no schema defined for the fact or if the input is null or undefined
 * so we can safely allow null or undefined values for fact overrides
 * @param fact
 * @param input
 * @returns void
 */
export const validateInputAgainstSchema = (fact: Fact, input: unknown) => {
	// It's always valid to null out the value of a fact override
	if (input === null || input === undefined) {
		return;
	}
	// Do not throw if there's no schema defined or it is not a Zod schema
	if (!(fact?.schema instanceof z.ZodType)) {
		return;
	}
	fact.schema.parse(input);
};

export function getFactKeys(facts: Fact[]): FactName[];
export function getFactKeys(facts: Pick<Fact, "name">[]): FactName[];
export function getFactKeys(simpleFact: SimpleFact): FactName[];
export function getFactKeys(factRecord: Partial<Record<FactName, any>>): FactName[];
export function getFactKeys(
	facts: Fact[] | Pick<Fact, "name">[] | SimpleFact | Partial<Record<FactName, any>>
): FactName[] {
	if (!facts) return [];
	else if (Array.isArray(facts)) return facts.map(fact => fact.name);
	else if (typeof facts === "object") return Object.keys(facts) as FactName[];
	return [];
}
