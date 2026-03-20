import { getRawIntegrationDataFromS3 } from "#common";
import { AccountingRest } from "../accountingRest";

jest.mock("#common/index");

const mockGetRawIntegrationDataFromS3 = getRawIntegrationDataFromS3 as jest.MockedFunction<typeof getRawIntegrationDataFromS3>;

describe("revenueFallback", () => {
	it("should parse and return BulkUpdateBusinessMap data from s3", async () => {
		/** Arrange */
		const businessId = "123";
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce({
			data: { is_revenue: "1000.00" }
		});

		/** Act */
		const result = await AccountingRest.revenueFallback(businessId);

		/** Assert */
		expect(result).toBe(1000.0);
	});

	it("should parse and return bulkCreateBusinessMapper data from s3 if BulkUpdateBusinessMap data was falsy", async () => {
		/** Arrange */
		const businessId = "123";

		// BulkUpdateBusinessMap data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// bulkCreateBusinessMapper data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce({
			data: { is_revenue: "2000.00" }
		});

		/** Act */
		const result = await AccountingRest.revenueFallback(businessId);

		/** Assert */
		expect(result).toBe(2000.0);
	});

	it("should parse and return Plaid incomestatement data from s3 if both bulkCreateBusinessMapper and BulkUpdateBusinessMap data were falsy", async () => {
		/** Arrange */
		const businessId = "123";

		// BulkUpdateBusinessMap data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// bulkCreateBusinessMapper data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// Plaid incomestatement data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce({
			income_statements: [{ total_income: "1000.00" }, { total_income: "1000.00" }, { total_income: "1000.00" }]
		});

		/** Act */
		const result = await AccountingRest.revenueFallback(businessId);

		/** Assert */
		expect(result).toBe(3000.0);
	});

	it("should parse and return equifax corpamount data from s3 if Plaid incomestatement, bulkCreateBusinessMapper, and BulkUpdateBusinessMap data were all falsy", async () => {
		/** Arrange */
		const businessId = "123";

		// BulkUpdateBusinessMap data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// bulkCreateBusinessMapper data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// Plaid incomestatement data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// equifax corpamount data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce({
			corpamount: "4000.00"
		});

		/** Act */
		const result = await AccountingRest.revenueFallback(businessId);

		/** Assert */
		expect(result).toBe(4000.0);
	});

	it("should return null if all data was falsy", async () => {
		/** Arrange */
		const businessId = "123";

		// BulkUpdateBusinessMap data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// bulkCreateBusinessMapper data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// Plaid incomestatement data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);
		// equifax corpamount data
		mockGetRawIntegrationDataFromS3.mockResolvedValueOnce(null);

		/** Act */
		const result = await AccountingRest.revenueFallback(businessId);

		/** Assert */
		expect(result).toBeNull();
	});
});
