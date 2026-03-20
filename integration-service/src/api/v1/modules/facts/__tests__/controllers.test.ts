import type { NextFunction, Request } from "express";
import type { Response } from "#types/index";

// ── Mocks ─────────────────────────────────────────────────────────────

// Make catchAsync transparent so the inner handler is directly awaitable
jest.mock("#utils/catchAsync", () => ({
	catchAsync: (fn: Function) => fn
}));

const mockGetResults = jest.fn();
const mockApplyRules = jest.fn();
const mockAddRuleOverride = jest.fn();

jest.mock("#lib/facts/factEngine", () => ({
	FactEngine: jest.fn().mockImplementation(() => ({
		getResults: mockGetResults,
		applyRules: mockApplyRules,
		addRuleOverride: mockAddRuleOverride
	})),
	DEFAULT_FACT_WEIGHT: 1
}));

jest.mock("#lib/facts/rules", () => ({
	combineFacts: jest.fn(),
	factWithHighestConfidence: jest.fn(),
	combineWatchlistMetadata: jest.fn(),
	manualOverride: jest.fn()
}));

jest.mock("#lib/facts/kyb", () => ({ kybFacts: [] }));
jest.mock("#lib/facts/kyb/ca", () => ({ facts: [] }));
jest.mock("#lib/facts/kyc", () => ({ kycFacts: [] }));
jest.mock("#lib/facts/businessDetails", () => ({ businessFacts: [] }));
jest.mock("#lib/facts/processingHistory", () => ({ processingHistoryFacts: [] }));
jest.mock("#lib/facts/bjl", () => ({ bjlFacts: [] }));
jest.mock("#lib/facts/reviews", () => ({ reviewFacts: [] }));
jest.mock("#lib/facts/financials/financials", () => ({ financialFacts: [] }));
jest.mock("#lib/facts/matches/matches", () => ({ matchingFacts: [] }));
jest.mock("#lib/facts", () => ({
	allFacts: [],
	FactEngineWithDefaultOverrides: jest.fn().mockImplementation(() => ({
		getResults: mockGetResults,
		applyRules: mockApplyRules,
		addRuleOverride: mockAddRuleOverride
	}))
}));

jest.mock("#helpers/api", () => ({
	getApplicationEdit: jest.fn().mockResolvedValue({ data: [] })
}));

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn()
	}
}));

jest.mock("#helpers", () => ({
	getOrCreateConnection: jest.fn()
}));

jest.mock("#middlewares/cache.middleware", () => ({
	invalidateBusinessCache: jest.fn()
}));

jest.mock("#constants", () => ({
	INTEGRATION_ID: { VERDATA: 99, MANUAL: 100 },
	ROLES: { ADMIN: "admin" },
	kafkaTopics: {}
}));

jest.mock("#lib/manual/manualIntegration", () => ({
	ManualIntegration: jest.fn()
}));

// Import controller AFTER mocks are set up
import { controller } from "../controllers";

// ── Helpers ───────────────────────────────────────────────────────────

function makeMockReqResNext(businessID = "00000000-0000-0000-0000-000000000001") {
	const req = { params: { businessID }, query: {} } as unknown as Request;
	const cacheOutput: Record<string, unknown> = {};
	const res = {
		locals: {
			user: { role: { code: "admin" } },
			cacheOutput
		},
		jsend: { success: jest.fn() }
	} as unknown as Response;
	const next = jest.fn() as NextFunction;
	return { req, res, next, cacheOutput: res.locals as { cacheOutput: Record<string, unknown> } };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("controller.getBusinessKybDetails — watchlist facts", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should pass through FactEngine watchlist results without controller-level modification", async () => {
		const consolidatedMetadata = Array.from({ length: 7 }, (_, i) => ({
			type: "sanction",
			metadata: { title: `Hit ${i}`, entity_name: `Entity ${i}` },
			url: `https://example.com/${i}`
		}));

		mockGetResults.mockResolvedValue({
			watchlist: {
				value: { metadata: consolidatedMetadata }
			},
			watchlist_hits: {
				value: 7
			}
		});

		const { req, res, next, cacheOutput } = makeMockReqResNext();
		await controller.getBusinessKybDetails(req, res, next);

		const data = cacheOutput.cacheOutput?.data as Record<string, any>;
		expect(data.watchlist.value.metadata).toHaveLength(7);
		expect(data.watchlist_hits.value).toBe(7);
	});

	it("should apply combineWatchlistMetadata rule override for watchlist_raw", async () => {
		mockGetResults.mockResolvedValue({
			watchlist: { value: { metadata: [], message: "No Watchlist hits were identified" } },
			watchlist_hits: { value: 0 }
		});

		const { req, res, next } = makeMockReqResNext();
		await controller.getBusinessKybDetails(req, res, next);

		const { combineWatchlistMetadata } = require("#lib/facts/rules");
		expect(mockAddRuleOverride).toHaveBeenCalledWith("watchlist_raw", combineWatchlistMetadata);
	});

	it("should handle empty watchlist without errors", async () => {
		mockGetResults.mockResolvedValue({
			watchlist: {
				value: { metadata: [], message: "No Watchlist hits were identified" }
			},
			watchlist_hits: {
				value: 0
			}
		});

		const { req, res, next, cacheOutput } = makeMockReqResNext();
		await controller.getBusinessKybDetails(req, res, next);

		const data = cacheOutput.cacheOutput?.data as Record<string, any>;
		expect(data.watchlist.value.metadata).toHaveLength(0);
		expect(data.watchlist_hits.value).toBe(0);
	});
});
