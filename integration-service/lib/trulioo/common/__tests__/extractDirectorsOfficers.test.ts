import { extractDirectorsOfficersFromTrulioo } from "../utils";

/**
 * Helper to build a DatasourceResult containing StandardizedDirectorsOfficers.
 * Mirrors the structure returned by Trulioo Business Insights datasources.
 */
function buildDatasource(
	name: string,
	directors: Array<{ FullName: string; Designation?: string; FullAddress?: string[] }>
): Record<string, any> {
	return {
		DatasourceName: name,
		DatasourceFields: [],
		AppendedFields: [
			{
				FieldName: "StandardizedDirectorsOfficers",
				Data: JSON.stringify({ StandardizedDirectorsOfficers: directors })
			}
		],
		Errors: [],
		FieldGroups: []
	};
}

/**
 * Helper to wrap DatasourceResults into the full clientData structure
 * that mirrors a real Trulioo flowData response.
 */
function buildClientData(datasourceResults: Record<string, any>[], extraServices?: Record<string, any>[]): Record<string, any> {
	const services: Record<string, any>[] = [
		{
			timestamp: 1770850137,
			serviceStatus: "COMPLETED",
			nodeId: "node-kyb-insights",
			nodeTitle: "Business Insights",
			nodeType: "trulioo_kyb_insights",
			match: true,
			fullServiceDetails: {
				Record: {
					TransactionRecordID: "test-trx-001",
					RecordStatus: "match",
					DatasourceResults: datasourceResults
				}
			}
		},
		...(extraServices ?? [])
	];

	return {
		flowData: {
			"flow-001": {
				id: "flow-001",
				completed: true,
				serviceData: services
			}
		}
	};
}

describe("extractDirectorsOfficersFromTrulioo", () => {
	describe("multi-datasource extraction (NZ/AU real-world scenario)", () => {
		it("should extract directors from ALL datasources, not just the first", () => {
			const clientData = buildClientData([
				// Datasource 1: empty directors (e.g. Business Insights 480052 — Dun & Bradstreet)
				buildDatasource("Business Insights 480052", []),
				// Datasource 2: has directors (e.g. Business Insights 757413)
				buildDatasource("Business Insights 757413", [
					{ FullName: "Alistair FIELD", Designation: "Director", FullAddress: ["127 Montecollum Road,Wilsons Creek,Nsw,2482"] },
					{ FullName: "Bruce Ronald HASSALL", Designation: "Director", FullAddress: ["32c Awatea Road,Parnell,Auckland,1052"] }
				]),
				// Datasource 3: more directors (e.g. Business Insights 773174 — NZ Companies Office)
				buildDatasource("Business Insights 773174", [
					{ FullName: "Peter James MCBRIDE", Designation: "Director", FullAddress: ["22a Clarke Road,Rd 6,Tauranga,3176"] }
				]),
				// Datasource 4: empty directors (e.g. Business Insights 866768)
				buildDatasource("Business Insights 866768", [])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(3);
			expect(result.map((o: any) => o.name)).toEqual([
				"Alistair FIELD",
				"Bruce Ronald HASSALL",
				"Peter James MCBRIDE"
			]);
		});

		it("should skip datasources with empty StandardizedDirectorsOfficers and still find populated ones", () => {
			const clientData = buildClientData([
				buildDatasource("Empty Provider 1", []),
				buildDatasource("Empty Provider 2", []),
				buildDatasource("Populated Provider", [
					{ FullName: "Holly Suzanna KRAMER", Designation: "Director" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Holly Suzanna KRAMER");
			expect(result[0].titles).toEqual(["Director"]);
		});

		it("should return empty array when ALL datasources have empty directors", () => {
			const clientData = buildClientData([
				buildDatasource("Business Insights 480052", []),
				buildDatasource("Business Insights 866768", [])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toEqual([]);
		});
	});

	describe("deduplication", () => {
		it("should deduplicate directors by name (case-insensitive) across datasources", () => {
			const clientData = buildClientData([
				buildDatasource("Provider A", [
					{ FullName: "Bruce Ronald HASSALL", Designation: "Director" }
				]),
				buildDatasource("Provider B", [
					// Same person, slightly different casing
					{ FullName: "Bruce Ronald Hassall", Designation: "Director" }
				]),
				buildDatasource("Provider C", [
					{ FullName: "Peter James MCBRIDE", Designation: "Director" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(2);
			expect(result.map((o: any) => o.name)).toEqual([
				"Bruce Ronald HASSALL",
				"Peter James MCBRIDE"
			]);
		});

		it("should deduplicate directors within the same datasource", () => {
			const clientData = buildClientData([
				buildDatasource("Provider A", [
					{ FullName: "John Doe", Designation: "Director" },
					{ FullName: "john doe", Designation: "Officer" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("John Doe");
		});
	});

	describe("field extraction", () => {
		it("should extract FullAddress from director data", () => {
			const clientData = buildClientData([
				buildDatasource("Provider A", [
					{ FullName: "Alistair FIELD", Designation: "Director", FullAddress: ["127 Montecollum Road,Wilsons Creek,Nsw,2482"] }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].fullAddress).toBe("127 Montecollum Road,Wilsons Creek,Nsw,2482");
		});

		it("should handle directors without FullAddress", () => {
			const clientData = buildClientData([
				buildDatasource("Provider A", [
					{ FullName: "John Smith", Designation: "CEO" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].fullAddress).toBeUndefined();
		});

		it("should default title to 'Director' when no designation is provided", () => {
			const clientData = buildClientData([
				buildDatasource("Provider A", [
					{ FullName: "John Smith" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].titles).toEqual(["Director"]);
		});

		it("should use Designation as title when provided", () => {
			const clientData = buildClientData([
				buildDatasource("Provider A", [
					{ FullName: "Jane Doe", Designation: "CEO" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].titles).toEqual(["CEO"]);
		});

		it("should pass jurisdiction when provided", () => {
			const clientData = buildClientData([
				buildDatasource("Provider A", [
					{ FullName: "John Smith", Designation: "Director" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData, "AUK");

			expect(result).toHaveLength(1);
			expect(result[0].jurisdictions).toEqual(["AUK"]);
		});

		it("should not include jurisdictions when not provided", () => {
			const clientData = buildClientData([
				buildDatasource("Provider A", [
					{ FullName: "John Smith", Designation: "Director" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].jurisdictions).toBeUndefined();
		});
	});

	describe("alternate name fields", () => {
		it("should extract name from 'fullName' field (lowercase)", () => {
			const clientData = buildClientData([
				{
					DatasourceName: "Alt Provider",
					AppendedFields: [
						{
							FieldName: "StandardizedDirectorsOfficers",
							Data: JSON.stringify([{ fullName: "Alice Johnson" }])
						}
					]
				}
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Alice Johnson");
		});

		it("should extract name from 'name' field", () => {
			const clientData = buildClientData([
				{
					DatasourceName: "Alt Provider",
					AppendedFields: [
						{
							FieldName: "StandardizedDirectorsOfficers",
							Data: JSON.stringify([{ name: "Bob Williams" }])
						}
					]
				}
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Bob Williams");
		});
	});

	describe("Data format variations", () => {
		it("should handle Data as a raw object (not stringified)", () => {
			const clientData = buildClientData([
				{
					DatasourceName: "Provider",
					AppendedFields: [
						{
							FieldName: "StandardizedDirectorsOfficers",
							Data: {
								StandardizedDirectorsOfficers: [
									{ FullName: "Direct Object Director", Designation: "Director" }
								]
							}
						}
					]
				}
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Direct Object Director");
		});

		it("should handle Data as a direct array (not wrapped in object)", () => {
			const clientData = buildClientData([
				{
					DatasourceName: "Provider",
					AppendedFields: [
						{
							FieldName: "StandardizedDirectorsOfficers",
							Data: JSON.stringify([
								{ FullName: "Array Director", Designation: "Director" }
							])
						}
					]
				}
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Array Director");
		});

		it("should handle a single director object (not in array)", () => {
			const clientData = buildClientData([
				{
					DatasourceName: "Provider",
					AppendedFields: [
						{
							FieldName: "StandardizedDirectorsOfficers",
							Data: JSON.stringify({ FullName: "Solo Director", Designation: "CEO" })
						}
					]
				}
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Solo Director");
		});
	});

	describe("edge cases", () => {
		it("should return empty array for undefined clientData", () => {
			const result = extractDirectorsOfficersFromTrulioo(undefined);
			expect(result).toEqual([]);
		});

		it("should return empty array for null clientData", () => {
			const result = extractDirectorsOfficersFromTrulioo(null);
			expect(result).toEqual([]);
		});

		it("should return empty array for empty clientData", () => {
			const result = extractDirectorsOfficersFromTrulioo({});
			expect(result).toEqual([]);
		});

		it("should skip datasources without AppendedFields", () => {
			const clientData = buildClientData([
				{ DatasourceName: "No Fields" },
				buildDatasource("Has Fields", [
					{ FullName: "Valid Director", Designation: "Director" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Valid Director");
		});

		it("should skip directors without any name field", () => {
			const clientData = buildClientData([
				{
					DatasourceName: "Provider",
					AppendedFields: [
						{
							FieldName: "StandardizedDirectorsOfficers",
							Data: JSON.stringify({
								StandardizedDirectorsOfficers: [
									{ Designation: "Director" }, // no name
									{ FullName: "Has Name", Designation: "Director" }
								]
							})
						}
					]
				}
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Has Name");
		});

		it("should skip malformed JSON data gracefully", () => {
			const clientData = buildClientData([
				{
					DatasourceName: "Bad Provider",
					AppendedFields: [
						{
							FieldName: "StandardizedDirectorsOfficers",
							Data: "{invalid json{"
						}
					]
				},
				buildDatasource("Good Provider", [
					{ FullName: "Valid Director", Designation: "Director" }
				])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Valid Director");
		});

		it("should handle serviceData in clientData.serviceData (non-flowData structure)", () => {
			const clientData = {
				serviceData: [
					{
						fullServiceDetails: {
							Record: {
								DatasourceResults: [
									buildDatasource("Direct Service", [
										{ FullName: "Direct Director", Designation: "Director" }
									])
								]
							}
						}
					}
				]
			};

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Direct Director");
		});

		it("should handle multiple services (KYB + Watchlist) and only extract from those with directors", () => {
			const clientData = {
				flowData: {
					"flow-001": {
						serviceData: [
							{
								nodeType: "trulioo_kyb_insights",
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											buildDatasource("Business Insights", [
												{ FullName: "KYB Director", Designation: "Director" }
											])
										]
									}
								}
							},
							{
								nodeType: "trulioo_business_wl",
								fullServiceDetails: {
									Record: {
										DatasourceResults: [
											{
												DatasourceName: "Advanced Business Watchlist",
												AppendedFields: [
													{ FieldName: "WatchlistState", Data: "No Hit" }
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

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("KYB Director");
		});
	});

	describe("real-world NZ Fonterra scenario", () => {
		it("should extract all directors from a response matching the Fonterra NZ pattern (4 datasources, 2 empty + 2 populated)", () => {
			const clientData = buildClientData([
				// Business Insights 480052 (Dun & Bradstreet) — empty
				buildDatasource("Business Insights 480052", []),
				// Business Insights 757413 — active directors
				buildDatasource("Business Insights 757413", [
					{ FullName: "Alistair FIELD", Designation: "Director", FullAddress: ["127 Montecollum Road,Wilsons Creek,Nsw,2482"] },
					{ FullName: "Bruce Ronald HASSALL", Designation: "Director", FullAddress: ["32c Awatea Road,Parnell,Auckland,1052"] },
					{ FullName: "Brent John GOLDSACK", Designation: "Director", FullAddress: ["96c Matangi Road,Rd 4,Hamilton,3284"] },
					{ FullName: "Peter James MCBRIDE", Designation: "Director", FullAddress: ["22a Clarke Road,Rd 6,Tauranga,3176"] },
					{ FullName: "John Richard NICHOLLS", Designation: "Director", FullAddress: ["Unit 11, 66 Oxford Terrace,Christchurch Central,Christchurch,8011"] },
					{ FullName: "Holly Suzanna KRAMER", Designation: "Director", FullAddress: ["281 Sproules Lane,Glenquarry,Nsw,2576"] }
				]),
				// Business Insights 773174 (NZ Companies Office) — all directors including resigned
				buildDatasource("Business Insights 773174", [
					{ FullName: "Malcolm Guy BAILEY", Designation: "director" },
					{ FullName: "Henry VAN DER HEYDEN", Designation: "director" },
					{ FullName: "Alistair FIELD", Designation: "director" } // duplicate of 757413
				]),
				// Business Insights 866768 — empty
				buildDatasource("Business Insights 866768", [])
			]);

			const result = extractDirectorsOfficersFromTrulioo(clientData);

			// 6 from 757413 + 2 new from 773174 (Alistair FIELD deduplicated)
			expect(result).toHaveLength(8);

			const names = result.map((o: any) => o.name);
			expect(names).toContain("Alistair FIELD");
			expect(names).toContain("Bruce Ronald HASSALL");
			expect(names).toContain("Brent John GOLDSACK");
			expect(names).toContain("Peter James MCBRIDE");
			expect(names).toContain("John Richard NICHOLLS");
			expect(names).toContain("Holly Suzanna KRAMER");
			expect(names).toContain("Malcolm Guy BAILEY");
			expect(names).toContain("Henry VAN DER HEYDEN");

			// Alistair FIELD should appear only once (deduplicated)
			expect(names.filter((n: string) => n.toLowerCase().includes("alistair"))).toHaveLength(1);
		});
	});
});
