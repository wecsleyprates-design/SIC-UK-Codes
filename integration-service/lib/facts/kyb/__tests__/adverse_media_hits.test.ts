import { FactEngine, FactRules, FactUtils } from "#lib/facts";
import { kybFacts } from "..";
import { sources } from "#lib/facts/sources";
import type { GetBusinessEntityReview } from "#api/v1/modules/verification/types";
import type { IBusinessEntityReviewTask } from "#types/db";

describe("adverse_media_hits", () => {
	let factEngine: FactEngine;
	const businessID = "00000000-0000-0000-0000-000000000123";

	let middeskRawResponse: GetBusinessEntityReview | null;
	let truliooBusinessResponse: any;

	const adverseMediaFactNames = FactUtils.getAllFactsThatDependOnFacts(["watchlist", "watchlist_raw", "screened_people", "adverse_media_hits"], kybFacts);
	const adverseMediaFacts = kybFacts.filter(fact => adverseMediaFactNames.includes(fact.name));

	beforeEach(() => {
		middeskRawResponse = null;
		truliooBusinessResponse = null;

		// Override the source getters for each test
		sources.middesk.getter = async () => middeskRawResponse;
		sources.business.getter = async () => truliooBusinessResponse;
		sources.person.getter = async () => null;
		// adverse_media_hits has two sources (business, adverseMediaDetails); mock DB source so tests control outcome
		sources.adverseMediaDetails.getter = async () => undefined;
	});

	describe("with Trulioo data", () => {
		it("should return 0 when no watchlist results exist", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: []
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when watchlist has only sanctions hits", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{
							listType: "SANCTIONS",
							listName: "OFAC SDN List",
							confidence: 0.95,
							matchDetails: "Test Business Match"
						},
						{
							listType: "SANCTIONS",
							listName: "EU Sanctions List",
							confidence: 0.90,
							matchDetails: "Another Match"
						}
					]
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when watchlist has only PEP hits", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{
							listType: "PEP",
							listName: "Politically Exposed Persons",
							confidence: 0.85,
							matchDetails: "PEP Match"
						}
					]
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should count adverse media hits correctly", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{
							listType: "ADVERSE_MEDIA",
							listName: "Negative News",
							confidence: 0.80,
							matchDetails: "Adverse media hit 1"
						},
						{
							listType: "ADVERSE_MEDIA",
							listName: "Risk News",
							confidence: 0.75,
							matchDetails: "Adverse media hit 2"
						}
					]
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(2);
		});

		it("should count only adverse media hits when mixed with other types", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{
							listType: "SANCTIONS",
							listName: "OFAC SDN List",
							confidence: 0.95,
							matchDetails: "Sanctions hit"
						},
						{
							listType: "ADVERSE_MEDIA",
							listName: "Negative News",
							confidence: 0.80,
							matchDetails: "Adverse media hit 1"
						},
						{
							listType: "PEP",
							listName: "Politically Exposed Persons",
							confidence: 0.85,
							matchDetails: "PEP hit"
						},
						{
							listType: "ADVERSE_MEDIA",
							listName: "Risk News",
							confidence: 0.75,
							matchDetails: "Adverse media hit 2"
						},
						{
							listType: "ADVERSE_MEDIA",
							listName: "Financial Crime News",
							confidence: 0.70,
							matchDetails: "Adverse media hit 3"
						}
					]
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			const watchlistHits = factEngine.getResolvedFact("watchlist_hits");

			expect(adverseMediaHits?.value).toBe(3);
			expect(watchlistHits?.value).toBe(2); // Only PEP + SANCTIONS (ADVERSE_MEDIA filtered out)
		});

		it("should handle lowercase listType correctly", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{
							listType: "adverse_media", // lowercase
							listName: "Negative News",
							confidence: 0.80,
							matchDetails: "Adverse media hit"
						}
					]
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(1);
		});

		it("should return 0 when clientData is missing", async () => {
			// Use non-empty object so source is mapped; clientData missing => no watchlistResults => count 0
			truliooBusinessResponse = { clientData: {} };

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when watchlistResults is null", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: null
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});
	});

	describe("with Middesk data", () => {
		it("adverse_media_hits does not use Middesk (only Trulioo + adverseMediaDetails)", async () => {
			middeskRawResponse = {
				reviewTasks: [
					{
						id: "task-1",
						key: "watchlist",
						category: "watchlist",
						status: "warning",
						message: "Watchlist hits found",
						label: "Watchlist",
						sublabel: "",
						metadata: [
							{
								id: "hit-1",
								type: "adverse_media",
								metadata: {
									abbr: "AM",
									title: "Adverse Media List",
									agency: "Media Monitoring",
									agency_abbr: "MM",
									entity_name: "Test Business"
								}
							},
							{
								id: "hit-2",
								type: "sanctions",
								metadata: {
									abbr: "OFAC",
									title: "OFAC SDN",
									agency: "OFAC",
									agency_abbr: "OFAC",
									entity_name: "Test Business"
								}
							},
							{
								id: "hit-3",
								type: "adverse_media",
								metadata: {
									abbr: "AM",
									title: "Risk News",
									agency: "News Monitor",
									agency_abbr: "NM",
									entity_name: "Test Business"
								}
							}
						]
					} as unknown as IBusinessEntityReviewTask
				]
			} as GetBusinessEntityReview;

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when Middesk has no watchlist task", async () => {
			middeskRawResponse = {
				reviewTasks: [
					{
						id: "task-1",
						key: "tin",
						category: "tin",
						status: "success",
						message: "TIN verified",
						label: "TIN",
						sublabel: "",
						metadata: null
					} as unknown as IBusinessEntityReviewTask
				]
			} as GetBusinessEntityReview;

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when Middesk watchlist has empty metadata", async () => {
			middeskRawResponse = {
				reviewTasks: [
					{
						id: "task-1",
						key: "watchlist",
						category: "watchlist",
						status: "success",
						message: "No watchlist hits",
						label: "Watchlist",
						sublabel: "",
						metadata: []
					} as unknown as IBusinessEntityReviewTask
				]
			} as GetBusinessEntityReview;

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});
	});

	describe("edge cases", () => {
		it("should return 0 when no sources have data", async () => {
			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should handle undefined listType gracefully", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{
							// listType is undefined
							listName: "Unknown List",
							confidence: 0.80,
							matchDetails: "Unknown hit"
						}
					]
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			// Should default to "sanctions" when listType is undefined, so adverse_media count is 0
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should handle OTHER listType correctly", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{
							listType: "OTHER",
							listName: "Other List",
							confidence: 0.80,
							matchDetails: "Other hit"
						},
						{
							listType: "ADVERSE_MEDIA",
							listName: "Adverse Media",
							confidence: 0.75,
							matchDetails: "Adverse hit"
						}
					]
				}
			};

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(1);
		});
	});

	describe("with adverseMediaDetails data", () => {
		it("should use total_risk_count when only adverseMediaDetails has data", async () => {
			truliooBusinessResponse = null;
			sources.adverseMediaDetails.getter = async () => ({
				records: [{ total_risk_count: 5, adverse_media_id: "id-1" }]
			});

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(5);
		});

		it("should use total_risk_count 0 when adverseMediaDetails has zero risk", async () => {
			truliooBusinessResponse = null;
			sources.adverseMediaDetails.getter = async () => ({
				records: [{ total_risk_count: 0, adverse_media_id: "id-1" }]
			});

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should use total_risk_count from latest record when multiple records exist", async () => {
			truliooBusinessResponse = null;
			sources.adverseMediaDetails.getter = async () => ({
				records: [
					{ total_risk_count: 10, adverse_media_id: "id-latest" },
					{ total_risk_count: 3, adverse_media_id: "id-older" }
				]
			});

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(10);
		});
	});

	describe("Trulioo and adverseMediaDetails interaction", () => {
		it("should prefer Trulioo when truliooRiskRule is applied and both sources have data", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [
						{ listType: "ADVERSE_MEDIA", listName: "News", matchDetails: "Hit 1" },
						{ listType: "ADVERSE_MEDIA", listName: "News", matchDetails: "Hit 2" }
					]
				}
			};
			sources.adverseMediaDetails.getter = async () => ({
				records: [{ total_risk_count: 7, adverse_media_id: "id-1" }]
			});

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			factEngine.addRuleOverride("adverse_media_hits", FactRules.truliooRiskRule);
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(2);
		});

		it("should pick one source by confidence/weight when no rule override (both have data)", async () => {
			truliooBusinessResponse = {
				clientData: {
					status: "COMPLETED",
					watchlistResults: [{ listType: "ADVERSE_MEDIA", listName: "News", matchDetails: "Hit" }]
				}
			};
			sources.adverseMediaDetails.getter = async () => ({
				records: [{ total_risk_count: 4, adverse_media_id: "id-1" }]
			});

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBeDefined();
			expect([1, 4]).toContain(adverseMediaHits?.value);
		});
	});

	describe("adverseMediaDetails edge cases", () => {
		it("should return 0 when adverseMediaDetails returns undefined", async () => {
			truliooBusinessResponse = null;
			sources.adverseMediaDetails.getter = async () => undefined;

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when adverseMediaDetails returns empty records array", async () => {
			truliooBusinessResponse = null;
			sources.adverseMediaDetails.getter = async () => ({ records: [] });

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when records exist but total_risk_count is missing", async () => {
			truliooBusinessResponse = null;
			sources.adverseMediaDetails.getter = async () => ({
				records: [{ adverse_media_id: "id-1" }]
			});

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when total_risk_count is not a number", async () => {
			truliooBusinessResponse = null;
			sources.adverseMediaDetails.getter = async () => ({
				records: [{ total_risk_count: "5" as any, adverse_media_id: "id-1" }]
			});

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});

		it("should return 0 when records is null or missing", async () => {
			truliooBusinessResponse = null;
			sources.adverseMediaDetails.getter = async () => ({ records: null } as any);

			factEngine = new FactEngine(adverseMediaFacts, { business: businessID });
			await factEngine.applyRules(FactRules.factWithHighestConfidence);

			const adverseMediaHits = factEngine.getResolvedFact("adverse_media_hits");
			expect(adverseMediaHits?.value).toBe(0);
		});
	});
});
