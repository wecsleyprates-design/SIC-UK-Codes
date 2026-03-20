import { extractAddressMatchStatusFromDatasourceFields } from "../utils";

/**
 * Helper to build a minimal clientData with DatasourceResults.DatasourceFields.
 * Mirrors the Trulioo response structure:
 *   clientData.serviceData[].fullServiceDetails.Record.DatasourceResults[].DatasourceFields[]
 */
function buildClientData(
	datasourceResults: Array<{
		DatasourceName?: string;
		DatasourceFields?: Array<{ FieldName: string; Status: string }>;
	}>
): Record<string, unknown> {
	return {
		serviceData: [
			{
				fullServiceDetails: {
					Record: {
						DatasourceResults: datasourceResults
					}
				}
			}
		]
	};
}

describe("extractAddressMatchStatusFromDatasourceFields", () => {
	it("should return undefined when clientData is undefined", () => {
		expect(extractAddressMatchStatusFromDatasourceFields(undefined)).toBeUndefined();
	});

	it("should return undefined when clientData is empty", () => {
		expect(extractAddressMatchStatusFromDatasourceFields({})).toBeUndefined();
	});

	it("should return undefined when serviceData is missing", () => {
		expect(extractAddressMatchStatusFromDatasourceFields({ foo: "bar" })).toBeUndefined();
	});

	it("should return undefined when DatasourceResults is missing", () => {
		const clientData = {
			serviceData: [{ fullServiceDetails: { Record: {} } }]
		};
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should return undefined when DatasourceFields is empty (no address fields found)", () => {
		const clientData = buildClientData([
			{ DatasourceName: "Business Essentials", DatasourceFields: [] }
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should return undefined when only non-address fields are present", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Essentials",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "BusinessRegistrationNumber", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should return 'match' when all address fields are 'match'", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" },
					{ FieldName: "StateProvinceCode", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'match' when address fields are 'match' or 'missing'", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "missing" },
					{ FieldName: "StateProvinceCode", Status: "missing" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'nomatch' when any address field has 'nomatch'", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'nomatch' if only PostalCode has 'nomatch'", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "nomatch" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'nomatch' if StreetName has 'nomatch' even if others match", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "BuildingNumber", Status: "match" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "StreetType", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" },
					{ FieldName: "StateProvinceCode", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should use Comprehensive View when available, even if individual datasources have nomatch", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 531971",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			},
			{
				DatasourceName: "Business Insights 773174",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "City", Status: "match" }
				]
			},
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		// Comprehensive View says match → result should be "match" (ignoring individual datasource nomatch)
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should return 'nomatch' when Comprehensive View itself has nomatch", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 531971",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" }
				]
			},
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "nomatch" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should fallback to all datasources when no Comprehensive View exists", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Essentials",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			},
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		// No Comprehensive View → falls back to scanning all → finds nomatch
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'match' via fallback when no Comprehensive View and all datasources match", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Essentials",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "City", Status: "match" }
				]
			},
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should handle flowData structure (serviceData inside flowData)", () => {
		const clientData = {
			flowData: {
				"flow-step-1": {
					serviceData: [
						{
							fullServiceDetails: {
								Record: {
									DatasourceResults: [
										{
											DatasourceName: "Comprehensive View",
											DatasourceFields: [
												{ FieldName: "Address1", Status: "nomatch" },
												{ FieldName: "City", Status: "match" }
											]
										}
									]
								}
							}
						}
					]
				}
			}
		};
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should return 'match' when all address fields are missing (no nomatch)", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "missing" },
					{ FieldName: "City", Status: "missing" }
				]
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should handle DatasourceResults with no DatasourceFields property", () => {
		const clientData = buildClientData([
			{
				DatasourceName: "Business Essentials"
				// No DatasourceFields
			}
		]);
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBeUndefined();
	});

	it("should match the Slack scenario: Martin & Consulting Inc. with red address fields in Comprehensive View", () => {
		// From Slack screenshots: Martin & Consulting Inc. with wrong address (Silversmith Drive)
		// Comprehensive View shows address fields as red (nomatch)
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 530975",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "BuildingNumber", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "City", Status: "nomatch" },
					{ FieldName: "PostalCode", Status: "nomatch" }
				]
			},
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "BusinessRegistrationNumber", Status: "match" },
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "BuildingNumber", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "StreetType", Status: "missing" },
					{ FieldName: "City", Status: "nomatch" },
					{ FieldName: "StateProvinceCode", Status: "match" },
					{ FieldName: "PostalCode", Status: "nomatch" }
				]
			}
		]);
		// Comprehensive View has nomatch on address → nomatch
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});

	it("should match the Slack scenario: verified address with all green in Comprehensive View", () => {
		// From Slack screenshots: correct address (498 Beresford Ave)
		// Comprehensive View shows all green, but Business Insights 773174 has nomatch (secondary data source)
		const clientData = buildClientData([
			{
				DatasourceName: "Business Insights 531971",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			},
			{
				DatasourceName: "Business Insights 773174",
				DatasourceFields: [
					{ FieldName: "Address1", Status: "nomatch" },
					{ FieldName: "StreetName", Status: "nomatch" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "PostalCode", Status: "missing" }
				]
			},
			{
				DatasourceName: "Comprehensive View",
				DatasourceFields: [
					{ FieldName: "BusinessName", Status: "match" },
					{ FieldName: "Address1", Status: "match" },
					{ FieldName: "BuildingNumber", Status: "match" },
					{ FieldName: "StreetName", Status: "match" },
					{ FieldName: "StreetType", Status: "match" },
					{ FieldName: "City", Status: "match" },
					{ FieldName: "StateProvinceCode", Status: "match" },
					{ FieldName: "PostalCode", Status: "match" }
				]
			}
		]);
		// Comprehensive View has all match → match (even though 773174 has nomatch)
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("match");
	});

	it("should correctly evaluate real Trulioo response: Martin & Consulting Inc. with wrong address (Silversmith Drive)", () => {
		// Real raw response from Trulioo (from Mauricio, 2026-02-13).
		// Business: Martin & Consulting Inc., submitted address: 1455 Silversmith Drive, Oakville, ON
		// Registered address: 498 Beresford Ave, Toronto, ON
		// Expected: "nomatch" because Comprehensive View address fields are all red.
		const clientData = {
			flowData: {
				"6930781000d6c1209c2e0a21": {
					serviceData: [
						{
							nodeTitle: "Business Insights",
							serviceStatus: "COMPLETED",
							fullServiceDetails: {
								Record: {
									RecordStatus: "match",
									DatasourceResults: [
										{ DatasourceName: "Address Validation", DatasourceFields: [] },
										{ DatasourceName: "BRNValidation", DatasourceFields: [] },
										{ DatasourceName: "Business Essentials 778120", DatasourceFields: [] },
										{
											DatasourceName: "Business Insights 531971",
											DatasourceFields: [
												{ FieldName: "BusinessName", Status: "match" },
												{ FieldName: "BusinessRegistrationNumber", Status: "match" },
												{ FieldName: "Address1", Status: "nomatch" },
												{ FieldName: "StreetName", Status: "nomatch" },
												{ FieldName: "StreetType", Status: "nomatch" },
												{ FieldName: "PostalCode", Status: "nomatch" },
												{ FieldName: "City", Status: "nomatch" },
												{ FieldName: "BuildingNumber", Status: "nomatch" },
												{ FieldName: "StateProvinceCode", Status: "match" }
											]
										},
										{
											DatasourceName: "Business Insights 773174",
											DatasourceFields: [
												{ FieldName: "BusinessName", Status: "match" },
												{ FieldName: "Address1", Status: "nomatch" },
												{ FieldName: "StreetName", Status: "nomatch" },
												{ FieldName: "City", Status: "nomatch" },
												{ FieldName: "StateProvinceCode", Status: "match" }
											]
										},
										{ DatasourceName: "Business Insights 812165", DatasourceFields: [] },
										{
											DatasourceName: "Comprehensive View",
											DatasourceFields: [
												{ FieldName: "BusinessName", Status: "match" },
												{ FieldName: "BusinessRegistrationNumber", Status: "match" },
												{ FieldName: "Address1", Status: "nomatch" },
												{ FieldName: "StreetName", Status: "nomatch" },
												{ FieldName: "StreetType", Status: "nomatch" },
												{ FieldName: "PostalCode", Status: "nomatch" },
												{ FieldName: "City", Status: "nomatch" },
												{ FieldName: "BuildingNumber", Status: "nomatch" },
												{ FieldName: "StateProvinceCode", Status: "match" }
											]
										},
										{ DatasourceName: "Language Intelligence", DatasourceFields: [] }
									]
								}
							}
						}
					]
				}
			}
		};
		expect(extractAddressMatchStatusFromDatasourceFields(clientData)).toBe("nomatch");
	});
});
