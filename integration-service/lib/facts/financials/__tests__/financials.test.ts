import { financialFacts, extractFromAccountingIncomeStatements } from "../financials";
import { FactEngine } from "../../factEngine";
import { FactRules } from "#lib/facts";
import { sources } from "#lib/facts/sources";

jest.mock("#helpers/logger");
jest.mock("#lib/facts/sources");

describe("financial facts", () => {
	describe("revenue", () => {
		beforeEach(() => {
			sources.accountingIncomeStatements.getter = jest.fn().mockResolvedValueOnce({});
			sources.equifax.getter = jest.fn().mockResolvedValueOnce({});
			sources.manual.getter = jest.fn().mockResolvedValueOnce({});
			sources.zoominfo.getter = jest.fn().mockResolvedValue({});
		});

		it("should return zoominfo revenue (when stored value is an integer)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: 800, // This is in thousands, so actual revenue is 800,000
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(800000);
		});

		it("should return zoominfo revenue (when stored value is a float)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: 800.1, // This is in thousands, so actual revenue is 800,100
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(800100);
		});

		it("should return zoominfo revenue (when stored value is a string)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: "500", // This is in thousands, so actual revenue is 500,000
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(500000);
		});

		it("should not return zoominfo revenue_equally_weighted_average (when revenue is a invalid numeric string)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: "500.1.1",
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should not return zoominfo revenue (when stored value is a non-numeric string)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: "hello!",
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should return accounting income statements revenue", async () => {
			/** Arrange */
			const accountingResponse = {
				accounting_incomestatement: {
					"2023": {
						end_period: "2023-12-31",
						total_revenue: 150000
					}
				}
			};
			sources.accountingIncomeStatements.getter = jest.fn().mockResolvedValue(accountingResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(150000);
		});

		it("should return most recent accounting income statements revenue when multiple periods exist", async () => {
			/** Arrange */
			const accountingResponse = {
				accounting_incomestatement: {
					"2022": {
						end_period: "2022-12-31",
						total_revenue: 120000
					},
					"2023": {
						end_period: "2023-12-31",
						total_revenue: 180000
					},
					"2021": {
						end_period: "2021-12-31",
						total_revenue: 100000
					}
				}
			};
			sources.accountingIncomeStatements.getter = jest.fn().mockResolvedValue(accountingResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(180000); // Should return 2023 value as it's most recent
		});

		it("should return equifax revenue (multiplied by 1000 from thousands)", async () => {
			/** Arrange */
			const equifaxResponse = {
				scoring_model: {
					corpamount: 250 // This is in thousands, so actual revenue is 250,000
				}
			};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(250000);
		});

		it("should return equifax revenue when corpamount is a decimal", async () => {
			/** Arrange */
			const equifaxResponse = {
				scoring_model: {
					corpamount: 125.5 // This is in thousands, so actual revenue is 125,500
				}
			};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(125500);
		});

		it("should not return equifax revenue when corpamount is undefined", async () => {
			/** Arrange */
			const equifaxResponse = {
				scoring_model: {
					corpamount: undefined
				}
			};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should not return equifax revenue when scoring_model is missing", async () => {
			/** Arrange */
			const equifaxResponse = {};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should return manual revenue from is_revenue field", async () => {
			/** Arrange */
			const manualResponse = {
				is_revenue: 300000
			};
			sources.manual.getter = jest.fn().mockResolvedValue(manualResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(300000);
		});

		it("should not return manual revenue when is_revenue is undefined", async () => {
			/** Arrange */
			const manualResponse = {
				is_revenue: undefined
			};
			sources.manual.getter = jest.fn().mockResolvedValue(manualResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should not return manual revenue when is_revenue field is missing", async () => {
			/** Arrange */
			const manualResponse = {};
			sources.manual.getter = jest.fn().mockResolvedValue(manualResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});
	});

	describe("revenue_equally_weighted_average", () => {
		beforeEach(() => {
			sources.accountingIncomeStatements.getter = jest.fn().mockResolvedValueOnce({});
			sources.equifax.getter = jest.fn().mockResolvedValueOnce({});
			sources.manual.getter = jest.fn().mockResolvedValueOnce({});
			sources.zoominfo.getter = jest.fn().mockResolvedValue({});
		});

		it("should return zoominfo revenue_equally_weighted_average (when revenue is an integer)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: 800, // This is in thousands, so actual revenue is 800,000
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(800000);
		});

		it("should return zoominfo revenue_equally_weighted_average (when revenue is a float)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: 800.1, // This is in thousands, so actual revenue is 800,100
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(800100);
		});

		it("should return zoominfo revenue_equally_weighted_average (when revenue is a string)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: "500", // This is in thousands, so actual revenue is 500,000
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(500000);
		});

		it("should not return zoominfo revenue_equally_weighted_average (when revenue is a invalid numeric string)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: "500.1.1",
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should not return zoominfo revenue_equally_weighted_average (when revenue is a non-numeric string)", async () => {
			/** Arrange */
			const zoominfoResponse = {
				firmographic: {
					zi_c_company_revenue: "hello!",
					zi_c_company_revenue_confidence: 1
				}
			};
			sources.zoominfo.getter = jest.fn().mockResolvedValue(zoominfoResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should return accounting income statements revenue_equally_weighted_average", async () => {
			/** Arrange */
			const accountingResponse = {
				accounting_incomestatement: {
					"2023": {
						end_period: "2023-12-31",
						total_revenue: 150000
					}
				}
			};
			sources.accountingIncomeStatements.getter = jest.fn().mockResolvedValue(accountingResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(150000);
		});

		it("should return most recent accounting income statements revenue_equally_weighted_average when multiple periods exist", async () => {
			/** Arrange */
			const accountingResponse = {
				accounting_incomestatement: {
					"2022": {
						end_period: "2022-12-31",
						total_revenue: 120000
					},
					"2023": {
						end_period: "2023-12-31",
						total_revenue: 180000
					},
					"2021": {
						end_period: "2021-12-31",
						total_revenue: 100000
					}
				}
			};
			sources.accountingIncomeStatements.getter = jest.fn().mockResolvedValue(accountingResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(180000); // Should return 2023 value as it's most recent
		});

		it("should not return accounting income statements revenue_equally_weighted_average when total_revenue is null", async () => {
			/** Arrange */
			const accountingResponse = {
				accounting_incomestatement: {
					"2023": {
						end_period: "2023-12-31",
						total_revenue: null
					}
				}
			};
			sources.accountingIncomeStatements.getter = jest.fn().mockResolvedValue(accountingResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should return equifax revenue_equally_weighted_average (multiplied by 1000 from thousands)", async () => {
			/** Arrange */
			const equifaxResponse = {
				scoring_model: {
					corpamount: 250 // This is in thousands, so actual revenue is 250,000
				}
			};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(250000);
		});

		it("should return equifax revenue_equally_weighted_average when corpamount is a decimal", async () => {
			/** Arrange */
			const equifaxResponse = {
				scoring_model: {
					corpamount: 125.5 // This is in thousands, so actual revenue is 125,500
				}
			};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(125500);
		});

		it("should not return equifax revenue_equally_weighted_average when corpamount is null", async () => {
			/** Arrange */
			const equifaxResponse = {
				scoring_model: {
					corpamount: null
				}
			};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should not return equifax revenue_equally_weighted_average when corpamount is undefined", async () => {
			/** Arrange */
			const equifaxResponse = {
				scoring_model: {
					corpamount: undefined
				}
			};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should not return equifax revenue_equally_weighted_average when scoring_model is missing", async () => {
			/** Arrange */
			const equifaxResponse = {};
			sources.equifax.getter = jest.fn().mockResolvedValue(equifaxResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should return manual revenue_equally_weighted_average from is_revenue field", async () => {
			/** Arrange */
			const manualResponse = {
				is_revenue: 300000
			};
			sources.manual.getter = jest.fn().mockResolvedValue(manualResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(300000);
		});

		it("should not return manual revenue_equally_weighted_average when is_revenue is null", async () => {
			/** Arrange */
			const manualResponse = {
				is_revenue: null
			};
			sources.manual.getter = jest.fn().mockResolvedValue(manualResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should not return manual revenue_equally_weighted_average when is_revenue is undefined", async () => {
			/** Arrange */
			const manualResponse = {
				is_revenue: undefined
			};
			sources.manual.getter = jest.fn().mockResolvedValue(manualResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});

		it("should not return manual revenue_equally_weighted_average when is_revenue field is missing", async () => {
			/** Arrange */
			const manualResponse = {};
			sources.manual.getter = jest.fn().mockResolvedValue(manualResponse);

			const businessId = "00000000-0000-0000-0000-000000000123";
			const factEngine = new FactEngine(financialFacts, { business: businessId });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			/** Act */
			const r = await factEngine.getResolvedFact("revenue_equally_weighted_average");

			/** Assert */
			expect(r?.value).toBe(undefined);
		});
	});
});

describe("extractFromAccountingIncomeStatements", () => {
	it("should return null if accounting_incomestatement is undefined", async () => {
		/** Arrange */
		const statement = { accounting_incomestatement: undefined };

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBeNull();
	});

	it("should return null if accounting_incomestatement is null", async () => {
		/** Arrange */
		const statement = { accounting_incomestatement: null };

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBeNull();
	});

	it("should return null if requested path is null in most recent statement", async () => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				"2023": {
					end_period: "2023-12-31",
					net_income: null
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBeNull();
	});

	it("should return null if requested path is undefined in most recent statement", async () => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				"2023": {
					end_period: "2023-12-31",
					net_income: undefined
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBeNull();
	});

	it("should return null if requested path does not exist in most recent statement", async () => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				"2023": {
					end_period: "2023-12-31",
					total_revenue: 100000
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBeNull();
	});

	it.each([
		[100000, 100000],
		[50000.5, 50000.5],
		[0, 0],
		[-25000, -25000]
	])("should extract value from most recent statement when value is %s", async (inputValue, expectedValue) => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				"2023": {
					end_period: "2023-12-31",
					net_income: inputValue
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBe(expectedValue);
	});

	it("should return most recent statement when multiple periods exist", async () => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				"2022": {
					end_period: "2022-12-31",
					net_income: 75000
				},
				"2023": {
					end_period: "2023-12-31",
					net_income: 100000
				},
				"2021": {
					end_period: "2021-12-31",
					net_income: 50000
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBe(100000); // Should return 2023 value as it's most recent
	});

	it.each([
		["total_revenue", 250000],
		["net_income", 100000],
		["gross_profit", 150000],
		["operating_expenses", 50000]
	])("should extract correct path %s with value %s", async (path, expectedValue) => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				"2023": {
					end_period: "2023-12-31",
					total_revenue: 250000,
					net_income: 100000,
					gross_profit: 150000,
					operating_expenses: 50000
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, path);

		/** Assert */
		expect(result).toBe(expectedValue);
	});

	it("should handle string values by converting to currency", async () => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				"2023": {
					end_period: "2023-12-31",
					net_income: "100000.50"
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBe(100000.5);
	});

	it("should handle date comparison correctly for most recent period", async () => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				Q1_2023: {
					end_period: "2023-03-31",
					net_income: 25000
				},
				Q4_2023: {
					end_period: "2023-12-31",
					net_income: 40000
				},
				Q2_2023: {
					end_period: "2023-06-30",
					net_income: 30000
				},
				Q3_2023: {
					end_period: "2023-09-30",
					net_income: 35000
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBe(40000); // Q4 2023 should be most recent
	});

	it("should return 0 when value is explicitly 0", async () => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {
				"2023": {
					end_period: "2023-12-31",
					net_income: 0
				}
			}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBe(0);
	});

	it("should handle empty accounting_incomestatement object", async () => {
		/** Arrange */
		const statement = {
			accounting_incomestatement: {}
		};

		/** Act */
		const result = await extractFromAccountingIncomeStatements(statement, "net_income");

		/** Assert */
		expect(result).toBeNull();
	});
});
