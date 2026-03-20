import { sanitizeDate } from "../date";

describe("sanitizeDate", () => {
	it.each([
		["2024-01-31", "2024-01-31"],
		["01/05/2024", "2024-01-05"],
		["01-05-2024", "2024-01-05"],
		[1548381600000, "2019-01-25"]
	])("normalizes %s to %s", (input, expected) => {
		expect(sanitizeDate(input)).toBe(expected);
	});

	it("returns empty string for null", () => {
		expect(sanitizeDate(null)).toBe("");
	});

	it("returns empty string for null byte string", () => {
		expect(sanitizeDate("\u0000")).toBe("");
	});

	it("handles Date object inputs", () => {
		const input = new Date("2024-02-03T12:34:56Z");
		expect(sanitizeDate(input)).toBe("2024-02-03");
	});

	it.each([
		["2024-99-31", ""],
		["02/30/2024", ""],
		["11-31-2024", ""],
		[null, ""],
		["", ""],
		[undefined, ""],
		[0, ""]
	])("normalizes %s to empty string", (input, expected) => {
		expect(sanitizeDate(input)).toBe(expected);
	});
});
