import { hasValuesForKeys } from "../hasValuesForKeys";

type TestCase<T extends Record<string, unknown> = any> = [Partial<T>, (keyof T)[], boolean, string];

describe("hasValuesForKeys", () => {
	describe("basic functionality", () => {
		it.each<TestCase>([
			[
				{ name: "John", age: 30, active: true, score: 85.5 },
				["name", "age"],
				true,
				"object has truthy values for specified keys"
			],
			[
				{ name: "John", age: 30, active: true, score: 85.5 },
				["name", "active", "score"],
				true,
				"object has truthy values for all specified keys"
			]
		])("should return %s when %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});

		it.each<TestCase>([
			[{ name: "John", age: 0, active: false, email: "" }, ["name", "age"], false, "object has falsy value for age"],
			[
				{ name: "John", age: 0, active: false, email: "" },
				["name", "active"],
				false,
				"object has falsy value for active"
			],
			[{ name: "John", age: 0, active: false, email: "" }, ["name", "email"], false, "object has falsy value for email"]
		])("should return %s when %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});

		it.each<TestCase>([
			[{ name: "John", age: 30 }, ["name", "age", "email"], false, "object is missing email key"],
			[{ name: "John", age: 30 }, ["nonexistent" as any], false, "object is missing nonexistent key"]
		])("should return %s when %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});

		it("should return true when no keys are specified", () => {
			// Arrange
			const obj = { name: "John" };

			// Act & Assert
			expect(hasValuesForKeys(obj)).toBe(true);
		});
	});

	describe("edge cases with falsy values", () => {
		it.each<TestCase>([
			[{ name: "John", value: null }, ["name", "value"], false, "null values"],
			[{ name: "John", value: undefined }, ["name", "value"], false, "undefined values"],
			[{ name: "John", email: "" }, ["name", "email"], false, "empty strings"],
			[{ name: "John", count: 0 }, ["name", "count"], false, "zero values"],
			[{ name: "John", active: false }, ["name", "active"], false, "false boolean values"],
			[{ name: "John", score: NaN }, ["name", "score"], false, "NaN values"]
		])("should return false for %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});
	});

	describe("edge cases with truthy values", () => {
		it.each<TestCase>([
			[{ name: "John", items: [1, 2, 3], tags: [] }, ["name", "items"], true, "non-empty arrays"],
			[{ name: "John", items: [1, 2, 3], tags: [] }, ["name", "tags"], true, "empty arrays (still truthy)"]
		])("should return %s for %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});

		it.each<TestCase>([
			[{ name: "John", config: { setting: true }, empty: {} }, ["name", "config"], true, "non-empty objects"],
			[{ name: "John", config: { setting: true }, empty: {} }, ["name", "empty"], true, "empty objects (still truthy)"]
		])("should return %s for %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});

		it.each<TestCase>([
			[{ name: "John", age: 30, score: 0.1 }, ["name", "age", "score"], true, "positive numbers"],
			[{ name: "John", balance: -50 }, ["name", "balance"], true, "negative numbers"]
		])("should return %s for %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});
	});

	describe("null and non-object inputs", () => {
		it("should return false for null", () => {
			// Arrange
			const obj = null;

			// Act & Assert
			expect(hasValuesForKeys(obj as any, "name")).toBe(false);
		});

		it.each([
			["string", "length", "string value"],
			[123, "toString", "number value"],
			[true, "valueOf", "boolean value"],
			[undefined as any, "name", "undefined value"]
		])("should return false for %s", (value, key, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(value, key)).toBe(false);
		});
	});

	describe("type guarding", () => {
		it("should properly narrow type when used as type guard", () => {
			// Arrange
			const obj: Partial<{ name: string; age: number }> = { name: "John", age: 30 };

			// Act & Assert
			if (hasValuesForKeys(obj, "name", "age")) {
				// TypeScript should now know obj has name and age properties with values
				expect(typeof obj.name).toBe("string");
				expect(typeof obj.age).toBe("number");
			}
		});

		it.each([
			[{ name: "John", age: undefined }, ["name"], true, "object with truthy name"],
			[{ name: "John", age: undefined }, ["name", "age"], false, "object with falsy age"],
			[{ name: "John", age: undefined }, ["email" as any], false, "object missing email key"]
		])("should return %s for partial object when %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});
	});

	describe("complex scenarios", () => {
		it("should handle nested object properties", () => {
			// Arrange
			const obj = {
				user: { name: "John", details: { age: 30 } },
				settings: { theme: "dark" }
			};

			// Act & Assert
			expect(hasValuesForKeys(obj, "user", "settings")).toBe(true);
		});

		it.each([
			[
				{
					string: "hello",
					number: 42,
					boolean: true,
					array: [1, 2, 3],
					object: { key: "value" },
					func: () => "test"
				},
				["string", "number", "boolean" as any],
				true,
				"mixed primitive types"
			],
			[
				{
					string: "hello",
					number: 42,
					boolean: true,
					array: [1, 2, 3],
					object: { key: "value" },
					func: () => "test"
				},
				["array", "object", "func"],
				true,
				"mixed complex types"
			]
		])("should return %s for %s", (obj, keys, expected, _description) => {
			// Act & Assert
			expect(hasValuesForKeys(obj, ...keys)).toBe(expected);
		});
	});
});
