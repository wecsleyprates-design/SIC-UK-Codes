import { isObjectWithKeys, IS_OBJECT_WITH_KEYS_STRATEGY } from "../isObjectWithKeys";

describe("isObjectWithKeys", () => {
	describe("with EVERY strategy (default)", () => {
		it("should return true when object has all specified keys", () => {
			// Arrange
			const obj = { name: "John", age: 30, city: "New York" };

			// Act & Assert
			expect(isObjectWithKeys(obj, "name", "age")).toBe(true);
		});

		it("should return true when object has all specified keys including extras", () => {
			// Arrange
			const obj = { name: "John", age: 30, city: "New York" };

			// Act & Assert
			expect(isObjectWithKeys(obj, "name", "age", "city")).toBe(true);
		});

		it("should return false when object is missing some keys", () => {
			// Arrange
			const obj = { name: "John", age: 30 };

			// Act & Assert
			expect(isObjectWithKeys(obj, "name", "age", "city")).toBe(false);
		});

		it("should return false when object is missing the key", () => {
			// Arrange
			const obj = { name: "John", age: 30 };

			// Act & Assert
			expect(isObjectWithKeys(obj, "email")).toBe(false);
		});

		it("should return true for object when checking single key that exists", () => {
			// Arrange
			const obj = { name: "John" };

			// Act & Assert
			expect(isObjectWithKeys(obj, "name")).toBe(true);
		});

		it("should return false for null", () => {
			// Arrange
			const obj = null;

			// Act & Assert
			expect(isObjectWithKeys(obj, "name")).toBe(false);
		});

		it.each([
			["string", "length", "string value"],
			[123, "toString", "number value"],
			[true, "valueOf", "boolean value"],
			[undefined, "name", "undefined value"]
		])("should return false for %s", (value, key, _description) => {
			// Act & Assert
			expect(isObjectWithKeys(value, key)).toBe(false);
		});

		it.each([
			[{ name: "John", age: 30 }, "name", true, "existing key"],
			[{ name: "John", age: 30 }, "email", false, "non-existing key"]
		])("should return %s for single key check with %s", (obj, key, expected, _description) => {
			// Act & Assert
			expect(isObjectWithKeys(obj, key)).toBe(expected);
		});
	});

	describe("with SOME strategy", () => {
		it("should return true when object has at least one of the specified keys (name)", () => {
			// Arrange
			const obj = { name: "John", age: 30 };

			// Act & Assert
			expect(isObjectWithKeys(obj, IS_OBJECT_WITH_KEYS_STRATEGY.SOME, "name", "email")).toBe(true);
		});

		it("should return true when object has at least one of the specified keys (age)", () => {
			// Arrange
			const obj = { name: "John", age: 30 };

			// Act & Assert
			expect(isObjectWithKeys(obj, IS_OBJECT_WITH_KEYS_STRATEGY.SOME, "age", "city")).toBe(true);
		});

		it("should return false when object has none of the specified keys", () => {
			// Arrange
			const obj = { name: "John", age: 30 };

			// Act & Assert
			expect(isObjectWithKeys(obj, IS_OBJECT_WITH_KEYS_STRATEGY.SOME, "email", "city")).toBe(false);
		});

		it("should return true when object has all specified keys", () => {
			// Arrange
			const obj = { name: "John", age: 30, city: "New York" };

			// Act & Assert
			expect(isObjectWithKeys(obj, IS_OBJECT_WITH_KEYS_STRATEGY.SOME, "name", "age")).toBe(true);
		});

		it("should return false for null with SOME strategy", () => {
			// Arrange
			const obj = null;

			// Act & Assert
			expect(isObjectWithKeys(obj, IS_OBJECT_WITH_KEYS_STRATEGY.SOME, "name")).toBe(false);
		});

		it.each([
			["string", "length", "string value"],
			[123, "toString", "number value"]
		] as const)("should return false for %s with SOME strategy", (value, key, _description) => {
			// Act & Assert
			expect(isObjectWithKeys(value, IS_OBJECT_WITH_KEYS_STRATEGY.SOME, key)).toBe(false);
		});
	});

	describe("with EVERY strategy explicitly", () => {
		it("should return true when object has all keys", () => {
			// Arrange
			const obj = { name: "John", age: 30 };

			// Act & Assert
			expect(isObjectWithKeys(obj, IS_OBJECT_WITH_KEYS_STRATEGY.EVERY, "name", "age")).toBe(true);
		});

		it("should return false when object is missing some keys", () => {
			// Arrange
			const obj = { name: "John", age: 30 };

			// Act & Assert
			expect(isObjectWithKeys(obj, IS_OBJECT_WITH_KEYS_STRATEGY.EVERY, "name", "email")).toBe(false);
		});
	});

	describe("type guarding", () => {
		it("should properly narrow type when used as type guard", () => {
			// Arrange
			const obj: unknown = { name: "John", age: 30 };

			// Act & Assert
			if (isObjectWithKeys(obj, "name", "age")) {
				// TypeScript should now know obj has name and age properties
				expect(typeof obj.name).toBe("string");
				expect(typeof obj.age).toBe("number");
			}
		});
	});
});
