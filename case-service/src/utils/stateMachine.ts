import type { UUID } from "crypto";
import type pino from "pino";
import { isDeepEqual, isObjectLike } from "./asserters";
import { encryptEin, decryptEin, safeEncrypt, safeDecrypt } from "./encryption";
import { logger } from "#helpers";
import type z from "zod";

export type StateTable<T extends Record<string, any>> = {
	__metadata?: StateMetadata;
} & T;

type StateMetadata = {
	id: UUID;
	sensitiveFields: string[];
	customerId?: UUID | string | null;
	updatedAt: Date | string;
};

type ValueResolver<T = unknown> = (value: unknown) => T;
type ValueComparator<T = unknown> = (previousValue: T | undefined, newValue: T | undefined) => boolean;

type ComparisonMeta = {
	method: "comparator" | "resolver" | "default";
	path: string;
};

type StateDiff<T extends Record<string, any>> = {
	[key in keyof StateTable<T>]?: {
		[field in keyof StateTable<T>[key] | "__self"]?: FlatStateDiffEntry;
	};
};

type FlatStateDiffEntry<T = unknown> = {
	path: string;
	isSensitive?: boolean;
	previousValue: T | null | undefined;
	newValue: T | null | undefined;
	comparison?: ComparisonMeta;
	schema?: z.ZodAny;
	details?: {
		addedElements?: T[];
		removedElements?: T[];
		changedElements?: T[];
	};
};

type FlatStateDiff = Record<string, FlatStateDiffEntry>;

type DiffOptions<T = unknown> = {
	resolvers?: Record<string, ValueResolver<T>>;
	comparators?: Record<string, ValueComparator<T>>;
};

export type InjectableArgs<R extends Record<string, any>> = {
	id: UUID;
	state: StateTable<R>;
	updatedAt: Date | string;
	customerId: UUID | null;
	resolvers?: Record<string, ValueResolver>;
	comparators?: Record<string, ValueComparator>;
} & Partial<{
	logger: pino.Logger;
	encryptor: (value: string) => string | null;
	decryptor: (value: string) => unknown | null;
}>;

export abstract class StateMachine<R extends Record<string, any>> {
	// Sensitive Fields should be added to this array and in tableName.fieldName format -- they'll be run through the encryptor before serialized.
	// When an array, it should be expressed as tableName[].fieldName
	protected static readonly sensitiveFields: string[] = [];

	protected readonly id: UUID;
	protected readonly state: StateTable<R>;
	protected readonly logger: InjectableArgs<R>["logger"];
	protected customerId: UUID | null;
	protected readonly updatedAt: Date | string;
	protected readonly encryptor: InjectableArgs<R>["encryptor"];
	protected readonly decryptor: InjectableArgs<R>["decryptor"];
	protected readonly resolvers: Record<string, ValueResolver>;
	protected readonly comparators: Record<string, ValueComparator>;

	constructor(args: InjectableArgs<R>) {
		this.id = args.id as UUID;
		// Always hold an immutable snapshot of the provided state (plain/decrypted)
		this.state = this.deepClone(args.state) as StateTable<R>;
		this.customerId = args.customerId ?? null;
		this.updatedAt = args.updatedAt ?? new Date();
		// Injectable dependencies
		this.encryptor = args.encryptor ?? ((value: string) => safeEncrypt(value, encryptEin, decryptEin));
		this.decryptor = args.decryptor ?? ((value: string) => safeDecrypt(value, decryptEin));
		this.logger = args.logger ?? logger;
		this.resolvers = args.resolvers ?? {};
		this.comparators = args.comparators ?? {};
	}
	public getId(): UUID {
		return this.id;
	}
	public getUpdatedAt(): Date | string {
		return this.updatedAt;
	}

	/**
	 * Creates a new StateMachine instance with the same configuration (logger, encryptor, decryptor,
	 * comparators/resolvers, metadata) but with a replaced internal state snapshot.
	 * Useful to avoid manually spreading constructor args when applying a new state version.
	 */
	public cloneWithState<T extends Record<string, any>>(state: StateTable<T>): StateMachine<T> {
		const ctor = this.constructor as new (args: InjectableArgs<T>) => StateMachine<T>;
		const now = new Date();
		return new ctor({
			id: this.id,
			state: this.deepClone(state),
			updatedAt: now,
			customerId: this.customerId,
			logger: this.logger,
			encryptor: this.encryptor,
			decryptor: this.decryptor,
			resolvers: this.resolvers,
			comparators: this.comparators
		});
	}

	public getState(mode: "protected" | "plain" = "protected"): StateTable<R> {
		const mutableState: Record<string, any> = { __metadata: this.getMetadata() };
		const clonedState = this.deepClone(this.state);

		for (const [tableName, tableValue] of Object.entries(clonedState)) {
			if (tableName === "__metadata") continue;
			if (this.isPlainObject(tableValue)) {
				const obj = tableValue as Record<string, unknown>;
				const clone: Record<string, unknown> = {};
				for (const key of Object.keys(obj)) {
					// Deep clone so callers can't mutate internal state (e.g., arrays of DBAs)
					clone[key] =
						mode === "protected"
							? this.protectByPatterns(`${tableName}.${key}`, obj[key]).value
							: this.normalizeSensitiveForComparison(`${tableName}.${key}`, obj[key]);
				}
				mutableState[tableName] = clone;
			} else {
				// Arrays and primitives handled under __self path
				// Deep clone so callers can't mutate internal state (e.g., business names array)
				mutableState[tableName] =
					mode === "protected"
						? this.protectByPatterns(`${tableName}.__self`, tableValue).value
						: this.normalizeSensitiveForComparison(`${tableName}.__self`, tableValue);
			}
		}
		return mutableState as StateTable<R>;
	}

	/* Get a copy of the State's metadata */
	public getMetadata(): StateMetadata {
		return {
			id: this.id,
			sensitiveFields: this.getSensitiveFields(),
			updatedAt: this.updatedAt,
			customerId: this.customerId ?? null
		};
	}

	public diff<R extends Record<string, any>>(
		newState: StateMachine<R>,
		options?: DiffOptions
	): StateDiff<StateTable<R>> {
		const resolvers = { ...(this.resolvers as any), ...(options?.resolvers ?? {}) };
		const comparators = { ...(this.comparators as any), ...(options?.comparators ?? {}) };
		const diff: StateDiff<StateTable<R>> = {};

		const currentPlain = this.getState("plain") as Record<string, unknown>;
		const otherPlain = newState.getState("plain") as Record<string, unknown>;
		const currentRaw = this.state as Record<string, unknown>;
		const otherRaw = newState.state as Record<string, unknown>;

		const currentKeys = Object.keys(currentPlain);
		const otherKeys = Object.keys(otherPlain);
		const tableKeys = new Set<string>([...currentKeys, ...otherKeys]);

		for (const tableName of tableKeys) {
			if (tableName === "__metadata") continue;

			const currentTable = (currentPlain as Record<string, any>)[tableName];
			const newTable = (otherPlain as Record<string, any>)[tableName];
			const currentRawTable = (currentRaw as Record<string, any>)[tableName];
			const newRawTable = (otherRaw as Record<string, any>)[tableName];

			const tableDiff = this.compareTable(
				tableName,
				currentTable,
				newTable,
				currentRawTable,
				newRawTable,
				resolvers,
				comparators
			);
			if (tableDiff && Object.keys(tableDiff).length > 0) {
				(diff as any)[tableName] = tableDiff as any;
			}
		}
		return diff;
	}

	private compareTable(
		tableName: string,
		currentTable: any,
		newTable: any,
		currentRawTable: any,
		newRawTable: any,
		resolvers: Record<string, ValueResolver>,
		comparators: Record<string, ValueComparator>
	): Record<string, FlatStateDiffEntry> | null {
		const tableDiff: Record<string, FlatStateDiffEntry> = {};

		if (this.isPlainObject(currentTable) || this.isPlainObject(newTable)) {
			const currentFields = this.isPlainObject(currentTable) ? Object.keys(currentTable) : [];
			const newFields = this.isPlainObject(newTable) ? Object.keys(newTable) : [];
			const fieldKeys = new Set<string>([...currentFields, ...newFields]);

			for (const field of fieldKeys) {
				const previousValue = this.isPlainObject(currentTable) ? currentTable[field] : undefined;
				const newValue = this.isPlainObject(newTable) ? newTable[field] : undefined;
				const previousRaw = this.isPlainObject(currentRawTable) ? currentRawTable[field] : undefined;
				const newRaw = this.isPlainObject(newRawTable) ? newRawTable[field] : undefined;

				const pathKey = `${tableName}.${field}`;
				const { equal: areEqual, method } = this.areValuesEqual(
					pathKey,
					previousValue,
					newValue,
					resolvers,
					comparators
				);

				if (!areEqual && this.shouldEmitDiff(pathKey, previousValue, newValue)) {
					const details = this.buildDetails(pathKey, previousValue, newValue);
					const protectedPrev = this.protectByPatterns(pathKey, previousRaw);
					const protectedNew = this.protectByPatterns(pathKey, newRaw);

					if (
						!protectedPrev.isSensitive &&
						!protectedNew.isSensitive &&
						isDeepEqual(protectedPrev.value, protectedNew.value)
					) {
						continue;
					}

					tableDiff[field] = {
						path: pathKey,
						isSensitive: protectedPrev.isSensitive || protectedNew.isSensitive,
						previousValue: protectedPrev.value,
						newValue: protectedNew.value,
						comparison: { method, path: pathKey },
						...(details ? { details } : {})
					} as FlatStateDiffEntry;
				}
			}
		} else {
			const pathKey = `${tableName}.__self`;
			const { equal: areEqual, method } = this.areValuesEqual(pathKey, currentTable, newTable, resolvers, comparators);

			if (!areEqual && this.shouldEmitDiff(pathKey, currentTable, newTable)) {
				const details = this.buildDetails(pathKey, currentTable, newTable);
				const protectedPrev = this.protectByPatterns(pathKey, currentRawTable);
				const protectedNew = this.protectByPatterns(pathKey, newRawTable);

				if (
					!protectedPrev.isSensitive &&
					!protectedNew.isSensitive &&
					isDeepEqual(protectedPrev.value, protectedNew.value)
				) {
					return tableDiff;
				}

				tableDiff["__self"] = {
					path: pathKey,
					isSensitive: protectedPrev.isSensitive || protectedNew.isSensitive,
					previousValue: protectedPrev.value,
					newValue: protectedNew.value,
					comparison: { method, path: pathKey },
					...(details ? { details } : {})
				};
			}
		}

		return Object.keys(tableDiff).length > 0 ? tableDiff : null;
	}

	public diffFlat<R extends Record<string, any>>(newState: StateMachine<R>, options?: DiffOptions): FlatStateDiff {
		const nested = this.diff(newState, options) as Record<string, Record<string, FlatStateDiffEntry> | undefined>;
		const flat: FlatStateDiff = {};
		for (const tableName of Object.keys(nested)) {
			const table = nested[tableName];
			if (!table) continue;
			for (const fieldName of Object.keys(table)) {
				const entry = table[fieldName];
				if (!entry) continue;
				const key = entry.path ?? `${tableName}.${fieldName}`;
				// Keep path authoritative; fall back to key if missing for safety
				flat[key] = { ...entry, path: entry.path ?? key };
			}
		}
		return flat;
	}

	private isPlainObject(value: unknown): value is Record<string, unknown> {
		// Use shared util and explicitly exclude arrays and non-plain objects like Date
		return isObjectLike(value) && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
	}
	private shouldEmitDiff(pathKey: string, prev: unknown, next: unknown): boolean {
		if (this.isSensitivePath(pathKey)) return true;

		const prevPlain = this.normalizeSensitiveForComparison(pathKey, prev);
		const newPlain = this.normalizeSensitiveForComparison(pathKey, next);
		return !isDeepEqual(this.normalizeValue(prevPlain), this.normalizeValue(newPlain));
	}

	private buildDetails(
		pathKey: string,
		previousValue: unknown,
		newValue: unknown
	):
		| {
				addedElements?: unknown[];
				removedElements?: unknown[];
				changedElements?: unknown[];
		  }
		| undefined {
		let details:
			| {
					addedElements?: unknown[];
					removedElements?: unknown[];
					changedElements?: unknown[];
			  }
			| undefined;
		if (Array.isArray(previousValue) && Array.isArray(newValue)) {
			details = this.buildArrayDetails(previousValue, newValue);
		} else if (this.isPlainObject(previousValue) && this.isPlainObject(newValue)) {
			details = this.buildObjectDetails(previousValue, newValue);
		}
		if (details) {
			details = this.protectDetails(pathKey, details);
		}
		return details;
	}
	// Defensive deep clone to keep internal state immutable and isolated from callers
	private deepClone<T>(value: T): T {
		if (value instanceof Date) return new Date(value.getTime()) as any;
		if (Array.isArray(value)) return value.map(v => this.deepClone(v)) as any;
		if (this.isPlainObject(value)) {
			const out: Record<string, unknown> = {};
			for (const key of Object.keys(value)) {
				out[key] = this.deepClone((value as Record<string, unknown>)[key]);
			}
			return out as T;
		}
		return value;
	}

	/** Starts with YYYY-MM-DD; used to normalize date strings to timestamp for diff comparison. */
	private static readonly DATE_STRING_PREFIX = /^\d{4}-\d{2}-\d{2}/;

	private normalizeValue(value: unknown): unknown {
		if (value instanceof Date) return value.getTime();
		if (typeof value === "string" && StateMachine.DATE_STRING_PREFIX.test(value.trim())) {
			const ts = Date.parse(value);
			if (Number.isFinite(ts)) return ts;
		}
		if (Array.isArray(value)) return value.map(v => this.normalizeValue(v));
		if (this.isPlainObject(value)) {
			const out: Record<string, unknown> = {};
			for (const key of Object.keys(value)) {
				out[key] = this.normalizeValue((value as Record<string, unknown>)[key]);
			}
			return out;
		}
		return value;
	}

	private arraysEqualIgnoringOrder(
		pathKey: string,
		a: unknown[],
		b: unknown[],
		resolvers: Record<string, ValueResolver>,
		comparators: Record<string, ValueComparator>
	): { equal: boolean; method: ComparisonMeta["method"] } {
		const comparator = comparators[pathKey];
		const resolver = resolvers[pathKey];
		if (typeof comparator === "function") {
			return { equal: comparator(a, b), method: "comparator" };
		}
		if (typeof resolver === "function") {
			return { equal: isDeepEqual(resolver(a), resolver(b)), method: "resolver" };
		}
		const aNorm = a.map(v => this.normalizeValue(v));
		const bNorm = b.map(v => this.normalizeValue(v));
		if (aNorm.length !== bNorm.length) return { equal: false, method: "default" };
		const remaining = [...bNorm];
		for (const item of aNorm) {
			const idx = remaining.findIndex(candidate => isDeepEqual(item, candidate));
			if (idx === -1) {
				return { equal: false, method: "default" };
			}
			remaining.splice(idx, 1);
		}
		return { equal: remaining.length === 0, method: "default" };
	}

	private areValuesEqual<T = unknown>(
		pathKey: string,
		previousValue: T,
		newValue: T,
		resolvers: Record<string, ValueResolver>,
		comparators: Record<string, ValueComparator>
	): { equal: boolean; method: ComparisonMeta["method"] } {
		// Decrypt sensitive values before any comparison logic
		const prevDecrypted = this.normalizeSensitiveForComparison(pathKey, previousValue);
		const newDecrypted = this.normalizeSensitiveForComparison(pathKey, newValue);

		const comparator = comparators[pathKey];
		const resolver = resolvers[pathKey];
		if (typeof comparator === "function") {
			return { equal: comparator(prevDecrypted, newDecrypted), method: "comparator" };
		}
		if (typeof resolver === "function") {
			return { equal: isDeepEqual(resolver(prevDecrypted), resolver(newDecrypted)), method: "resolver" };
		}
		if (Array.isArray(prevDecrypted) && Array.isArray(newDecrypted)) {
			return this.arraysEqualIgnoringOrder(pathKey, prevDecrypted, newDecrypted, resolvers, comparators);
		}
		const pv = this.normalizeValue(prevDecrypted);
		const nv = this.normalizeValue(newDecrypted);
		return { equal: isDeepEqual(pv, nv), method: "default" };
	}

	private buildArrayDetails(
		prev: unknown[],
		next: unknown[]
	): {
		addedElements?: unknown[];
		removedElements?: unknown[];
		changedElements?: unknown[];
	} {
		const removedElements: unknown[] = [];
		const addedElements: unknown[] = [];
		const prevNorm = prev.map(v => this.normalizeValue(v));
		const nextNorm = next.map(v => this.normalizeValue(v));
		const nextRemaining = [...nextNorm];
		for (const p of prevNorm) {
			const idx = nextRemaining.findIndex(n => isDeepEqual(p, n));
			if (idx === -1) {
				removedElements.push(p);
			} else {
				nextRemaining.splice(idx, 1);
			}
		}
		addedElements.push(...nextRemaining);
		return {
			addedElements: addedElements.length ? addedElements : undefined,
			removedElements: removedElements.length ? removedElements : undefined,
			changedElements: undefined
		};
	}

	private buildObjectDetails(
		prev: Record<string, unknown>,
		next: Record<string, unknown>
	): {
		addedElements?: unknown[];
		removedElements?: unknown[];
		changedElements?: unknown[];
	} {
		const prevNorm = this.normalizeValue(prev) as Record<string, unknown>;
		const nextNorm = this.normalizeValue(next) as Record<string, unknown>;
		const keys = new Set<string>([...Object.keys(prevNorm), ...Object.keys(nextNorm)]);
		const addedElements: unknown[] = [];
		const removedElements: unknown[] = [];
		const changedElements: unknown[] = [];
		for (const key of keys) {
			const inPrev = Object.prototype.hasOwnProperty.call(prevNorm, key);
			const inNext = Object.prototype.hasOwnProperty.call(nextNorm, key);
			if (inPrev && !inNext) {
				removedElements.push({ key, value: prevNorm[key] });
			} else if (!inPrev && inNext) {
				addedElements.push({ key, value: nextNorm[key] });
			} else {
				const pv = prevNorm[key];
				const nv = nextNorm[key];
				if (!isDeepEqual(pv, nv)) {
					changedElements.push({ key, previousValue: pv, newValue: nv });
				}
			}
		}
		return {
			addedElements: addedElements.length ? addedElements : undefined,
			removedElements: removedElements.length ? removedElements : undefined,
			changedElements: changedElements.length ? changedElements : undefined
		};
	}

	private protectDetails(
		pathKey: string,
		details: {
			addedElements?: unknown[];
			removedElements?: unknown[];
			changedElements?: unknown[];
		}
	): {
		addedElements?: unknown[];
		removedElements?: unknown[];
		changedElements?: unknown[];
	} {
		const protectedDetails: {
			addedElements?: unknown[];
			removedElements?: unknown[];
			changedElements?: unknown[];
		} = {};

		// Helper to protect an array element given that pathKey may be at __self (so pattern may start with [])
		const protectArrayElement = (element: unknown): unknown => {
			// Wrap in array to satisfy initial [] segment in patterns like table[].ssn
			const res = this.protectByPatterns(pathKey, [element]);
			const out = Array.isArray(res.value) ? res.value[0] : res.value;
			return out;
		};

		if (Array.isArray(details.addedElements)) {
			protectedDetails.addedElements = details.addedElements.map(el => {
				// If element has { key, value } shape (object detail), protect by sub-path
				if (this.isPlainObject(el) && "key" in (el as any) && "value" in (el as any)) {
					const key = (el as any).key as string;
					const subPath = `${pathKey}.${key}`;
					const protectedVal = this.protectByPatterns(subPath, (el as any).value).value;
					return { key, value: protectedVal };
				}
				// Otherwise, treat as array element detail
				return protectArrayElement(el);
			});
		}
		if (Array.isArray(details.removedElements)) {
			protectedDetails.removedElements = details.removedElements.map(el => {
				if (this.isPlainObject(el) && "key" in (el as any) && "value" in (el as any)) {
					const key = (el as any).key as string;
					const subPath = `${pathKey}.${key}`;
					const protectedVal = this.protectByPatterns(subPath, (el as any).value).value;
					return { key, value: protectedVal };
				}
				return protectArrayElement(el);
			});
		}
		if (Array.isArray(details.changedElements)) {
			const mapped = details.changedElements.map(el => {
				if (this.isPlainObject(el) && "key" in (el as any)) {
					const key = (el as any).key as string;
					const subPath = `${pathKey}.${key}`;
					const protectedPrev = this.protectByPatterns(subPath, (el as any).previousValue).value;
					const protectedNew = this.protectByPatterns(subPath, (el as any).newValue).value;
					return { key, previousValue: protectedPrev, newValue: protectedNew };
				}
				// For array element diffs (not currently produced), fall back to element-wise protection
				return protectArrayElement(el);
			});
			// Filter out entries where protected previous/new are equal (avoid false positives)
			protectedDetails.changedElements = mapped.filter(el => {
				if (this.isPlainObject(el) && "previousValue" in (el as any) && "newValue" in (el as any)) {
					return !isDeepEqual((el as any).previousValue, (el as any).newValue);
				}
				return true;
			});
			if (protectedDetails.changedElements.length === 0) {
				delete protectedDetails.changedElements;
			}
		}

		return protectedDetails;
	}

	private normalizeSensitiveForComparison(pathKey: string, value: unknown): unknown {
		const patterns = this.getSensitiveFields();
		let transformed: unknown = value;
		const pathTable = pathKey.split(".")[0];

		const apply = (val: unknown, segs: string[]): { value: unknown; touched: boolean } => {
			if (segs.length === 0) {
				if (val === null || val === undefined) return { value: val, touched: true };
				if (typeof val === "string") {
					try {
						const decrypted = this.decryptor ? this.decryptor(val) : val;
						// If decryptor fails silently (e.g., returns an empty string for plaintext),
						// fall back to the original value so comparisons still detect changes.
						const normalized =
							decrypted === null || decrypted === undefined || (typeof decrypted === "string" && decrypted.length === 0)
								? val
								: decrypted;
						return { value: normalized, touched: true };
					} catch {
						return { value: val, touched: true };
					}
				}
				return { value: val, touched: true };
			}
			const [head, ...rest] = segs;
			if (head === "[]") {
				if (!Array.isArray(val)) return { value: val, touched: false };
				const out = (val as unknown[]).map(item => apply(item, rest));
				return { value: out.map(o => o.value), touched: out.some(o => o.touched) };
			}
			if (this.isPlainObject(val)) {
				const obj = val as Record<string, unknown>;
				if (!(head in obj)) return { value: val, touched: false };
				const next = apply(obj[head], rest);
				if (!next.touched) return { value: val, touched: false };
				const clone: Record<string, unknown> = { ...obj, [head]: next.value };
				return { value: clone, touched: true };
			}
			return { value: val, touched: false };
		};

		for (const pattern of patterns) {
			const { table, segments, exact } = this.parseSensitivePattern(pattern);
			if (table !== pathTable) continue;

			// Compute relative segments based on current path; do not drop leading array step
			const currentSegments = pathKey
				.split(".")
				.slice(1)
				.map(s => (s === "__self" ? "[]" : s));
			let relSegments = segments;
			if (currentSegments.length > 0) {
				let sliceCount = 0;
				for (let i = 0; i < Math.min(currentSegments.length, segments.length); i++) {
					if (currentSegments[i] === "[]") break;
					if (segments[i] === currentSegments[i]) {
						sliceCount++;
					} else {
						sliceCount = -1;
						break;
					}
				}
				if (sliceCount === -1) continue;
				relSegments = segments.slice(sliceCount);
			}

			if (exact && pattern !== pathKey && relSegments.length === 0) continue;

			const res = apply(transformed, relSegments.length === 0 ? [] : relSegments);
			transformed = res.value;
		}

		return transformed;
	}

	private getSensitiveFields(): string[] {
		// Access static property on the constructor; allow subclasses to override
		const ctor = this.constructor as { sensitiveFields?: unknown };
		const raw = Array.isArray(ctor.sensitiveFields) ? ctor.sensitiveFields : [];
		return (raw as unknown[]).filter((item): item is string => typeof item === "string");
	}

	private isSensitivePath(pathKey: string): boolean {
		const sensitive = this.getSensitiveFields();
		return sensitive.includes(pathKey);
	}

	private parseSensitivePattern(pattern: string): { table: string; segments: string[]; exact: boolean } {
		const parts = pattern.split(".");
		const first = parts[0];
		// Only support "[]" wildcard suffix for arrays
		const hasArray = /\[\]$/.test(first);
		const table = first.replace(/\[\]$/, "");
		const segments = hasArray ? ["[]", ...parts.slice(1)] : parts.slice(1);
		const exact = !hasArray && parts.length <= 2;
		return { table, segments, exact };
	}

	private protectByPatterns(pathKey: string, value: unknown): { value: unknown; isSensitive: boolean } {
		const patterns = this.getSensitiveFields();
		let transformed: unknown = value;
		let touched = false;
		const pathTable = pathKey.split(".")[0];

		const apply = (val: unknown, segs: string[]): { value: unknown; touched: boolean } => {
			if (segs.length === 0) {
				if (val === null || val === undefined) return { value: val, touched: true };
				if (typeof val === "string") {
					try {
						const encrypted = this.encryptor ? this.encryptor(val) : val;
						if (encrypted && typeof encrypted === "string") {
							return { value: encrypted, touched: true };
						}
						// Fallback: mask when encryption not available
						return { value: val, touched: true };
					} catch {
						// Fallback: encryption could not be performed
						return { value: val, touched: false };
					}
				}
				return { value: val, touched: true };
			}
			const [head, ...rest] = segs;
			if (head === "[]") {
				if (!Array.isArray(val)) return { value: val, touched: false };
				const out = (val as unknown[]).map(item => apply(item, rest));
				return { value: out.map(o => o.value), touched: out.some(o => o.touched) };
			}
			if (this.isPlainObject(val)) {
				const obj = val as Record<string, unknown>;
				if (!(head in obj)) return { value: val, touched: false };
				const next = apply(obj[head], rest);
				if (!next.touched) return { value: val, touched: false };
				const clone: Record<string, unknown> = { ...obj, [head]: next.value };
				return { value: clone, touched: true };
			}
			return { value: val, touched: false };
		};

		for (const pattern of patterns) {
			const { table, segments, exact } = this.parseSensitivePattern(pattern);
			if (table !== pathTable) continue;

			const currentSegments = pathKey
				.split(".")
				.slice(1)
				.map(s => (s === "__self" ? "[]" : s));
			let relSegments = segments;
			if (currentSegments.length > 0) {
				let sliceCount = 0;
				for (let i = 0; i < Math.min(currentSegments.length, segments.length); i++) {
					if (currentSegments[i] === "[]") break;
					if (segments[i] === currentSegments[i]) {
						sliceCount++;
					} else {
						sliceCount = -1;
						break;
					}
				}
				if (sliceCount === -1) continue;
				relSegments = segments.slice(sliceCount);
			}

			if (exact && pattern !== pathKey && relSegments.length === 0) continue;

			const res = apply(transformed, relSegments.length === 0 ? [] : relSegments);
			transformed = res.value;
			touched = touched || res.touched;
		}

		return { value: transformed, isSensitive: touched || this.isSensitivePath(pathKey) };
	}
}
