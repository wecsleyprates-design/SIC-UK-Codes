import type { IntegrationPlatformId } from "#constants";
import type { z } from "zod-v4";
import type { FactEngine } from "../factEngine";
import type { SourceName } from "../sources";
import type { FactName } from "./FactName";
import type { UUID } from "crypto";

export type FactKey = `${string}::${string}`;

export type FactAlternative<T = any> = {
	value: T;
	source: Partial<FactSource> | string | FactSource["platformId"];
	confidence?: number | null;
};

export type FactOverride<T = any> = {
	value: T | null;
	comment: string | null;
	userID: UUID;
	timestamp: Date;
	source: "manual";
};

export type Fact<T = any> = {
	name: FactName;
	confidence?: number;
	category?: FactCategory;
	path?: string;
	resolved?: Date;
	ruleApplied?: Rule | null;
	default?: T; //default value if path not found when being resolved
	isDefault?: boolean; //flag to indicate if the value is default
	value?: T;
	alternatives?: Array<FactAlternative<T>>;
	weight?: number;
	// Calculate this fact when all facts of the following names are resolved
	dependencies?: FactName[];
	description?: string | null;
	isNormalized?: boolean; //flag to indicate if the value has been normalized
	schema?: z.ZodType | z.core.JSONSchema.BaseSchema | null;
	override?: FactOverride<T> | null; //context/comment for the fact
} & (
	| {
			path: string;
			fn?: never;
			source: FactSource | null;
	  }
	| {
			fn: (this: Fact, engine: FactEngine, input: FactSource["rawResponse"], context?: any) => Promise<T>;
			path?: never;
			source: FactSource | null;
	  }
	| {
			dependencies: FactName[];
			source?: FactSource | null;
			path: string;
			fn?: never;
	  }
	| {
			dependencies: FactName[];
			source?: FactSource | null;
			fn: (this: Fact, engine: FactEngine, input: FactSource["rawResponse"], context?: any) => Promise<T>;
			path?: never;
	  }
);

export type FactSource<T = any> = {
	name: string | "calculated" | "normalize";
	description?: string;
	scope: "task" | "business" | "customer" | "user" | "platform" | "case" | "customerbusiness";
	getter: (input: any, engine?: FactEngine) => Promise<T>;
	category: FactCategory;
	rawResponse?: T;
	facts?: FactName[];
	platformId: IntegrationPlatformId | 0 | -1;
	taskId?: string;
	caseId?: string;
	businessId?: string;
	customerId?: string;
	resolved?: Date;
	confidence?: number;
	weight?: number;
	updatedAt?: Date;
};

export type Rule = {
	name: string;
	description: string;
	actions?: string[]; //future use
} & (
	| {
			fn: <T = any>(engine: FactEngine, factName: FactName, facts: Fact<T>[], context?: any) => Fact<T> | undefined;
			condition?: never;
	  }
	| {
			fn?: never;
			condition: "confidence" | "gte" | "lte" | "eq" | "gt" | "lt" | "all" | "any" | "greatest" | "least";
			evaluator: any;
	  }
);

export const factCategory = {
	kyb: "Know Your Business",
	kyc: "Know Your Customer",
	business: "Business",
	publicRecords: "Public Records",
	accounting: "Accounting",
	banking: "Banking",
	funding: "Funding"
} as const;
export type FactCategory = keyof typeof factCategory;

/*
 Allow a Fact to be represented shorthand as a string which will map to a lodash get path OR a function which will map to a fn that needs to resolve the actual fact body. If needing to use a dependency then use the complete Fact type
*/
type FactSimpleBody<T = any, I = any> =
	| Omit<Fact<T>, "name" | "source" | "override">
	| string
	| ((engine: FactEngine, input: I) => Promise<T>);

/*
 A simple fact is a fact that has been defined in a simple object with a field name as the root and then a list of sources and how that source can be resolved to a value
*/
export type SimpleFact<T = any> = {
	[fieldName: string]: {
		[K in SourceName | "calculated" | "normalize" | "description" | "schema"]?: FactSimpleBody<T>;
	};
};

/*
 Convert a simple fact to an array of facts
*/
export const simpleFactToFacts = <T = any>(
	simple: SimpleFact,
	allSources: Record<SourceName, FactSource>
): Fact<T>[] => {
	return Object.entries(simple).flatMap(([fieldName, sources]) => {
		const description = sources.description;
		const schema = sources.schema;
		delete sources.description;
		delete sources.schema;
		return Object.entries(sources).flatMap(([sourceName, factData]) => {
			if (!factData) return [];
			if (typeof factData === "string") {
				factData = { path: factData };
			} else if (typeof factData === "function") {
				factData = { fn: factData };
			}
			return [
				{
					...factData,
					description,
					schema,
					name: fieldName,
					...(sourceName !== "calculated" && { source: allSources[sourceName] })
				} as Fact<T>
			];
		});
	});
};

/*
 @deprecated Use SimpleFact instead if looking for a shorthand way to define a fact
*/
export type FactAbbreviated<T = any> = Record<FactName, Omit<Fact<T>, "name"> | Array<Omit<Fact<T>, "name">>>;
/* Return an immutable array of IFact from IFactAbbreviated 
@deprecated Use simpleFactToFacts instead
*/
export const factAbbreviatedToFact = <T = any>(abbreviated: Partial<FactAbbreviated<T>>): readonly Fact<T>[] => {
	return Object.freeze(
		Object.entries(abbreviated).reduce((acc, [factName, factRecords]) => {
			if (!Array.isArray(factRecords)) {
				factRecords = [factRecords];
			}
			for (const fact of factRecords) {
				acc.push({
					...fact,
					name: factName
				} as Fact<T>);
			}
			return acc;
		}, [] as Fact<T>[])
	);
};
