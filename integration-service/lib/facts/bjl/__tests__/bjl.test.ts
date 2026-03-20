import { FactEngine } from "../../factEngine";
import { convertAgeToDate } from "#lib/equifax/util";
import { FactRules, FactUtils } from "#lib/facts";
import { bjlFacts } from "..";
import { sources } from "#lib/facts/sources";

import type { EquifaxCombined } from "#lib/equifax/types";
import type { Record as VerdataRecord } from "#lib/verdata/types";
import type { Bankruptcy, Judgement, Lien } from "../types";
import { VerdataUtil } from "#lib/verdata/verdataUtil";

describe("bjl tests", () => {
	let factEngine: FactEngine;
	const businessID = "00000000-0000-0000-0000-000000000123";

	let equifaxResponse: Partial<EquifaxCombined>;
	let verdataResponse: Partial<VerdataRecord>;

	const bjlFactNames = FactUtils.getAllFactsThatDependOnFacts(["bankruptcies", "judgements", "liens"], bjlFacts);

	beforeEach(() => {
		/* Override these as appropriate per test */
		equifaxResponse = {
			// Partial just bjl crap
			efxbma_extract_date: "05/10/2025",
			efxbma_pubrec_age_pr: 999,
			efxbma_pubrec_age_bkp: 999,
			efxbma_pubrec_bkp_ind: 1,
			efxbma_pubrec_age_judg: 999,
			efxbma_pubrec_age_lien: 999,
			efxbma_pubrec_judg_ind: 1,
			efxbma_pubrec_lien_ind: 1,
			efxbma_pubrec_status_fi: 0,
			efxbma_pubrec_status_ju: 99
		};
		verdataResponse = {
			blj: [
				{
					liens: [],
					bankruptcies: [],
					judgements: [],
					corp_filing: [],
					uccs: [],
					merchant: {},
					locations: [],
					principals: [],
					watchlists: [],
					summary: {}
				},
				{
					liens: [
						{
							id: "f54cf79c-ac6f-46c8-89d4-d7bbf1e21003",
							status: null,
							created_at: new Date("2025-06-24T21:07:37.262676Z"),
							updated_at: new Date("2025-06-24T21:07:37.267857Z"),
							debtor_city: "Altoona",
							debtor_zip4: "2205",
							debtor_zip5: "54720",
							filing_date: "2012-02-09",
							lien_amount: 851,
							status_date: null,
							debtor_addr1: "3404 Pleasant St",
							debtor_state: "WI",
							transunion_business: "964c7dff-9c22-477a-a175-b2320002229f",
							debtor_business_name: "JOB ENTERPRISES LLC",
							debtor_business_token: "B-D72P-463C"
						}
					],
					bankruptcies: [],
					judgements: [],
					corp_filing: [],
					uccs: [],
					merchant: {},
					locations: [],
					principals: [],
					watchlists: []
				}
			]
		} as unknown as Partial<VerdataRecord>;

		/* Override the source getters for each test to just return the mock response */
		sources.verdataRaw.getter = async () => verdataResponse;
		sources.verdataRaw.confidence = 0.8;
		sources.equifax.getter = async () => equifaxResponse;
		sources.equifax.confidence = 0.85;
	});

	it("should calculate bankruptcies as 0 when Equifax bankruptcy indicator is 0", async () => {
		equifaxResponse.efxbma_pubrec_bkp_ind = 0;
		factEngine = new FactEngine(bjlFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual({
			count: 0,
			most_recent: null,
			most_recent_status: null
		});
	});
	it("should calculate bankruptcies as 1 when Equifax bankruptcy indicator is 1", async () => {
		// Just making sure we can handle a numeric string even though we don't have it typed that way :)
		equifaxResponse.efxbma_pubrec_bkp_ind = "1" as unknown as number;
		equifaxResponse.efxbma_pubrec_age_bkp = 100;

		const date100DaysAgo = convertAgeToDate(100, equifaxResponse.efxbma_extract_date as string);

		factEngine = new FactEngine(bjlFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual({
			count: 1,
			most_recent: date100DaysAgo,
			most_recent_status: "active"
		});
	});
	it("should use verdata when efx is 99 and verdata is not null", async () => {
		equifaxResponse.efxbma_pubrec_bkp_ind = 99;
		verdataResponse.blj = [
			{
				bankruptcies: [
					{
						filing_date: "2025-01-01",
						status: "active"
					}
				],
				summary: {
					bankruptcy_subject_count: 1,
					bankruptcy_debtor_count: 1
				}
			}
		] as unknown as Partial<VerdataRecord>["blj"];
		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual({
			count: 1,
			most_recent: new Date("2025-01-01"),
			most_recent_status: "active"
		});
	});

	it("should calculate judgements as 0 when Equifax judgement count is 0", async () => {
		equifaxResponse.efxbma_pubrec_status_ju = 0;
		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const judgements = await factEngine.getResolvedFact("judgements");
		const expectedJudgement: Judgement = {
			count: 0,
			most_recent: null,
			most_recent_status: null,
			most_recent_amount: null,
			total_judgement_amount: null
		};
		expect(judgements?.value).toEqual(expectedJudgement);
	});

	it("should calculate judgements as 2 when Equifax judgement count is 2", async () => {
		equifaxResponse.efxbma_pubrec_status_ju = 2;
		equifaxResponse.efxbma_pubrec_age_judg = 100;
		equifaxResponse.efxbma_pubrec_total_cur_liab_judg = 100;
		const date100DaysAgo = convertAgeToDate(100, equifaxResponse.efxbma_extract_date as string);

		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const judgements = await factEngine.getResolvedFact("judgements");
		const expectedJudgement: Judgement = {
			count: 2,
			most_recent: date100DaysAgo,
			most_recent_status: "unknown",
			most_recent_amount: null,
			total_judgement_amount: 100
		};
		expect(judgements?.value).toEqual(expectedJudgement);
	});

	it("should calculate liens as 0 when Equifax lien count is 0", async () => {
		equifaxResponse.efxbma_pubrec_status_fi = 0;
		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const liens = await factEngine.getResolvedFact("liens");
		const expectedLien: Lien = {
			count: 0,
			most_recent: null,
			most_recent_status: null,
			most_recent_amount: null,
			total_open_lien_amount: null
		};
		expect(liens?.value).toEqual(expectedLien);
	});

	it("should calculate liens as 5 when Equifax lien count is 5", async () => {
		equifaxResponse.efxbma_pubrec_status_fi = 5;
		equifaxResponse.efxbma_pubrec_total_cur_liab_lien = 5;
		equifaxResponse.efxbma_pubrec_age_lien = 100;
		const date100DaysAgo = convertAgeToDate(100, equifaxResponse.efxbma_extract_date as string);
		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		const liens = await factEngine.getResolvedFact("liens");
		const expectedLien: Lien = {
			count: 5,
			most_recent: date100DaysAgo,
			most_recent_status: "active",
			most_recent_amount: null,
			total_open_lien_amount: 5
		};
		expect(liens?.value).toEqual(expectedLien);
	});

	it("should convert ThirdPartyData shape to BLJ shape", async () => {
		const convertThirdPartyToBLJSpy = jest.spyOn(VerdataUtil, "convertThirdPartyToBLJ");

		equifaxResponse.efxbma_pubrec_bkp_ind = 99;
		equifaxResponse.efxbma_pubrec_status_fi = 99;
		equifaxResponse.efxbma_pubrec_status_ju = 99;

		verdataResponse.blj = [] as Partial<VerdataRecord>["blj"];
		verdataResponse.ThirdPartyData = [
			{
				BUS_BANKRUPTCY_SUMMARY_001: 2,
				BUS_BANKRUPTCY_SUMMARY_002: "1/1/2025",
				BUS_BANKRUPTCY_SUMMARY_003: 11,
				BUS_BANKRUPTCY_SUMMARY_004: true,
				BUS_BANKRUPTCY_SUMMARY_005: "active",
				BUS_BANKRUPTCY_SUMMARY_006: "1/1/2025",
				BUS_JUDGEMENT_SUMMARY_001: 3,
				BUS_JUDGEMENT_SUMMARY_002: "2/2/2025",
				BUS_JUDGEMENT_SUMMARY_003: "active",
				BUS_JUDGEMENT_SUMMARY_004: "1/1/2025",
				BUS_JUDGEMENT_SUMMARY_005: 1000,
				BUS_LIENS_SUMMARY_001: 4,
				BUS_LIENS_SUMMARY_002: "3/3/2025",
				BUS_LIENS_SUMMARY_003: "active",
				BUS_LIENS_SUMMARY_004: "1/1/2025",
				CORP_FILING_001: "Test Corp",
				CORP_FILING_002: "1/1/2025",
				CORP_FILING_003: "WI",
				CORP_FILING_004: "",
				CORP_FILING_005: "",
				CORP_FILING_006: "",
				CORP_FILING_007: "1/1/2025"
			}
		];
		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const expectedBankruptcy: Bankruptcy = {
			count: 2,
			most_recent: new Date("2025-01-01"),
			most_recent_status: "active"
		};
		const expectedJudgement: Judgement = {
			count: 3,
			most_recent: new Date("2025-02-02"),
			most_recent_status: "active",
			most_recent_amount: 1000,
			total_judgement_amount: 1000
		};
		const expectedLien: Lien = {
			count: 4,
			most_recent: new Date("2025-03-03"),
			most_recent_status: "active",
			most_recent_amount: null,
			total_open_lien_amount: null
		};

		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual(expectedBankruptcy);
		const judgements = await factEngine.getResolvedFact("judgements");
		expect(judgements?.value).toEqual(expectedJudgement);
		const liens = await factEngine.getResolvedFact("liens");
		expect(liens?.value).toEqual(expectedLien);

		expect(convertThirdPartyToBLJSpy).toHaveBeenCalled();
	});
	it("should work when Verdata BJL data is not an array", async () => {
		// Spy on VerdataUtil
		const convertThirdPartyToBLJSpy = jest.spyOn(VerdataUtil, "convertThirdPartyToBLJ");

		equifaxResponse = null as unknown as Partial<EquifaxCombined>;

		verdataResponse.blj = {
			liens: [{ filing_date: "2025-03-03", status: "active" }],
			bankruptcies: [{ filing_date: "2025-01-01", status: "active" }],
			judgements: [{ filing_date: "2025-02-02", status: "active", amount: 1000 }],
			corp_filing: [],
			uccs: [],
			merchant: {},
			locations: [],
			principals: [],
			watchlists: [],
			summary: {
				id: "123",
				bankruptcy_subject_count: null,
				bankruptcy_creditor_count: null,
				judgement_debtor_count: null,
				lien_debtor_count: null
			}
		} as unknown as Partial<VerdataRecord>["blj"];
		//verdataResponse.ThirdPartyData = [];
		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const expectedBankruptcy = undefined;
		const expectedJudgement = undefined;
		const expectedLien = undefined;

		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual(expectedBankruptcy);
		const judgements = await factEngine.getResolvedFact("judgements");
		expect(judgements?.value).toEqual(expectedJudgement);
		const liens = await factEngine.getResolvedFact("liens");
		expect(liens?.value).toEqual(expectedLien);

		expect(convertThirdPartyToBLJSpy).not.toHaveBeenCalled();
	});
	it("should handle Verdata Liens", async () => {
		// Spy on VerdataUtil
		const convertThirdPartyToBLJSpy = jest.spyOn(VerdataUtil, "convertThirdPartyToBLJ");

		equifaxResponse = null as unknown as Partial<EquifaxCombined>;

		verdataResponse.blj = {
			liens: [
				{ filing_date: "2025-03-01", status: "active", lien_amount: 1000 },
				{ filing_date: "2025-03-10", status: "active", lien_amount: 2000 }
			],
			bankruptcies: [],
			judgements: [],
			corp_filing: [],
			uccs: [],
			merchant: {},
			locations: [],
			principals: [],
			watchlists: [],
			summary: {
				id: "123",
				bankruptcy_subject_count: null,
				bankruptcy_creditor_count: null,
				judgement_debtor_count: null,
				lien_debtor_count: 1
			}
		} as unknown as Partial<VerdataRecord>["blj"];
		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const expectedBankruptcy = undefined;
		const expectedJudgement = undefined;
		const expectedLien: Lien = {
			count: 2,
			most_recent: new Date("2025-03-10"),
			most_recent_status: "active",
			most_recent_amount: 2000,
			total_open_lien_amount: 3000
		};

		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual(expectedBankruptcy);
		const judgements = await factEngine.getResolvedFact("judgements");
		expect(judgements?.value).toEqual(expectedJudgement);
		const liens = await factEngine.getResolvedFact("liens");
		expect(liens?.value).toEqual(expectedLien);

		expect(convertThirdPartyToBLJSpy).not.toHaveBeenCalled();
	});
	it("should handle Verdata Bankruptcies", async () => {
		equifaxResponse = null as unknown as Partial<EquifaxCombined>;

		verdataResponse.blj = {
			liens: [],
			bankruptcies: [
				{ filing_date: "2025-03-01", status: "active" },
				{ filing_date: "2025-03-10", status: "withdrawn" }
			],
			judgements: [],
			corp_filing: [],
			uccs: [],
			merchant: {},
			locations: [],
			principals: [],
			watchlists: [],
			summary: {
				id: "123",
				bankruptcy_subject_count: 1,
				bankruptcy_creditor_count: null,
				judgement_debtor_count: null,
				lien_debtor_count: null
			}
		} as unknown as Partial<VerdataRecord>["blj"];

		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const expectedBankruptcy: Bankruptcy = {
			count: 2,
			most_recent: new Date("2025-03-10"),
			most_recent_status: "withdrawn"
		};
		const expectedJudgement = undefined;
		const expectedLien = undefined;

		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual(expectedBankruptcy);
		const judgements = await factEngine.getResolvedFact("judgements");
		expect(judgements?.value).toEqual(expectedJudgement);
		const liens = await factEngine.getResolvedFact("liens");
		expect(liens?.value).toEqual(expectedLien);
	});
	it("should handle Verdata Judgements", async () => {
		equifaxResponse = null as unknown as Partial<EquifaxCombined>;

		verdataResponse.blj = {
			liens: [],
			bankruptcies: [],
			judgements: [
				{ filing_date: "2025-03-01", status: "active", amount_awarded: 10 },
				{ filing_date: "2025-03-10", status: "withdrawn", amount_awarded: 90 }
			],
			corp_filing: [],
			uccs: [],
			merchant: {},
			locations: [],
			principals: [],
			watchlists: [],
			summary: {
				id: "123",
				bankruptcy_subject_count: null,
				bankruptcy_creditor_count: null,
				judgement_debtor_count: 1,
				lien_debtor_count: null
			}
		} as unknown as Partial<VerdataRecord>["blj"];

		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const expectedJudgement: Judgement = {
			count: 2,
			most_recent: new Date("2025-03-10"),
			most_recent_status: "withdrawn",
			most_recent_amount: 90,
			total_judgement_amount: 100
		};
		const expectedBankruptcy = undefined;
		const expectedLien = undefined;

		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual(expectedBankruptcy);
		const judgements = await factEngine.getResolvedFact("judgements");
		expect(judgements?.value).toEqual(expectedJudgement);
		const liens = await factEngine.getResolvedFact("liens");
		expect(liens?.value).toEqual(expectedLien);
	});

	it.only("when similar confidence, prefer verdata", async () => {
		equifaxResponse.efxbma_pubrec_bkp_ind = 1;
		equifaxResponse.efxbma_pubrec_status_fi = 5;
		equifaxResponse.efxbma_pubrec_status_ju = 5;

		verdataResponse.blj = {
			liens: [
				{ filing_date: "2025-03-01", status: "active", lien_amount: 1000 },
				{ filing_date: "2025-03-10", status: "active", lien_amount: 2000 }
			],
			bankruptcies: [
				{ filing_date: "2025-03-01", status: "active", most_recent: new Date("2025-03-01") },
				{ filing_date: "2025-03-10", status: "withdrawn", most_recent: new Date("2025-03-10") }
			],
			judgements: [
				{ filing_date: "2025-03-01", status: "active", amount_awarded: 10 },
				{ filing_date: "2025-03-10", status: "withdrawn", amount_awarded: 90 }
			],
			corp_filing: [],
			uccs: [],
			merchant: {},
			locations: [],
			principals: [],
			watchlists: [],
			summary: {
				id: "123",
				bankruptcy_subject_count: 2,
				bankruptcy_creditor_count: 0,
				judgement_debtor_count: 2,
				lien_debtor_count: 2
			}
		} as unknown as Partial<VerdataRecord>["blj"];

		factEngine = new FactEngine(bjlFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const expectedJudgement: Judgement = {
			count: 2,
			most_recent: new Date("2025-03-10"),
			most_recent_status: "withdrawn",
			most_recent_amount: 90,
			total_judgement_amount: 100
		};
		const expectedBankruptcy = { count: 2, most_recent: new Date("2025-03-10"), most_recent_status: "withdrawn" };
		const expectedLien = {
			count: 2,
			most_recent: new Date("2025-03-10"),
			most_recent_status: "active",
			most_recent_amount: 2000,
			total_open_lien_amount: 3000
		};

		const bankruptcies = await factEngine.getResolvedFact("bankruptcies");
		expect(bankruptcies?.value).toEqual(expectedBankruptcy);
		const judgements = await factEngine.getResolvedFact("judgements");
		expect(judgements?.value).toEqual(expectedJudgement);
		const liens = await factEngine.getResolvedFact("liens");
		expect(liens?.value).toEqual(expectedLien);
	});
});
