import { mapWatchlistHits, storeBusinessWatchlistResults, hasWatchlistHits, conditionallyScreenUBOs } from "../truliooWatchlist";
import { TruliooWatchlistHit } from "../../common/types";
import { TruliooUBOExtractor } from "../truliooUBOExtractor";
import { TruliooBase } from "../../common/truliooBase";
import { TruliooBusinessData, TruliooFlowResult } from "../../common/types";
import { WATCHLIST_ENTITY_TYPE } from "#lib/facts/kyb/types";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";

jest.mock("#helpers/knex", () => {
    const mockDb = jest.fn(() => ({
        insert: jest.fn().mockReturnThis(),
        onConflict: jest.fn().mockReturnThis(),
        merge: jest.fn(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn()
    }));
    (mockDb as any).raw = jest.fn((str) => str);
    return { db: mockDb };
});
jest.mock("#configs/index", () => ({
	envConfig: {
		SERVICE_MODE: "API"
	}
}));
jest.mock("#helpers/logger", () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock("../truliooUBOExtractor");
jest.mock("../../common/truliooBase");
jest.mock("#constants", () => ({
	INTEGRATION_ID: { TRULIOO: 38 },
	IDV_STATUS: {
		SUCCESS: 1,
		PENDING: 2,
		CANCELED: 3,
		EXPIRED: 4,
		FAILED: 99
	},
	SERVICE_MODES: {
		API: "API",
		JOB: "JOB",
		WORKER: "WORKER"
	},
	TASK_STATUS: {
		CREATED: "CREATED",
		INITIALIZED: "INITIALIZED",
		STARTED: "STARTED",
		IN_PROGRESS: "IN_PROGRESS",
		SUCCESS: "SUCCESS",
		FAILED: "FAILED",
		ERRORED: "ERRORED"
	},
	EVENTS: {
		FETCH_GIACT_VERIFICATION: "fetch-giact-verification"
	},
	INTEGRATION_CATEGORIES: {
		ACCOUNTING: 1,
		VERIFICATION: 2,
		BANKING: 3,
		TAXATION: 4,
		PUBLIC_RECORDS: 5,
		COMMERCE: 6,
		BUSINESS_ENTITY_VERIFICATION: 7,
		BUREAU: 8,
		MANUAL: 9,
		PAYMENTS: 10
	},
    SCORE_TRIGGER: {
        MANUAL_REFRESH: "MANUAL_REFRESH",
        ONBOARDING_INVITE: "ONBOARDING_INVITE"
    },
}));
jest.mock("../../utils/truliooFactory", () => ({
    TruliooFactory: { create: jest.fn(), createBusiness: jest.fn(), createPerson: jest.fn(), isSupportedType: jest.fn(), getSupportedTypes: jest.fn() }
}));
jest.mock("../truliooBusiness");

describe("truliooWatchlist", () => {
    const mockBusinessEntityVerificationId = "test-verification-id-123" as any;
    const mockBusinessName = "Test Business Inc";

    const setupMockDbForQuery = (firstValue: any) => {
        const mockWhere = jest.fn().mockReturnThis();
        const mockFirst = jest.fn().mockResolvedValue(firstValue);
        (db as unknown as jest.Mock).mockReturnValue({ where: mockWhere, first: mockFirst });
        return { mockWhere, mockFirst };
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("mapWatchlistHits", () => {
        it.each([
            ["OFAC", "SANCTIONS", "Specially Designated Nationals", "Test Business Inc", "sanctions", "Office of Foreign Assets Control", "OFAC"],
            ["BIS", "SANCTIONS", "Entity List", "Test Company Ltd", "sanctions", "Bureau of Industry and Security", "BIS"],
            ["PEP", "PEP", "Politically Exposed Persons List", "John Doe", "pep", "Politically Exposed Persons", "PEP"],
            ["State Department", "SANCTIONS", "ITAR Debarred", "Test Corp", "sanctions", "State Department", "DOS"],
            ["Unknown", "OTHER", "Unknown List", "Test Business", "other", "Unknown Agency", "UNKNOWN"]
        ])("should map %s hit correctly", (_, listType, listName, entityName, expectedType, expectedAgency, expectedAbbr) => {
            const results = mapWatchlistHits([{ listType: listType as any, listName, confidence: 0.9, matchDetails: "Match found" }], entityName);
            expect(results[0]).toMatchObject({ type: expectedType, entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS, metadata: { title: listName, agency: expectedAgency, agency_abbr: expectedAbbr, entity_name: entityName } });
            expect(results[0].id).toBeDefined();
        });

        it("should always set entity_type to BUSINESS for all mapped hits", () => {
            const results = mapWatchlistHits([
                { listType: "SANCTIONS", listName: "SDN List", confidence: 0.9, matchDetails: "Match 1" },
                { listType: "PEP", listName: "PEP List", confidence: 0.85, matchDetails: "Match 2" }
            ], "Test Business");
            expect(results).toHaveLength(2);
            results.forEach(hit => {
                expect(hit.entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
            });
        });

        it("should map array of hits correctly", () => {
            const results = mapWatchlistHits([
                { listType: "SANCTIONS", listName: "SDN List", confidence: 0.9, matchDetails: "Match 1" },
                { listType: "PEP", listName: "PEP List", confidence: 0.85, matchDetails: "Match 2" }
            ], "Test Business");
            expect(results).toHaveLength(2);
            expect(results[0].metadata.title).toBe("SDN List");
            expect(results[1].metadata.title).toBe("PEP List");
        });

        it("should handle empty array", () => {
            expect(mapWatchlistHits([], "Test Business")).toHaveLength(0);
        });

        it("should use sourceAgencyName over mapped agency and truncate abbr to 10 chars", () => {
            const hit: TruliooWatchlistHit = {
                listType: "SANCTIONS",
                listName: "Some List",
                confidence: 0.9,
                matchDetails: "Match",
                sourceAgencyName: "Very Long Agency Name That Exceeds Limit"
            };
            const results = mapWatchlistHits([hit], "Business");
            expect(results[0].metadata.agency).toBe("Very Long Agency Name That Exceeds Limit");
            expect(results[0].metadata.agency_abbr.length).toBeLessThanOrEqual(10);
        });

        it("should default url, list_country, list_region to null when absent", () => {
            const results = mapWatchlistHits([{
                listType: "SANCTIONS", listName: "SDN", confidence: 0.9, matchDetails: "M"
            }], "Biz");
            expect(results[0].url).toBeNull();
            expect(results[0].list_country).toBeNull();
            expect(results[0].list_region).toBeNull();
        });

        it("should preserve url, list_country, list_region when provided", () => {
            const results = mapWatchlistHits([{
                listType: "SANCTIONS", listName: "SDN", confidence: 0.9, matchDetails: "M",
                url: "https://example.com", listCountry: "US", sourceRegion: "North America"
            }], "Biz");
            expect(results[0].url).toBe("https://example.com");
            expect(results[0].list_country).toBe("US");
            expect(results[0].list_region).toBe("North America");
        });
    });

    describe("storeBusinessWatchlistResults", () => {
        const setupMockDb = () => {
            const mockInsert = jest.fn().mockReturnThis();
            const mockOnConflict = jest.fn().mockReturnThis();
            const mockMerge = jest.fn().mockResolvedValue([{ id: "test-id" }]);
            (db as unknown as jest.Mock).mockReturnValue({
                insert: mockInsert,
                onConflict: mockOnConflict,
                merge: mockMerge
            });
            return { mockInsert, mockOnConflict, mockMerge };
        };

        it("should store watchlist results with hits", async () => {
            const { mockInsert, mockOnConflict } = setupMockDb();
            await storeBusinessWatchlistResults(mockBusinessEntityVerificationId, mockBusinessName, [{
                listType: "SANCTIONS", listName: "SDN List", confidence: 0.9, matchDetails: "Match found"
            }]);
            expect(db).toHaveBeenCalledWith("integration_data.business_entity_review_task");
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
                business_entity_verification_id: mockBusinessEntityVerificationId,
                key: "watchlist", status: "warning", sublabel: "1 hit(s) found"
            }));
            expect(mockOnConflict).toHaveBeenCalledWith(["business_entity_verification_id", "key"]);
        });

        it("should store empty watchlist result when no hits", async () => {
            const { mockInsert } = setupMockDb();
            await storeBusinessWatchlistResults(mockBusinessEntityVerificationId, mockBusinessName, []);
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
                status: "success", message: "No watchlist hits found", sublabel: "No hits found"
            }));
        });

        it("should handle storage errors gracefully", async () => {
            const { mockMerge } = setupMockDb();
            (mockMerge as jest.Mock).mockRejectedValue(new Error("Database error"));
            await expect(storeBusinessWatchlistResults(mockBusinessEntityVerificationId, mockBusinessName, [{
                listType: "SANCTIONS", listName: "SDN List", confidence: 0.9, matchDetails: "Match"
            }])).rejects.toThrow("Database error");
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("hasWatchlistHits", () => {
        it("should return true when hits exist", async () => {
            const { mockWhere } = setupMockDbForQuery({ metadata: [{ id: "hit-1", type: "sanctions" }] });
            const result = await hasWatchlistHits(mockBusinessEntityVerificationId);
            expect(result).toBe(true);
            expect(mockWhere).toHaveBeenCalledWith({
                business_entity_verification_id: mockBusinessEntityVerificationId,
                key: "watchlist"
            });
        });

        it.each([
            ["no hits", { metadata: [] }],
            ["no review task", undefined]
        ])("should return false when %s", async (_, firstValue) => {
            setupMockDbForQuery(firstValue);
            expect(await hasWatchlistHits(mockBusinessEntityVerificationId)).toBe(false);
        });

        it("should handle errors gracefully and return false", async () => {
            const mockWhere = jest.fn().mockReturnThis();
            const mockFirst = jest.fn().mockRejectedValue(new Error("Database error"));
            (db as unknown as jest.Mock).mockReturnValue({ where: mockWhere, first: mockFirst });
            expect(await hasWatchlistHits(mockBusinessEntityVerificationId)).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("conditionallyScreenUBOs", () => {
        const mockBusinessId = "test-business-123";
        const mockBusinessData: TruliooBusinessData = { name: "Test Business Inc", country: "GB", ubos: [{ fullName: "John Doe", firstName: "John", lastName: "Doe", dateOfBirth: "1990-01-01" }] };
        const mockFlowResult: TruliooFlowResult = { hfSession: "test-session-123", clientData: { businessData: mockBusinessData } };
        const setupUBOTest = (hasHits: boolean, shouldFail = false) => {
            setupMockDbForQuery(hasHits ? { metadata: [{ id: "hit-1", type: "sanctions" }] } : { metadata: [] });
            const mockUBOExtractor = { extractAndScreenUBOsDirectors: jest.fn().mockResolvedValue(shouldFail ? Promise.reject(new Error("Screening failed")) : [{ fullName: "John Doe", screeningStatus: "completed" as const }]) };
            (TruliooBase as unknown as jest.Mock).mockImplementation(() => ({} as any));
            (TruliooUBOExtractor as jest.MockedClass<typeof TruliooUBOExtractor>).mockImplementation(() => mockUBOExtractor as any);
            return mockUBOExtractor;
        };

        it("should screen UBOs when watchlist hits are found", async () => {
            const mockUBOExtractor = setupUBOTest(true);
            await conditionallyScreenUBOs(mockBusinessEntityVerificationId, mockBusinessId, mockBusinessData, mockFlowResult);
            expect(mockUBOExtractor.extractAndScreenUBOsDirectors).toHaveBeenCalledWith(mockBusinessEntityVerificationId, mockBusinessData, mockFlowResult);
        });

        it("should skip UBO screening when no watchlist hits are found", async () => {
            setupUBOTest(false);
            await conditionallyScreenUBOs(mockBusinessEntityVerificationId, mockBusinessId, mockBusinessData, mockFlowResult);
            expect(TruliooUBOExtractor).not.toHaveBeenCalled();
        });

        it("should handle errors gracefully without failing", async () => {
            setupUBOTest(true, true);
            await expect(conditionallyScreenUBOs(mockBusinessEntityVerificationId, mockBusinessId, mockBusinessData, mockFlowResult)).resolves.not.toThrow();
        });
    });
});
