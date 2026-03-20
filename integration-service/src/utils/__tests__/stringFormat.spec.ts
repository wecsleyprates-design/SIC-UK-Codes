import { sanitizeForLog } from "../stringFormat";

describe("sanitizeForLog", () => {
	it("should replace newlines with underscores", () => {
		const input = "Hello\nWorld";
		const expected = "Hello_World";
		expect(sanitizeForLog(input)).toBe(expected);
	});

	it("should replace carriage returns with underscores", () => {
		const input = "Hello\rWorld";
		const expected = "Hello_World";
		expect(sanitizeForLog(input)).toBe(expected);
	});

	it("should replace mixed newlines and carriage returns with single underscore", () => {
		const input = "Hello\r\nWorld";
		const expected = "Hello_World";
		expect(sanitizeForLog(input)).toBe(expected);
	});

	it("should handle multiple consecutive newlines", () => {
		const input = "Hello\n\n\nWorld";
		const expected = "Hello_World";
		expect(sanitizeForLog(input)).toBe(expected);
	});

	it("should return the same string if no newlines are present", () => {
		const input = "Hello World";
		const expected = "Hello World";
		expect(sanitizeForLog(input)).toBe(expected);
	});

	it("should handle empty strings", () => {
		const input = "";
		const expected = "";
		expect(sanitizeForLog(input)).toBe(expected);
	});
});
