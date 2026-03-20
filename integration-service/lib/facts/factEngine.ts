import { logger, producer } from "#helpers/index";
import type { FactCategory, FactSource, Fact, Rule, FactName, FactKey, FactAlternative } from "./types";
import { get as _get, cloneDeep as _cloneDeep } from "lodash";
import { kafkaTopics } from "#constants";
import type { FactCompleteMessage } from "#messaging/kafka/consumers/handlers/types";
import { sources, type SourceName } from "./sources";
import { manualOverride } from "./rules";
import { z } from "zod-v4";

export const DEFAULT_FACT_WEIGHT = 1;

export class FactEngine {
	private readonly MANUAL_SOURCE_NAME = "manual";

	private matched: boolean = false;
	private store: Map<FactKey, Fact> = new Map<FactKey, Fact>();
	private factNames: Set<FactName> = new Set<FactName>();
	private sources: Map<string, FactSource> = new Map<string, FactSource>();
	private sourceResolutionErrors: Map<string, Error> = new Map<string, Error>();
	private scope: Map<FactSource["scope"], string> = new Map<FactSource["scope"], string>();
	private resolvedFacts: Map<FactName, Fact> = new Map<FactName, Fact>();
	private ruleOverrides: Map<FactName, Rule[]> = new Map<FactName, Rule[]>();
	private factSchemas: Map<FactName, { z: z.ZodType; json: z.core.JSONSchema.BaseSchema }> = new Map<
		FactName,
		{ z: z.ZodAny; json: z.core.JSONSchema.BaseSchema }
	>();

	constructor(
		facts?: readonly Fact[],
		scopes?: Partial<Record<FactSource["scope"], string | number>>,
		manualSource?: FactSource
	) {
		if (facts) {
			for (const fact of facts) {
				this.add(fact);
			}
		}
		if (!this.getManualSource()) {
			this.setManualSource(manualSource ?? sources.manual);
		}
		if (scopes && Object.keys(scopes).length > 0) {
			this.scope = new Map(Object.entries(scopes).map(([key, value]) => [key, _cloneDeep(value)])) as Map<
				FactSource["scope"],
				string
			>;
		}
	}

	/* Set a Scope for the Engine -- must be invoked before .run */
	public setScope(scope: FactSource["scope"], value: string) {
		this.scope.set(scope, value);
	}

	/**
	 * Get the value of a scope for the current engine
	 * @param scope - The scope to get the value for
	 * @returns The value of the scope or undefined if the scope is not set
	 */
	public getScopeValue(scope: FactSource["scope"]): string | undefined {
		return this.scope.get(scope);
	}

	/* The workhorse of the FactEngine -- match all facts to available sources */
	public match = async (): Promise<boolean> => {
		if (this.scope.size === 0) {
			throw new Error("Scope not set");
		}
		// Iterate through all Sources that have not been resolved
		for (const [sourceName, sourceReference] of [...this.sources.entries()].filter(
			([_, source]) => source.resolved === undefined
		)) {
			const source = _cloneDeep(sourceReference);
			// Check to see if the scopes provided to Engine match this source scope, if so we'll resolve it and store the response
			if (source.name === "normalize") {
				this.sources.set(sourceName, source);
			}
			if (this.scope.has(source.scope)) {
				const scopeValue = this.scope.get(source.scope);
				source.rawResponse = await source.getter(scopeValue, this).catch(err => {
					logger.error(err, `Could not resolve source ${source.name} with error ${err}`);
					this.sourceResolutionErrors.set(sourceName, err);
					return null;
				});

				source.resolved = new Date();
				this.sources.set(sourceName, source);
				await this.mapSourceToFacts(source);
			}
		}
		this.linkManualSourceToAllFacts();

		this.matched = true;
		return this.matched;
	};

	/**
	 * Get resolved fact values for everything in the Store
	 * @param rules - The rules to apply to the facts (note overrides will take precedence)
	 * @returns A Promise of an array of facts
	 */
	public async applyRules(rules: Rule | Rule[]): Promise<Array<Fact | undefined>> {
		// Ensure matches are computed once
		if (!this.matched) await this.match();

		// Unique fact names to process
		const factNames = new Set<FactName>(Array.from(this.store.values(), f => f.name));

		// Apply rules to each fact
		const results: Array<Fact | undefined> = await Promise.all(
			Array.from(factNames, name => this.applyRulesToFact(name, rules))
		);

		// Resolve any dependent facts that still need computation
		for (const fact of this.store.values()) {
			if (fact.value == null && fact.dependencies?.length && typeof fact.fn === "function") {
				logger.warn(`Force resolving dependent fact ${fact.name} dependencies ${fact.dependencies} `);
				const updated = await this.resolveDependentFact(fact, []);
				if (updated) results.push(updated);
			}
		}

		return results;
	}

	/**
	 * Get fact out of the store by name and source name
	 * 	Returns a clone to prevent mutation of the original fact
	 */
	public getFactDefinitionByNameAndSource(name: FactName, sourceName?: FactSource["name"]): Fact | undefined {
		const key = this.formatFactKey(name, sourceName);
		const fact = this.store.get(key);
		if (fact) {
			return _cloneDeep(fact);
		}
		return undefined;
	}

	/**
	 * After all values have been applied to the facts available to a source,
	 * this function runs the provided Rules against all the Candidates for a Fact
	 * to surface the singular fact record that is now the authoritative Fact
	 *
	 * When multiple rules are applied, the first rule that generates a valid value returns
	 * So make sure to order your rules as passed to this function as appropriate
	 * @param factName - The name of the fact to apply the rules to
	 * @param rules - The rules to apply to the fact
	 * @param context - The context to apply the rules to
	 * @returns The fact that was resolved or undefined if no rules were met
	 */
	public async applyRulesToFact(
		this: FactEngine,
		factName: FactName,
		rules: Rule | Rule[],
		context?: any
	): Promise<Fact | undefined> {
		if (!this.matched) {
			await this.match();
		}
		// First find the facts with the same name -- these are the "candidates" to be the Fact
		const allCandidatesWithSameName = Array.from(this.store.values()).filter(fact => fact.name === factName);
		// Find the fact candidates that have been resolved and have a valid value
		const validOptions = allCandidatesWithSameName.filter(
			fact => fact.resolved !== undefined && this.isValidFactValue(fact.value)
		);
		// Get facts that may have a dependency on this fact
		if (!validOptions || validOptions.length === 0) {
			// No valid options found so we have no way to resolve this fact :(
			return;
		}
		// A fact may have a rule override that will always be used to resolve it
		if (this.ruleOverrides.has(factName)) {
			rules = this.ruleOverrides.get(factName) ?? rules;
		}
		if (!Array.isArray(rules)) {
			rules = [rules];
		}
		// Force manualOverride to the first rule to be evaluated
		rules.unshift(manualOverride);
		let fact: Fact | undefined;
		// Iterate through all the rules and apply them to the fact
		//  We exit early if we execute a rule and it returns a valid value
		for (const rule of rules) {
			if (rule.fn) {
				fact = rule.fn(this, factName, validOptions, context);
			} else if (rule.condition === "eq") {
				fact = validOptions.find(fact => fact.value === rule.evaluator);
			} else if (rule.condition === "gte") {
				fact = validOptions.find(fact => fact.value >= rule.evaluator);
			} else if (rule.condition === "lte") {
				fact = validOptions.find(fact => fact.value <= rule.evaluator);
			} else if (rule.condition === "gt") {
				fact = validOptions.find(fact => fact.value > rule.evaluator);
			} else if (rule.condition === "lt") {
				fact = validOptions.find(fact => fact.value < rule.evaluator);
			} else if (rule.condition === "greatest" || rule.condition === "least") {
				fact = validOptions.reduce((acc, fact) => {
					if (!acc) {
						return fact;
					}
					if (rule.condition === "greatest" && fact.value > acc.value) {
						return fact;
					} else if (rule.condition === "least" && fact.value < acc.value) {
						return fact;
					}
					return acc;
				});
			}

			if (fact && (fact.override || this.isValidFactValue(fact.value))) {
				const updatedFact = this.setFactValue(fact, fact.value);
				if (updatedFact) {
					return this.resolveFact(updatedFact as Fact, rule);
				}
			}
		}
	}

	/**
	 * Force a factName to always use a specific rule or set of rules --
	 * this allows for less verbose code by running a Rule for a whole Run but overriding a smaller selection of Facts to use a different Rule
	 * @param factName - The name of the fact to override
	 * @param rules - The rules to use for the fact
	 */
	public addRuleOverride(factName: FactName | FactName[], rules: Rule | Rule[]): void {
		if (!Array.isArray(rules)) {
			rules = [rules];
		}
		if (!Array.isArray(factName)) {
			factName = [factName];
		}
		for (const name of factName) {
			this.ruleOverrides.set(name, rules);
		}
	}

	/**
	 * Delete all rule overrides for a fact
	 * @param factName - The name of the fact to delete the rule overrides for
	 */
	public deleteRuleOverride(factName: FactName): void {
		this.ruleOverrides.delete(factName);
	}
	/**
	 * Get resolved fact values for a specific category in the Store
	 * @param categories - The category or categories to get the facts for
	 * @param rules - The rules to apply to the facts
	 * @returns A Promise of an array of facts
	 */
	public getFactsByCategory(
		categories: FactCategory | FactCategory[],
		rules: Rule | Rule[]
	): Promise<Array<Fact | undefined>> {
		if (!Array.isArray(categories)) {
			categories = [categories];
		}
		const factNames = Array.from(this.store.values())
			.filter(
				fact =>
					(fact.source?.category && categories.includes(fact.source.category)) ||
					(fact.category && categories.includes(fact.category))
			)
			.map(fact => fact.name);
		const facts = Array.from(new Set(factNames)).map(name => ({ name }));
		return Promise.all(facts.map(fact => this.applyRulesToFact(fact.name, rules)));
	}

	/**
	 * Add a fact to the store
	 * @param providedFact - The fact to add
	 */
	public add(providedFact: Fact) {
		const DEFAULT_WEIGHT = 1;
		// Copy values as new variable to avoid mutating the original
		const fact = { ...providedFact, weight: providedFact.weight ?? DEFAULT_WEIGHT };
		const key = this.getKeyFromFact(fact);
		// Does fact already exist in store?
		if (!this.store.has(key)) {
			this.factNames.add(fact.name);
			// If so, update the fact
			this.store.set(key, fact);
			if (fact.source) {
				const source = this.sources.get(fact.source.name) ?? fact.source;
				if (!source.facts) {
					source.facts = [];
				}
				if (!source.facts.includes(fact.name)) {
					source.facts.push(fact.name);
				}
				this.sources.set(fact.source.name, source);
			}
			if (fact.schema && fact.schema instanceof z.ZodType) {
				const existingSchemaForFact = this.factSchemas.get(fact.name);
				if (existingSchemaForFact?.z instanceof z.ZodType) {
					if (!this.isSameSchema(fact.schema, existingSchemaForFact.z)) {
						throw new Error(
							`Fact ${fact.name} has been defined with conflicting schema definitions. Ensure all schemas for this fact are the same`
						);
					}
				}
				const JSONSchema = z.toJSONSchema(fact.schema);
				this.factSchemas.set(fact.name, { z: fact.schema, json: JSONSchema });
			}
		} else {
			throw new Error(`Fact ${key} already exists in store`);
		}
	}

	/**
	 * Get the number of sources that have resolved a fact
	 * @param factName - The name of the fact to get the number of sources for
	 * @param ignoreSources - An array of source names to ignore when calculating this value
	 * @returns The number of sources that have resolved the fact
	 * */
	public getNumberOfSourcesForFact(factName: FactName, ignoreSources?: Array<FactSource["name"]>): number {
		const facts = Array.from(this.store.values()).filter(
			fact =>
				fact.name === factName &&
				fact.source &&
				fact.source.name &&
				fact.source.resolved &&
				!ignoreSources?.includes(fact.source.name)
		);
		return facts?.length ?? 0;
	}

	public debugFact(factName: FactName): Fact[] {
		const facts = Array.from(this.store.values())
			.filter(fact => fact.name === factName)
			.map(fact => {
				logger.debug({ fact: fact }, "debugFact");
				return { ...fact };
			});
		return facts;
	}

	public getResolvedFact<T = any>(factName: FactName): Fact<T> | undefined {
		return this.resolvedFacts.get(factName) as Fact;
	}

	public getManualSource(): FactSource<Record<FactName, Fact["override"]>> {
		return this.sources.get(this.MANUAL_SOURCE_NAME) as FactSource;
	}
	public setManualSource(source: FactSource<Record<FactName, Fact["override"]>>) {
		this.sources.set(this.MANUAL_SOURCE_NAME, source);
	}

	public getSource<T = any>(sourceName: SourceName): FactSource<T> | undefined {
		return this.sources.get(sourceName);
	}

	public setSourceConfidence(sourceName: SourceName, confidence: number) {
		const source = this.getSource(sourceName);
		if (source) {
			source.confidence = confidence;
			this.sources.set(sourceName, source);
		}
	}

	public setSourceUpdatedAt(sourceName: SourceName, updatedAt: Date | undefined) {
		const source = this.getSource(sourceName);
		if (source) {
			source.updatedAt = updatedAt;
			this.sources.set(sourceName, source);
		}
	}

	/* Handle if a fact is dependent on another fact that has been resolved -- this allows this dependent fact to now be resolved */
	protected async resolveDependentFact(
		this: FactEngine,
		fact: Fact & { fn: (input: any, context: any) => Promise<Fact> },
		context: Fact[]
	): Promise<Fact> {
		const manualOverride = this.getManualSource()?.rawResponse?.[fact.name];
		const result =
			fact.path && this.isValidFactValue(fact.value)
				? _get(fact.value, fact.path)
				: await fact.fn(this, context).catch(err => {
						logger.error({ err, fact, context }, `Error resolving dependent fact ${fact.name} with error ${err}`);
						return undefined;
					});

		let updatedFact: Fact | undefined;
		if (this.isValidFactValue(result)) {
			const dependentFact: Fact = {
				...fact,
				source: { name: "dependent", platformId: -1 } as FactSource
			} as Fact;
			const storeKey = this.getKeyFromFact(dependentFact);
			if (!this.store.has(storeKey)) {
				this.store.set(storeKey, dependentFact);
			}
			updatedFact = this.setFactValue(dependentFact as Fact, result);
		}

		if (manualOverride) {
			// Prefer the manual value over the normally resolved value here so when we resolve the fact the manual value will be used
			updatedFact = this.setFactValue(fact, manualOverride.value);
			if (updatedFact) {
				updatedFact = this.setFactOverride(updatedFact, manualOverride);
			}
		}

		if (updatedFact) {
			return await this.resolveFact(updatedFact);
		}
		return fact;
	}

	/**
	 * Check if a value is a valid fact value
	 * 	Valid values are defined as anything that is not undefined, an empty string, an empty object, or an empty array
	 * 	Note that false, null and 0 are valid values so we can't do a simple truthy check
	 *
	 * This is used to determine if a value will allow a Fact to be evaluated in a Rule
	 * @param value - The value to check
	 * @returns true if the value is a valid fact value, false otherwise
	 */
	public isValidFactValue = (value: any): boolean => {
		if (value === undefined) {
			return false;
		}
		if (Array.isArray(value) && value.length === 0) {
			return false;
		}
		if (typeof value === "boolean") {
			return true;
		}
		if (typeof value === "object" && value !== null && (!value || Object.keys(value).length === 0)) {
			return false;
		}
		if (typeof value === "string" && value.trim() == "") {
			return false;
		}
		// null and 0 can be valid values
		return true;
	};

	/**
	 * Remove a Fact from the Store
	 * @param fact - The fact to remove
	 */
	public remove(fact: Fact | FactKey) {
		const key = typeof fact === "string" ? fact : this.getKeyFromFact(fact);
		if (this.store.has(key)) {
			const factToRemove = this.store.get(key);
			if (factToRemove?.source) {
				// Determine if this is the only fact from this source
				const numberOfTimesSourceReferenced = Object.values(this.store).filter(
					store => store.source === factToRemove?.source
				).length;
				if (numberOfTimesSourceReferenced === 1) {
					this.sources.delete(factToRemove.source.name);
				}
				this.store.delete(key);
			}
		} else {
			throw new Error("Fact does not exist in store");
		}
	}

	/***
	 * Get all resolved facts in the store
	 * @param fieldsToInclude - An array of fields to include in the results
	 * 	this is expecting lodash get syntax so you can get nested fields with "field1.field2"
	 * @param getAlternatives - Whether to get all resolved facts with values and place them as "alternatives"
	 *  the primary Fact determined by the rules will be the "value"
	 * @returns A Record of FactName to Partial<Fact> - the Partial<Fact> contains the fact's name, value, dependencies, alternatives, and isDefault
	 */
	public getAllResolvedFacts(fieldsToInclude: string[] = [], getAlternatives = false): Record<FactName, Partial<Fact>> {
		const engine = this;

		return [...(this.resolvedFacts.values() ?? [])]
			.sort((a, b) => {
				// sort by name
				return a?.name?.localeCompare(b?.name);
			})
			.reduce(
				(acc, fact) => {
					const newFact: Pick<
						Fact,
						"name" | "value" | "isDefault" | "dependencies" | "description" | "ruleApplied" | "schema" | "override"
					> & { source: Partial<FactSource> | null } = {
						name: fact.name,
						value: fact.value,
						schema: this.factSchemas.get(fact.name)?.json ?? null,
						source: null,
						override: fact.override ?? null
					};

					if (fact.source?.name) {
						const source = this.sources.get(fact.source.name);
						if (source?.name) {
							newFact.source = {
								confidence: source?.confidence,
								platformId: source?.platformId,
								updatedAt: source?.updatedAt
							};
						}
					}

					if (fact.isDefault !== undefined) {
						newFact.isDefault = fact.isDefault;
					}
					if (fact.dependencies !== undefined) {
						newFact.dependencies = fact.dependencies;
					}
					if (fact.description !== undefined) {
						newFact.description = fact.description;
					}
					for (const field of fieldsToInclude) {
						const fieldValue = _get(fact, field) ?? null;
						newFact[field] = fieldValue;
						if (field.includes(".")) {
							// turn into an object syntax
							const [key, value] = field.split(".");
							newFact[key] = { ...newFact[key], [value]: fieldValue };
						}
					}
					acc[fact.name] = newFact;
					if (getAlternatives) {
						// Pull out resolved facts with values and place them as "alternatives"
						acc[fact.name].alternatives = this.getAlternativesForFact<z.infer<typeof fact.schema>>(fact);
					}
					return acc;
				},
				{} as Record<
					FactName,
					Pick<Fact, "name" | "value" | "isDefault" | "dependencies" | "alternatives" | "description" | "schema">
				>
			);
	}

	/**
	 * Generate FactAlternativse for a fact
	 *  -- This is an array of the fact values+source that were not selected by the Rule
	 * @param fact - The fact to get the alternatives for
	 * @returns An array of FactAlternatives
	 */
	private getAlternativesForFact<T = any>(fact: Fact<T>): Array<FactAlternative<T>> {
		return (
			[...this.store.values()]
				// Filter out undefined and empty arrays
				.filter(f => f.name === fact.name && "value" in f && this.isValidFactValue(f.value))
				.filter(f => {
					// Remove items that are the same as the source
					return f.source?.name !== fact.source?.name;
				})
				.map(f => ({
					value: f.value,
					source: f.source?.platformId ?? -1,
					confidence: f.confidence ?? f.source?.confidence,
					updatedAt: f.source?.updatedAt
				}))
		);
	}

	/**
	 * Get the results of the FactEngine
	 * -- Applies normalization to the results
	 * @param fieldsToInclude - An array of fields to include in the results
	 * @param normalizeFacts - Whether to normalize the facts
	 * @returns A Record of FactName to Partial<Fact> - the Partial<Fact> contains the fact's name, value
	 */
	public async getResults(
		fieldsToInclude: string[] = [],
		normalizeFacts = true
	): Promise<Record<FactName, Partial<Fact>>> {
		const allFacts: Record<FactName, Partial<Fact>> = this.getAllFacts();
		const resolvedFacts: Record<FactName, Partial<Fact>> = this.getAllResolvedFacts(fieldsToInclude, true);
		// Spread the resolved facts over the object containing all facts
		const combined = { ...allFacts, ...resolvedFacts };

		if (normalizeFacts) {
			await this.normalizeFacts(combined);
		}
		// sort by key name
		const sorted = this.sortByKeys(combined);
		await this.sendFactCalculatedEvent(sorted);
		return sorted;
	}

	public dumpFacts = (): Fact[] => {
		return Array.from(this.store.values());
	};
	public dumpSources = (): FactSource[] => {
		return Array.from(this.sources.values());
	};

	private getKeyFromFact(fact: Pick<Fact, "name" | "source">): FactKey {
		return this.formatFactKey(fact.name, fact.source?.name);
	}
	private formatFactKey(factName: FactName, sourceName: FactSource["name"] | undefined): FactKey {
		return `${factName}::${sourceName ?? "NO_SOURCE"}`;
	}

	/**
	 * Resolve a fact and all its dependencies
	 * 	A resolved fact is one that has been surfaced by the rules to be the authoritative value for a Fact
	 * @param sourceFact - The fact to resolve
	 * @param rule - The rule that was applied to the fact
	 * @returns The resolved fact - a new instance of the fact with the resolved value
	 */
	protected resolveFact = async (sourceFact: Fact, rule?: Rule): Promise<Fact> => {
		// Make a copy of the fact to avoid mutation and possible weirdness
		const fact = _cloneDeep(sourceFact);
		if (!fact.ruleApplied) {
			fact.ruleApplied = fact?.value || fact?.override ? rule : null;
		}

		fact.value = fact?.value ?? fact.default ?? null;
		fact.resolved = new Date();
		this.resolvedFacts.set(fact.name, fact);
		// Check if we now have a dependency awaiting resolution and resolve it
		const dependencies = Array.from(this.store.values()).filter(
			f => !f.resolved && f.dependencies && f.dependencies.includes(fact.name)
		);
		// Check if all the dependencies are resolved
		if (dependencies.length > 0) {
			for (const dependency of dependencies) {
				if (dependency.dependencies?.every(d => this.resolvedFacts.has(d))) {
					// All facts dependencies are resolved so resolve the dependent fact
					if (dependency.fn && typeof dependency.fn === "function") {
						await this.resolveDependentFact(dependency as any, dependencies).catch(err => {
							logger.error(
								{ error: err, dependency },
								`Error resolving dependent fact ${dependency.name} with error ${err}`
							);
						});
					}
				}
			}
		}
		return fact;
	};

	/**
	 * When a source is resolved, apply it to possible facts that may be waiting for that to be resolved
	 * @param source - The source to apply to the facts
	 */
	protected async mapSourceToFacts(this: FactEngine, source: FactSource): Promise<void> {
		// Iterate through all the facts related to this source
		const rawResponse = source.rawResponse;
		if (!source.facts) {
			return;
		}
		if (source.name !== "calculated" && !this.isValidFactValue(rawResponse)) {
			return;
		}
		for (const factName of source.facts) {
			const factKey = this.getKeyFromFact({ name: factName, source });
			const fact = this.store.get(factKey);
			if (!fact) {
				// Fact not found in store so skip
				continue;
			}
			if (fact.resolved) {
				continue;
			}
			if (fact.dependencies) {
				if (!fact.dependencies.every(dependency => this.resolvedFacts.has(dependency))) {
					// Fact has unresolved dependencies so skip
					continue;
				}
			}
			// When path is set, use lodash get to get the value
			if (fact.path) {
				const value = _get(rawResponse, fact.path);
				if (this.isValidFactValue(value)) {
					this.setFactValue(fact, value);
				}
			} else if (fact.fn && typeof fact.fn === "function") {
				try {
					const value = await fact.fn(this, structuredClone(rawResponse));
					if (this.isValidFactValue(value)) {
						this.setFactValue(fact, value);
					}
				} catch (ex) {
					logger.error({ error: ex, fact_name: fact.name, source: source.name }, "Error resolving fact");
				}
			} else if (fact.name && Object.hasOwn(rawResponse, fact.name)) {
				if (this.isValidFactValue(rawResponse[fact.name])) {
					this.setFactValue(fact, rawResponse[fact.name]);
				}
			}
		}
	}

	/**
	 * Returns a new instance of a Fact with the updated value and resolution date
	 * This to prevent mutating the original Fact object
	 * @param fact - The fact to update
	 * @param value - The value to set
	 * @returns A new instance of the fact with the updated value and resolution date
	 */
	protected setFactValue = (fact: Fact | FactKey, value: any): Fact | undefined => {
		const key = typeof fact === "string" ? fact : this.getKeyFromFact(fact);
		if (!this.store.has(key)) {
			if (typeof fact === "string") {
				// passed in a fact key (not an actual fact) so cannot set the value
				return undefined;
			}
			this.store.set(key, fact);
		}
		const updatedFact = this.store.get(key);

		if (updatedFact) {
			const clonedFact = _cloneDeep(updatedFact);
			if (clonedFact?.source?.name) {
				clonedFact.source = this.sources.get(clonedFact.source.name) ?? clonedFact.source;
			}

			clonedFact.value = value;
			clonedFact.value = this.coerceValueToSchema(clonedFact, "value");
			clonedFact.resolved = new Date();
			this.store.set(key, clonedFact);
			return clonedFact;
		}
	};

	protected setFactOverride = (fact: Fact, override: Fact["override"]): Fact => {
		fact.override = override;
		return fact;
	};

	/**
	 * When a schema is defined for a fact, coerce the value to the schema type
	 * @param fact
	 * @param returnOnFailure - if we can't coerce the value to the schema, return the provided value or undefined
	 * @returns If a schema is defined then the coerced value otherwise the provided value or undefined
	 */
	private coerceValueToSchema(
		fact: Fact,
		returnOnFailure: "undefined" | "value" = "value"
	): z.infer<typeof fact.schema> | any | undefined {
		const schema = this.factSchemas.get(fact.name)?.z;
		if (!schema || !this.isValidFactValue(fact.value)) {
			return fact.value;
		}
		try {
			return this.addCoercion(schema).parse(fact.value);
		} catch (err) {
			logger.warn({ fact, schema, err }, "Could not coerce fact value to schema");
			if (returnOnFailure === "undefined") {
				return undefined;
			}
		}
		return fact.value;
	}
	private addCoercion<T extends z.ZodTypeAny>(schema: T): z.ZodTypeAny {
		// unwrap optional/nullable/default to reach the inner type
		const unwrap = (s: z.ZodTypeAny): z.ZodTypeAny => {
			if (s instanceof z.ZodOptional || s instanceof z.ZodNullable || s instanceof z.ZodDefault) {
				// @ts-expect-error zod v4: .unwrap() exists on these wrappers
				return unwrap(s.def.innerType ?? s.unwrap());
			}
			return s;
		};

		const core = unwrap(schema);

		if (core instanceof z.ZodString) return z.coerce.string().pipe(schema as any);
		if (core instanceof z.ZodNumber) return z.coerce.number().pipe(schema as any);
		if (core instanceof z.ZodBoolean) return z.coerce.boolean().pipe(schema as any);
		if (core instanceof z.ZodDate) return z.coerce.date().pipe(schema as any);

		// For other types (objects, arrays, unions), just use as-is
		return schema;
	}

	/**
	 * Send a fact calculated event to the Kafka topic
	 * @param facts - A Record of FactName to Partial<Fact>
	 */
	private async sendFactCalculatedEvent(facts: Record<FactName, Partial<Fact>>): Promise<void> {
		if (!facts) {
			facts = this.getAllResolvedFacts();
		}
		const messages: FactCompleteMessage[] = [];
		for (const [key, value] of this.scope.entries()) {
			messages.push({
				key: value,
				payload: { 
					scope: key,
					id: value,
					data: facts,
					calculated_at: new Date(),
					event: `${key}_facts_calculated`
				}
			});
		}
		await producer.send({
			topic: kafkaTopics.FACTS,
			messages: messages.map(message => ({ key: message.key, value: message.payload }))
		});
	}
	/**
	 * Get the displayable attributes of all Facts in the store
	 * @returns A Record of FactName to Partial<Fact> - the Partial<Fact> contains the fact's name, value, dependencies, alternatives, default, and isDefault
	 */
	private getAllFacts(): Record<FactName, Pick<Fact, "name" | "value" | "dependencies" | "alternatives">> {
		return [...this.store.values()].reduce(
			(acc, fact) => {
				const newFact: Partial<Fact> = {
					name: fact.name,
					value: null,
					schema: this.factSchemas.get(fact.name)?.json ?? null,
					source: null,
					override: fact.override ?? null,
					alternatives: []
				};

				if (fact.dependencies !== undefined) {
					newFact.dependencies = fact.dependencies;
				}
				if (this.isValidFactValue(fact.default)) {
					newFact.value = fact.default;
					newFact.isDefault = true;
				}
				acc[fact.name] = newFact as Pick<
					Fact,
					"name" | "value" | "dependencies" | "alternatives" | "default" | "isDefault" | "schema"
				>;
				return acc;
			},
			{} as Record<FactName, Pick<Fact, "name" | "value" | "dependencies" | "alternatives">>
		);
	}

	/***
		Normalize the value of a fact by mutating existing values in the store
		Define a "normalize" source and provide it with a function that will be applied to all the fact of the same name
		@param facts - A Record of FactName to Partial<Fact>
		@returns void - mutates the existing facts
	*/
	private async normalizeFacts(facts: Record<FactName, Partial<Fact>>): Promise<void> {
		const normalize = this.getSource("normalize")?.facts;
		if (normalize) {
			for (const factName of normalize) {
				const normalizeFact = this.store.get(`${factName}::normalize`);
				if (
					normalizeFact?.fn &&
					typeof normalizeFact.fn === "function" &&
					this.isValidFactValue(facts[factName].value)
				) {
					try {
						facts[factName].value = await normalizeFact.fn(this, facts[factName].value);
						facts[factName].isNormalized = true;
					} catch (ex) {
						logger.error({ error: ex, fact_name: factName }, "Error normalizing fact");
					}
				}
			}
		}
	}
	/**
	 * Sort an object by its keys
	 * @param objectToSort - The object to sort
	 * @returns A new object with the keys sorted
	 */
	private sortByKeys = (objectToSort: Record<FactName, Partial<Fact>>): Record<FactName, Partial<Fact>> =>
		Object.keys(objectToSort)
			.sort()
			.reduce(
				(newObject, key) => {
					newObject[key] = objectToSort[key];
					return newObject;
				},
				{} as Record<FactName, Partial<Fact>>
			);

	/**
	Explicitly link "manual" source to all facts in the store
	*/
	private linkManualSourceToAllFacts(): void {
		const manualSource = this.getManualSource();

		if (!manualSource?.rawResponse) {
			// Manual source has no raw response
			return;
		}
		const factNames = Array.from(this.factNames);
		for (const factName of factNames) {
			if (
				manualSource.rawResponse?.[factName] &&
				typeof manualSource.rawResponse[factName] === "object" &&
				manualSource.rawResponse[factName] !== null &&
				"value" in manualSource.rawResponse[factName]
			) {
				const manualFact: Fact = {
					name: factName,
					source: manualSource,
					override: manualSource.rawResponse[factName]
				} as Fact;
				this.setFactValue(manualFact, manualSource.rawResponse[factName].value);
			}
		}
	}

	/**
	 * Check if two Zod schemas are the same definition
	 */
	private isSameSchema(schema1: z.ZodType, schema2: z.ZodType): boolean {
		const JSONSchema1 = z.toJSONSchema(schema1);
		const JSONSchema2 = z.toJSONSchema(schema2);
		// Do stable stringify
		const stableStringify = (obj: any) => JSON.stringify(obj, Object.keys(obj).sort());
		return stableStringify(JSONSchema1) === stableStringify(JSONSchema2);
	}
}
