import { stripNullBytesFromObject } from "../stripNullBytesFromObject";

describe("stripNullBytesFromValue", () => {
	it("strips null bytes from strings", () => {
		const input = "a\u0000b\u0000c";
		expect(stripNullBytesFromObject(input)).toBe("abc");
	});

	it("handles arrays of strings and objects", () => {
		const input = ["a\u0000", { nested: "b\u0000c" }, 123];
		expect(stripNullBytesFromObject(input)).toEqual(["a", { nested: "bc" }, 123]);
	});

	it("handles nested objects", () => {
		const input = {
			foo: "a\u0000b",
			bar: {
				baz: "c\u0000",
				qux: ["\u0000d", { deep: "e\u0000f" }]
			}
		};
		expect(stripNullBytesFromObject(input)).toEqual({
			foo: "ab",
			bar: {
				baz: "c",
				qux: ["d", { deep: "ef" }]
			}
		});
	});

	it("leaves null and non-string primitives unchanged", () => {
		const input = { a: null, b: 0, c: false };
		expect(stripNullBytesFromObject(input)).toEqual({ a: null, b: 0, c: false });
	});
});
