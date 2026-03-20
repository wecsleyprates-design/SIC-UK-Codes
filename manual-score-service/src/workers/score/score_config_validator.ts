import { z } from "zod";
import { type UUID } from "crypto";
import { type ValidationConfig, type MetaCondition } from "#types";

// Basic type definitions
const StatusEnum = z.enum(["SUCCESS", "FAILED"]);

const TaskSchema = z.object({
	task_code: z.string(),
	status: StatusEnum
});

abstract class _ConfigValidator {
	zSchema: z.ZodType;
	id: UUID;
	protected config: ValidationConfig;

	constructor(id: UUID, config: ValidationConfig) {
		this.id = id;
		this.config = config;
		this.zSchema = this.buildSchema(config);
	}

	private buildMetaSchema(condition?: MetaCondition): z.ZodTypeAny {
		if (!condition) return z.object({}).optional();

		// 1. Collect field schemas from all nested conditions
		const fieldMap: Record<string, z.ZodTypeAny> = {};

		function isFieldCondition(cond: MetaCondition): cond is {
			type: string;
			name: string;
			valueType: string;
			operator: string;
			value: string | number | boolean;
			required?: boolean;
		} {
			return (cond as any).valueType !== undefined && (cond as any).name !== undefined;
		}

		function collectFields(cond: MetaCondition) {
			if (isFieldCondition(cond)) {
				let schema: z.ZodTypeAny;
				switch (cond.valueType) {
					case "number":
						schema = z.union([z.number(), z.null()]);
						break;
					case "string":
						schema = z.union([z.string(), z.null()]);
						break;
					case "boolean":
						schema = z.union([z.boolean(), z.null()]);
						break;
					default:
						schema = z.any();
						break;
				}
				// Make all optional to allow partial meta and handle logic in refine
				fieldMap[cond.name] = schema.optional();
			} else if ((cond.type === "and" || cond.type === "or") && "conditions" in cond) {
				for (const sub of cond.conditions) collectFields(sub);
			}
		}

		collectFields(condition);

		const baseSchema = z.object(fieldMap).passthrough();

		const withLogic = baseSchema.superRefine((data, ctx) => {
			function evalCondition(cond: MetaCondition): boolean {
				if ("operator" in cond && "name" in cond && "valueType" in cond && "value" in cond) {
					const val = data[cond.name];
					// If not required and missing, skip evaluating this condition (treat as true)
					switch (cond.operator) {
						case "equal":
							return val === cond.value;
						case "notEqual":
							return val ? val !== cond.value : false;
						case "greater":
							return val !== null && cond.value !== null ? val > cond.value : false;
						case "greaterOrEqual":
							return val !== null && cond.value !== null ? val >= cond.value : false;
						case "less":
							return val !== null && cond.value !== null ? val < cond.value : false;
						case "lessOrEqual":
							return val !== null && cond.value !== null ? val <= cond.value : false;
						case "isNotNull":
							return val !== null && val !== undefined;
						default:
							return false;
					}
				} else if (cond.type === "and" && "conditions" in cond) {
					return cond.conditions.every(evalCondition);
				} else if (cond.type === "or" && "conditions" in cond) {
					return cond.conditions.some(evalCondition);
				}
				return false;
			}

			function collectErrors(cond: MetaCondition) {
				if ("type" in cond && "name" in cond && "valueType" in cond && "operator" in cond && "value" in cond) {
					const failed = !evalCondition(cond);
					if (failed) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: [cond.name],
							message: `${cond.name} is required`
						});
					}
				} else if (cond.type === "and" && "conditions" in cond) {
					for (const c of cond.conditions) collectErrors(c);
				} else if (cond.type === "or" && "conditions" in cond) {
					const passing = cond.conditions.some(c => evalCondition(c));
					if (!passing) {
						for (const c of cond.conditions) collectErrors(c);
					}
				}
			}

			const passed = evalCondition(condition);
			if (!passed) {
				collectErrors(condition);
			}
		});

		return withLogic;
	}

	private buildSchema(config: ValidationConfig) {
		const categorySchemas: Record<string, z.ZodTypeAny> = {};

		for (const [category, entry] of Object.entries(config.categories ?? {})) {
			const platformSchemas: Record<string, z.ZodTypeAny> = {};

			for (const platform of entry.platforms) {
				const schema = z.array(TaskSchema);
				platformSchemas[platform.name] = platform.required ? schema : schema.optional();
			}

			let categorySchema: z.ZodTypeAny = z.object(platformSchemas).passthrough();

			if (entry.required && entry.minPlatforms && entry.minPlatforms > 0) {
				categorySchema = categorySchema.refine(
					val => {
						const presentCount = Object.values(val || {}).filter((platform: any) => Array.isArray(platform) && platform.length > 0).length;
						return presentCount >= (entry.minPlatforms ?? 0);
					},
					{
						message: `At least ${entry.minPlatforms} platform(s) must be present in category "${category}"`
					}
				);
			}

			categorySchemas[category] = entry.required ? categorySchema : categorySchema.optional();
		}

		const categorySchema = z.object(categorySchemas).passthrough();
		let metaSchema: z.ZodTypeAny = z.object({}).optional();

		if (config.metaCondition) {
			metaSchema = this.buildMetaSchema(config.metaCondition);
		}

		return z
			.object({
				category: categorySchema,
				meta: metaSchema,
				case_status: z
					.object({
						status: z.enum(["SUBMITTED", "INFORMATION_REQUESTED", "INFORMATION_UPDATED"])
					})
					.optional()
			})
			.strict();
	}

	validate(data: unknown) {
		try {
			const result = this.zSchema.safeParse(data);
			return {
				success: result.success,
				errors: result.success
					? []
					: result.error.errors.map(err => ({
							path: err.path.join("."),
							message: err.message
						}))
			};
		} catch (error) {
			return {
				success: false,
				errors: [{ path: "root", message: "Invalid data structure" }]
			};
		}
	}
}
export function isValidConfig(config: any): { success: boolean; errors: string[] } {
	const errors: string[] = [];

	// Validate categories
	if (typeof config.categories !== "object") {
		errors.push("categories must be an object");
	} else {
		for (const [catName, category] of Object.entries(config.categories ?? {})) {
			if (typeof category !== "object" || category === null || !Array.isArray((category as any).platforms)) {
				errors.push(`Category "${catName}" must have a platforms array`);
				continue;
			}

			(category as any).platforms.forEach((p: any, i: number) => {
				if (typeof p.name !== "string") {
					errors.push(`Platform at index ${i} in category "${catName}" must have a name`);
				}
			});
		}
	}

	// Validate meta conditions
	function validateMeta(meta: any, path: string = "metaCondition") {
		if (meta.type === "field") {
			if (!meta.name || !meta.operator || !meta.valueType) {
				errors.push(`${path} field must have name, operator, valueType`);
			}
		} else if (meta.type === "and" || meta.type === "or") {
			if (!Array.isArray(meta.conditions)) {
				errors.push(`${path} must have conditions array`);
			} else {
				meta.conditions.forEach((cond: any, i: number) => {
					validateMeta(cond, `${path}.conditions[${i}]`);
				});
			}
		} else {
			errors.push(`${path} has invalid type: ${meta.type}`);
		}
	}

	if (config.metaCondition) {
		validateMeta(config.metaCondition);
	}

	return {
		success: errors.length === 0,
		errors
	};
}

export class ConfigValidator extends _ConfigValidator {}
