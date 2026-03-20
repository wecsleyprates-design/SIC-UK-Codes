import type { AINaicsEnrichmentResponse } from "#lib/aiEnrichment/aiNaicsEnrichment.js";
import { FactEngine, FactRules, FactUtils } from "#lib/facts";
import { sources } from "#lib/facts/sources";
import type { Fact } from "#lib/facts/types";

jest.mock("#helpers/api", () => ({
	__esModule: true,
	internalGetNaicsCode: jest.fn(),
	internalGetMccCode: jest.fn(),
	internalGetIndustries: jest.fn()
}));

import { businessFacts } from "../index";
import * as Api from "#helpers/api";

const mockInternalGetNaicsCode = Api.internalGetNaicsCode as jest.Mock;
const mockInternalGetMccCode = Api.internalGetMccCode as jest.Mock;

describe("mcc_code", () => {
	let factEngine: FactEngine;
	const businessID = "00000000-0000-0000-0000-000000000123";

	let aiNaics: Partial<AINaicsEnrichmentResponse>;

	const mccCodeFactNames = FactUtils.getAllFactsThatDependOnFacts(
		["mcc_code", "mcc_code_found", "mcc_code_from_naics", "naics_code"],
		businessFacts as Fact[]
	);
	const mccFacts = businessFacts.filter(fact => mccCodeFactNames.includes(fact.name));

	beforeEach(() => {
		/* Override these as appropriate per test 	*/
		aiNaics = {
			naics_code: "567890",
			naics_description: "Test NAICS Description",
			mcc_code: "1234",
			mcc_description: "Test MCC Description",
			confidence: "HIGH"
		};

		sources.manual.getter = async () => {};
		sources.AINaicsEnrichment.getter = async () => Promise.resolve({ response: aiNaics });
		sources.businessDetails.getter = async () => {};
		sources.zoominfo.getter = async () => {};
	});
	afterEach(() => {
		jest.clearAllMocks();
	});

	it("should return AI-inferred mcc code when only that is available", async () => {
		factEngine = new FactEngine(mccFacts, { business: businessID });
		mockInternalGetMccCode.mockResolvedValueOnce([]);
		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		await factEngine.getResults();
		const mccFact = await factEngine.getResolvedFact("mcc_code");
		const mccCodeFoundFact = await factEngine.getResolvedFact("mcc_code_found");
		const mccCodeFromNaicsFact = await factEngine.getResolvedFact("mcc_code_from_naics");
		expect(mccFact?.value).toBe(aiNaics.mcc_code);
		expect(mccCodeFoundFact?.value).toBe(aiNaics.mcc_code);
		expect(mccCodeFromNaicsFact?.value).toBeUndefined();
	});
	it("should return NAICS-inferred mcc code when only that is available", async () => {
		const naicsCode: string = "678901";
		const mccCode: string = "4444";
		sources.AINaicsEnrichment.getter = async () => {};
		sources.businessDetails.getter = async () => ({
			naics_code: naicsCode
		});
		mockInternalGetMccCode.mockResolvedValue([{ mcc_code: "9999", mcc_description: "Test MCC Description" }]);
		mockInternalGetNaicsCode.mockResolvedValue([
			{
				naics_code: naicsCode,
				naics_label: "Test NAICS Description",
				mcc_code: mccCode,
				mcc_label: "Test MCC Description"
			}
		]);
		factEngine = new FactEngine(mccFacts, { business: businessID });

		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		await factEngine.getResults();
		const mccFact = await factEngine.getResolvedFact("mcc_code");
		const mccCodeFoundFact = await factEngine.getResolvedFact("mcc_code_found");
		const mccCodeFromNaicsFact = await factEngine.getResolvedFact("mcc_code_from_naics");
		const naicsCodeFact = await factEngine.getResolvedFact("naics_code");

		expect(mockInternalGetNaicsCode).toHaveBeenCalled();
		expect(mockInternalGetNaicsCode).toHaveBeenCalledWith(naicsCode);
		expect(mockInternalGetMccCode).toHaveBeenCalled();
		expect(mockInternalGetMccCode).toHaveBeenCalledWith(mccCode);

		expect(naicsCodeFact?.value).toBe(naicsCode);
		expect(mccCodeFromNaicsFact?.value).toBe(mccCode);
		expect(mccFact?.value).toBe(mccCode);
		expect(mccCodeFoundFact?.value).toBeUndefined();
	});
	it("should return AI-inferred mcc code when both are available", async () => {
		const naicsCode: string = "678901";
		const internalMccCode: string = "4444";
		sources.businessDetails.getter = async () => ({
			naics_code: naicsCode
		});
		mockInternalGetMccCode.mockResolvedValue([{ mcc_code: "9999", mcc_description: "Test MCC Description" }]);
		mockInternalGetNaicsCode.mockResolvedValue([
			{
				naics_code: naicsCode,
				naics_label: "Test NAICS Description",
				mcc_code: internalMccCode,
				mcc_label: "Test MCC Description"
			}
		]);
		factEngine = new FactEngine(mccFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		await factEngine.getResults();
		const mccFact = await factEngine.getResolvedFact("mcc_code");
		const mccCodeFoundFact = await factEngine.getResolvedFact("mcc_code_found");
		const mccCodeFromNaicsFact = await factEngine.getResolvedFact("mcc_code_from_naics");
		expect(mccFact?.value).toBe(aiNaics.mcc_code);
		expect(mccCodeFoundFact?.value).toBe(aiNaics.mcc_code);
		expect(mccCodeFromNaicsFact?.value).toBe(internalMccCode);
	});
});
