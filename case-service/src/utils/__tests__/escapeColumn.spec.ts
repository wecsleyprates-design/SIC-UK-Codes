import { escapeColumn } from "../escapeColumn";

describe("escapeColumn", () => {
	it('should escape a column in the format "column"', () => {
		/** Arrange */
		const input = "id";

		/** Act */
		const result = escapeColumn(input);

		/** Assert */
		expect(result).toBe("id");
	});

	it('should escape a column in the format "column::typecast"', () => {
		/** Arrange */
		const input = "id::text";

		/** Act */
		const result = escapeColumn(input);

		/** Assert */
		expect(result).toBe("id::text");
	});

	it('should escape a column in the format "table.column"', () => {
		/** Arrange */
		const input = "data_businesses.id";

		/** Act */
		const result = escapeColumn(input);

		/** Assert */
		expect(result).toBe("data_businesses.id");
	});

	it('should escape a column in the format "table.column::typecast"', () => {
		/** Arrange */
		const input = "data_businesses.id::text";

		/** Act */
		const result = escapeColumn(input);

		/** Assert */
		expect(result).toBe("data_businesses.id::text");
	});

	it.each([
		["data_businesses.id::text", "data_businesses.id::text"],
		["data_businesses.id::integer", "data_businesses.id::integer"],
		["data_businesses.id::boolean", "data_businesses.id::boolean"],
		["data_businesses.id::json", "data_businesses.id::json"],
		["data_businesses.id::jsonb", "data_businesses.id::jsonb"],
		["data_businesses.id::date", "data_businesses.id::date"],
		["data_businesses.id::timestamp", "data_businesses.id::timestamp"],
		["data_businesses.id::timestamptz", "data_businesses.id::timestamptz"],
		["data_businesses.id::time", "data_businesses.id::time"],
		["data_businesses.id::timetz", "data_businesses.id::timetz"],
		["data_businesses.id::interval", "data_businesses.id::interval"],
		["data_businesses.id::bytea", "data_businesses.id::bytea"],
		["data_businesses.id::xml", "data_businesses.id::xml"],
		["data_businesses.id::uuid", "data_businesses.id::uuid"],
		["data_businesses.id::cidr", "data_businesses.id::cidr"],
		["data_businesses.id::inet", "data_businesses.id::inet"],
		["data_businesses.id::my_custom_type", "data_businesses.id::my_custom_type"],
		["data_businesses.id::_my_custom_type", "data_businesses.id::_my_custom_type"],
		["data_businesses.id::my_custom_type_", "data_businesses.id::my_custom_type_"],
		["data_businesses.id::MY_CUSTOM_TYPE", "data_businesses.id::MY_CUSTOM_TYPE"]
	])('should not throw an error for a column with a typecast: "%s"', (input: string, expected: string) => {
		/** Act */
		const result = escapeColumn(input);
		/** Assert */
		expect(result).toBe(expected);
	});

	it("should throw an error for invalid type cast", () => {
		/** Arrange */
		const input = "data_businesses.id::DROP TABLE users;--";

		/** Act & Assert */
		expect(() => escapeColumn(input)).toThrow("Invalid type cast: DROP TABLE users;--");
	});

	it('should escape a SQL injection attempt in the format "column"', () => {
		/** Arrange */
		const input = "id; DROP TABLE users; --";

		/** Act */
		const result = escapeColumn(input);

		/** Assert */
		expect(result).toBe('"id; DROP TABLE users; --"');
	});

	it('should throw an invalid typecast error for a SQL injection attempt in the format "column::typecast"', () => {
		/** Arrange */
		const input = "id::text; DROP TABLE users; --";

		/** Act & Assert */
		expect(() => escapeColumn(input)).toThrow("Invalid type cast: text; DROP TABLE users; --");
	});

	it('should escape a SQL injection attempt in the format "table.column"', () => {
		/** Arrange */
		const input = "data_businesses.id; DROP TABLE users; --";

		/** Act */
		const result = escapeColumn(input);

		/** Assert */
		expect(result).toBe('data_businesses."id; DROP TABLE users; --"');
	});

	it('should throw an invalid typecast error for a SQL injection attempt in the format "table.column::typecast"', () => {
		/** Arrange */
		const input = "data_businesses.id::text; DROP TABLE users; --";

		/** Act & Assert */
		expect(() => escapeColumn(input)).toThrow("Invalid type cast: text; DROP TABLE users; --");
	});
});
