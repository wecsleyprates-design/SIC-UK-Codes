import { convertCsvToJson } from "#utils/csv";

describe("CSV Migration Regression Tests", () => {
	describe("Basic CSV functionality", () => {
		it("should convert simple CSV to JSON", async () => {
			const csvData = `name,age,city
John,30,NYC
Jane,25,LA`;

			const result = await convertCsvToJson(csvData);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ name: "John", age: "30", city: "NYC" });
			expect(result[1]).toEqual({ name: "Jane", age: "25", city: "LA" });
		});

		it("should handle CSV with quoted fields", async () => {
			const csvData = `business_name,tin,address
"ABC Corp, Inc.","12-3456789","123 Main St, Suite 100"
"XYZ LLC","98-7654321","456 Oak Ave"`;

			const result = await convertCsvToJson(csvData);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				business_name: "ABC Corp, Inc.",
				tin: "12-3456789",
				address: "123 Main St, Suite 100"
			});
			expect(result[1]).toEqual({
				business_name: "XYZ LLC",
				tin: "98-7654321",
				address: "456 Oak Ave"
			});
		});

		it("should handle empty CSV", async () => {
			const csvData = `name,age`;

			const result = await convertCsvToJson(csvData);

			expect(result).toHaveLength(0);
		});

		it("should handle CSV with special characters", async () => {
			const csvData = `company,description
"Café München","Coffee shop with ümlauts"
"Tech™ Solutions","Technology with symbols®"`;

			const result = await convertCsvToJson(csvData);

			expect(result).toHaveLength(2);
			expect(result[0].company).toBe("Café München");
			expect(result[0].description).toBe("Coffee shop with ümlauts");
		});

		it("should process CSV efficiently", async () => {
			// Generate moderately sized CSV
			let csvData = "name,value\n";
			for (let i = 1; i <= 100; i++) {
				csvData += `Row${i},${i}\n`;
			}

			const startTime = Date.now();
			const result = await convertCsvToJson(csvData);
			const endTime = Date.now();

			expect(result).toHaveLength(100);
			expect(result[0]).toEqual({ name: "Row1", value: "1" });
			expect(result[99]).toEqual({ name: "Row100", value: "100" });
			expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
		});
	});

	describe("Backward compatibility", () => {
		it("should maintain same output format as csvtojson", async () => {
			const csvData = `field1,field2,field3
value1,value2,value3
"quoted value","another,value","final value"`;

			const result = await convertCsvToJson(csvData);

			expect(Array.isArray(result)).toBe(true);
			expect(result[0]).toEqual({
				field1: "value1",
				field2: "value2", 
				field3: "value3"
			});
			expect(result[1]).toEqual({
				field1: "quoted value",
				field2: "another,value",
				field3: "final value"
			});
		});
	});
});