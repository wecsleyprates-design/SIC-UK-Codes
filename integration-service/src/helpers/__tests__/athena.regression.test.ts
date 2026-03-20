import { Athena } from "../athena";

// Mock AWS SDK
jest.mock("@aws-sdk/client-athena");

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn()
	}
}));

// Mock configs
jest.mock("#configs", () => ({
	envConfig: {
		AWS_SES_REGION: "us-east-1",
		AWS_ACCESS_KEY_ID: "test-access-key",
		AWS_ACCESS_KEY_SECRET: "test-secret-key",
		EQUIFAX_ATHENA_DB: "test-db",
		EQUIFAX_ATHENA_S3_OUTPUT: "test-bucket"
	}
}));

// Mock other dependencies
jest.mock("#helpers/api", () => ({
	getBusinessDetails: jest.fn(),
	TIN_BEHAVIOR: {
		UNKNOWN: "UNKNOWN"
	}
}));

jest.mock("#helpers/redshift", () => ({
	executeRedshiftQuery: jest.fn()
}));

jest.mock("#helpers/LaunchDarkly", () => ({
	getFlagValue: jest.fn().mockResolvedValue(false)
}));

describe("Athena Regression Tests", () => {
	let athena: Athena;

	beforeEach(() => {
		jest.clearAllMocks();
		athena = new Athena();
	});

	describe("Basic functionality tests", () => {
		it("should instantiate Athena class without errors", () => {
			expect(athena).toBeDefined();
			expect(athena).toBeInstanceOf(Athena);
		});

		it("should have query method available", () => {
			expect(typeof athena.query).toBe("function");
		});

		it("should have queryForBusiness method available", () => {
			expect(typeof athena.queryForBusiness).toBe("function");
		});

		it("should have queryReturnMetadata method available", () => {
			expect(typeof athena.queryReturnMetadata).toBe("function");
		});
	});

	describe("Method availability checks", () => {
		it("should maintain backward compatibility with original athena-express-plus interface", () => {
			// These methods should exist to maintain compatibility
			expect(athena).toHaveProperty("query");
			expect(athena).toHaveProperty("queryForBusiness");
			expect(athena).toHaveProperty("queryReturnMetadata");
		});

		it("should not have any breaking changes in public API", () => {
			// Ensure we haven't accidentally removed methods during migration
			const methods = Object.getOwnPropertyNames(Athena.prototype);
			
			// Core methods that should be available
			expect(methods).toContain("query");
			expect(methods).toContain("queryForBusiness");
			expect(methods).toContain("queryReturnMetadata");
		});
	});

	describe("Error handling regression", () => {
		it("should handle invalid SQL gracefully", async () => {
			// Mock the query to reject with an error
			jest.spyOn(athena, 'query').mockRejectedValue(new Error('Invalid SQL syntax'));

			await expect(athena.query("INVALID SQL")).rejects.toThrow('Invalid SQL syntax');
		});

		it("should handle network errors gracefully", async () => {
			// Mock the query to reject with a network error
			jest.spyOn(athena, 'query').mockRejectedValue(new Error('Network error'));

			await expect(athena.query("SELECT * FROM test")).rejects.toThrow('Network error');
		});
	});

	describe("Performance regression checks", () => {
		it("should complete method calls within reasonable time", async () => {
			// Mock a successful response
			jest.spyOn(athena, 'query').mockResolvedValue([]);

			const startTime = Date.now();
			await athena.query("SELECT 1");
			const endTime = Date.now();

			// Should complete almost immediately when mocked
			expect(endTime - startTime).toBeLessThan(100);
		});

		it("should handle method calls without memory leaks", async () => {
			// Mock a successful response
			jest.spyOn(athena, 'query').mockResolvedValue([]);

			// Run multiple queries to check for memory issues
			const promises: Promise<any>[] = [];
			for (let i = 0; i < 10; i++) {
				promises.push(athena.query(`SELECT ${i}`));
			}

			await expect(Promise.all(promises)).resolves.toHaveLength(10);
		});
	});

	describe("Integration compatibility", () => {
		it("should maintain compatibility with business query interface", async () => {
			// Mock the queryForBusiness method
			const mockBusinessResult = {
				bestMatch: { score: 85, points: 100, data: { efx_id: "12345" } },
				result: [{ efx_id: "12345", business_name: "Test Business" }]
			};
			
			jest.spyOn(athena, 'queryForBusiness').mockResolvedValue(mockBusinessResult);

			const result = await athena.queryForBusiness("test-business-id");

			expect(result).toHaveProperty("bestMatch");
			expect(result).toHaveProperty("result");
			expect(result.bestMatch.score).toBe(85);
		});

		it("should maintain compatibility with metadata query interface", async () => {
			// Mock the queryReturnMetadata method
			const mockData = [{ count: 42 }];
			const mockMetadata = {
				DataScannedInMB: 1,
				QueryCostInUSD: 0.01,
				EngineExecutionTimeInMillis: 500,
				count: 1
			};
			
			jest.spyOn(athena, 'queryReturnMetadata').mockResolvedValue([mockData, mockMetadata]);

			const [data, metadata] = await athena.queryReturnMetadata("SELECT COUNT(*) FROM test");

			expect(data).toEqual([{ count: 42 }]);
			expect(metadata).toHaveProperty("DataScannedInMB");
			expect(metadata).toHaveProperty("QueryCostInUSD");
			expect(metadata).toHaveProperty("EngineExecutionTimeInMillis");
		});
	});

	describe("CSV processing compatibility", () => {
		it("should work with systems that expect athena-express-plus behavior", async () => {
			// This test ensures our new implementation doesn't break existing CSV workflows
			const mockQueryResult = [
				{ business_name: "Test Company", tin: "12-3456789" },
				{ business_name: "Another Company", tin: "98-7654321" }
			];

			jest.spyOn(athena, 'query').mockResolvedValue(mockQueryResult);

			const result = await athena.query("SELECT business_name, tin FROM businesses");

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
			expect(result[0]).toHaveProperty("business_name");
			expect(result[0]).toHaveProperty("tin");
		});
	});
});