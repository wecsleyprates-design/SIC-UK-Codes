import { EVENTS } from "#constants";
import { WORKER_TYPES } from "#constants/environments.constant";

jest.mock("openai");

jest.mock("#helpers/redis", () => ({
	redis: {
		hgetall: jest.fn(),
		hset: jest.fn(),
		expire: jest.fn(),
		hincrby: jest.fn(),
		delete: jest.fn(),
		get: jest.fn(),
		setex: jest.fn(),
		incr: jest.fn()
	},
	createClusterClient: jest.fn(),
	redisConnect: jest.fn(),
	redisConfig: { ecClusterMode: false, conn: {} }
}));

jest.mock("#helpers/kafka", () => ({
	producer: { send: jest.fn(), init: jest.fn() },
	consumer: { init: jest.fn(), run: jest.fn() }
}));

jest.mock("#workers/stateUpdateQueue", () => ({ stateQueue: {} }));
jest.mock("#messaging/index", () => ({ kafkaToQueue: jest.fn() }));

const mockProcess = jest.fn();

jest.mock("#helpers/bull-queue", () => {
	const BullQueueMock = jest.fn().mockImplementation(() => ({
		addJob: jest.fn(),
		queue: {
			process: mockProcess,
			on: jest.fn(),
			setMaxListeners: jest.fn(),
			getJobCounts: jest.fn().mockResolvedValue({})
		}
	}));
	return { __esModule: true, default: BullQueueMock };
});

const { envConfig } = require("#configs/env.config");

describe("initTaskWorker - Worker Type Isolation", () => {
	beforeEach(() => {
		mockProcess.mockClear();
	});

	const loadAndInit = (workerType?: string) => {
		envConfig.WORKER_TYPE = workerType;

		jest.isolateModules(() => {
			const { initTaskWorker } = require("../taskHandler");
			initTaskWorker();
		});
	};

	const getRegisteredEvents = (): string[] => mockProcess.mock.calls.map((c: any[]) => c[0]);

	describe(`WORKER_TYPE=${WORKER_TYPES.CRITICAL}`, () => {
		it("should register handlers ONLY on dedicated queues, NOT on taskQueue", () => {
			loadAndInit(WORKER_TYPES.CRITICAL);
			const events = getRegisteredEvents();

			expect(events).toContain(EVENTS.ENTITY_MATCHING);
			expect(events).toContain(EVENTS.FIRMOGRAPHICS_EVENT);
			expect(events).toContain(EVENTS.OPEN_CORPORATES_MATCH);
			expect(events).toContain(EVENTS.ZOOMINFO_MATCH);
			expect(events).toContain(EVENTS.NPI_BUSINESS_MATCH);

			expect(events.filter(e => e === EVENTS.ENTITY_MATCHING)).toHaveLength(1);
			expect(events.filter(e => e === EVENTS.FIRMOGRAPHICS_EVENT)).toHaveLength(1);
		});

		it("should NOT register CASE_SUBMITTED_EXECUTE_TASKS (critical workers must not steal these jobs)", () => {
			loadAndInit(WORKER_TYPES.CRITICAL);
			const events = getRegisteredEvents();

			expect(events).not.toContain(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS);
		});

		it("should NOT register any general-only handlers", () => {
			loadAndInit(WORKER_TYPES.CRITICAL);
			const events = getRegisteredEvents();

			const generalOnlyEvents = [
				EVENTS.PLAID_ASSET_REPORT,
				EVENTS.REFRESH_SCORE,
				EVENTS.INTEGRATION_DATA_UPLOADED,
				EVENTS.OCR_PARSE_DOCUMENT,
				EVENTS.OCR_VALIDATE_DOCUMENT_TYPE,
				EVENTS.FETCH_ASSET_REPORT,
				EVENTS.LINK_WEBHOOK,
				EVENTS.PURGE_BUSINESS,
				EVENTS.INTEGRATION_DATA_READY,
				EVENTS.KYX_MATCH,
				EVENTS.MATCH_PRO_BULK,
				EVENTS.CASE_UPDATED_AUDIT
			];

			for (const event of generalOnlyEvents) {
				expect(events).not.toContain(event);
			}
		});
	});

	describe(`WORKER_TYPE=${WORKER_TYPES.GENERAL}`, () => {
		it("should register CASE_SUBMITTED_EXECUTE_TASKS", () => {
			loadAndInit(WORKER_TYPES.GENERAL);
			const events = getRegisteredEvents();

			expect(events).toContain(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS);
		});

		it("should register drain pre-migration handlers on taskQueue", () => {
			loadAndInit(WORKER_TYPES.GENERAL);
			const events = getRegisteredEvents();

			expect(events).toContain(EVENTS.ENTITY_MATCHING);
			expect(events).toContain(EVENTS.FIRMOGRAPHICS_EVENT);
			expect(events).toContain(EVENTS.OPEN_CORPORATES_MATCH);
			expect(events).toContain(EVENTS.ZOOMINFO_MATCH);
			expect(events).toContain(EVENTS.NPI_BUSINESS_MATCH);
		});

		it("should register all general event handlers", () => {
			loadAndInit(WORKER_TYPES.GENERAL);
			const events = getRegisteredEvents();

			const expectedEvents = [
				EVENTS.PLAID_ASSET_REPORT,
				EVENTS.REFRESH_SCORE,
				EVENTS.INTEGRATION_DATA_UPLOADED,
				EVENTS.OCR_PARSE_DOCUMENT,
				EVENTS.OCR_VALIDATE_DOCUMENT_TYPE,
				EVENTS.FETCH_ASSET_REPORT,
				EVENTS.LINK_WEBHOOK,
				EVENTS.PURGE_BUSINESS,
				EVENTS.INTEGRATION_DATA_READY,
				EVENTS.KYX_MATCH,
				EVENTS.MATCH_PRO_BULK,
				EVENTS.CASE_UPDATED_AUDIT
			];

			for (const event of expectedEvents) {
				expect(events).toContain(event);
			}
		});
	});

	describe("WORKER_TYPE=undefined (legacy mode)", () => {
		it("should register handlers on both dedicated queues AND taskQueue", () => {
			loadAndInit(undefined);
			const events = getRegisteredEvents();

			expect(events).toContain(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS);

			expect(events.filter(e => e === EVENTS.ENTITY_MATCHING).length).toBeGreaterThanOrEqual(2);
		});

		it("should register all general handlers in legacy mode", () => {
			loadAndInit(undefined);
			const events = getRegisteredEvents();

			expect(events).toContain(EVENTS.PLAID_ASSET_REPORT);
			expect(events).toContain(EVENTS.REFRESH_SCORE);
			expect(events).toContain(EVENTS.INTEGRATION_DATA_UPLOADED);
			expect(events).toContain(EVENTS.KYX_MATCH);
		});
	});
});
