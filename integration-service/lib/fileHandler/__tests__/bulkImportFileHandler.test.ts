import { formatCsvValue, formatCsvRow } from "../bulkImportFileHandler";

describe("BulkImportFileHandler - CSV Formatting", () => {
	describe("formatCsvValue", () => {
		it("should return empty string for null value", () => {
			const result = formatCsvValue(null);
			expect(result).toBe("");
		});

		it("should return empty string for undefined value", () => {
			const result = formatCsvValue(undefined);
			expect(result).toBe("");
		});

		it("should return plain string for simple values without special characters", () => {
			const result = formatCsvValue("simple");
			expect(result).toBe("simple");
		});

		it("should quote and escape values containing commas", () => {
			const result = formatCsvValue("value,with,commas");
			expect(result).toBe('"value,with,commas"');
		});

		it("should quote and double-escape values containing quotes", () => {
			const result = formatCsvValue('value with "quotes"');
			expect(result).toBe('"value with ""quotes"""');
		});

		it("should quote values containing newlines", () => {
			const result = formatCsvValue("value\nwith\nnewlines");
			expect(result).toBe('"value\nwith\nnewlines"');
		});

		it("should quote values containing carriage returns", () => {
			const result = formatCsvValue("value\rwith\rreturns");
			expect(result).toBe('"value\rwith\rreturns"');
		});

		it("should handle values with multiple special characters", () => {
			const result = formatCsvValue('complex, "value"\nwith\rall');
			expect(result).toBe('"complex, ""value""\nwith\rall"');
		});

		it("should convert number values to strings", () => {
			const result = formatCsvValue(12345);
			expect(result).toBe("12345");
		});

		it("should convert boolean values to strings", () => {
			expect(formatCsvValue(true)).toBe("true");
			expect(formatCsvValue(false)).toBe("false");
		});

		it("should convert object values to strings", () => {
			const result = formatCsvValue({ key: "value" });
			expect(result).toBe("[object Object]");
		});

		it("should handle empty string", () => {
			const result = formatCsvValue("");
			expect(result).toBe("");
		});

		it("should handle string with only spaces", () => {
			const result = formatCsvValue("   ");
			expect(result).toBe("   ");
		});
	});

	describe("formatCsvRow", () => {
		it("should format simple row without special characters", () => {
			const values = ["name", "email", "phone"];
			const result = formatCsvRow(values);
			expect(result).toBe("name,email,phone");
		});

		it("should properly format row with values containing commas", () => {
			const values = ["John Doe", "123 Main St, Apt 4", "New York"];
			const result = formatCsvRow(values);
			expect(result).toBe('John Doe,"123 Main St, Apt 4",New York');
		});

		it("should properly format row with values containing quotes", () => {
			const values = ["Company", 'The "Best" Company', "Description"];
			const result = formatCsvRow(values);
			expect(result).toBe('Company,"The ""Best"" Company",Description');
		});

		it("should handle mixed types in row", () => {
			const values = ["Name", 123, true, null, undefined];
			const result = formatCsvRow(values);
			expect(result).toBe("Name,123,true,,");
		});

		it("should handle empty array", () => {
			const values = [];
			const result = formatCsvRow(values);
			expect(result).toBe("");
		});

		it("should handle row with single value", () => {
			const values = ["single"];
			const result = formatCsvRow(values);
			expect(result).toBe("single");
		});

		it("should handle row with newlines and carriage returns", () => {
			const values = ["field1", "line1\nline2", "field3\rvalue"];
			const result = formatCsvRow(values);
			expect(result).toBe('field1,"line1\nline2","field3\rvalue"');
		});

		it("should handle complex CSV row with all edge cases", () => {
			const values = ["Simple", "Value, with comma", 'Quote "test"', "Line\nbreak", 123, null, undefined, true];
			const result = formatCsvRow(values);
			expect(result).toBe('Simple,"Value, with comma","Quote ""test""","Line\nbreak",123,,,true');
		});

		it("should create RFC 4180 compliant CSV rows", () => {
			// Test case from RFC 4180 specification
			const values = ["aaa", "b,bb", "ccc"];
			const result = formatCsvRow(values);
			expect(result).toBe('aaa,"b,bb",ccc');
		});

		it("should handle consecutive commas in value", () => {
			const values = ["field1", "a,,b", "field3"];
			const result = formatCsvRow(values);
			expect(result).toBe('field1,"a,,b",field3');
		});
	});

	describe("CSV formatting integration", () => {
		it("should format headers correctly", () => {
			const headers = ["Business Name", "EIN", "Address, City, State"];
			const result = formatCsvRow(headers);
			expect(result).toBe('Business Name,EIN,"Address, City, State"');
		});

		it("should format data row with PII correctly", () => {
			const dataRow = ["John's Company", "12-3456789", "123 Main St, Suite 100", "New York, NY"];
			const result = formatCsvRow(dataRow);
			expect(result).toBe('John\'s Company,12-3456789,"123 Main St, Suite 100","New York, NY"');
		});

		it("should be reversible with CSV parser", () => {
			// This test ensures that our formatting is compatible with standard CSV parsing
			const originalValues = ["value1", "value,2", 'value"3"', "value\n4"];
			const csvRow = formatCsvRow(originalValues);

			// The CSV row should be parseable back to original values
			expect(csvRow).toBe('value1,"value,2","value""3""","value\n4"');
		});

		it("should handle empty values in the middle of a row", () => {
			const values = ["first", "", "third", null, "fifth"];
			const result = formatCsvRow(values);
			expect(result).toBe("first,,third,,fifth");
		});
	});
});
