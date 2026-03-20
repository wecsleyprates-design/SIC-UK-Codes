// @ts-nocheck

import { db } from "#helpers/index";
import { createTracker, type Tracker } from "knex-mock-client";
import { MonitoringRunRepository } from "../monitoringRunRepository";

jest.mock("#helpers/index", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" }),
		logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() }
	};
});

describe("RunRepository", () => {
	let tracker: Tracker;
	let repository: InstanceType<typeof MonitoringRunRepository>;
	const customerId = "11111111-1111-1111-1111-111111111111";
	const templateId = "22222222-2222-2222-2222-222222222222";
	const runId = "33333333-3333-3333-3333-333333333333";
	const businessId = "44444444-4444-4444-4444-444444444444";

	beforeAll(() => {
		tracker = createTracker(db);
		repository = new MonitoringRunRepository(db);
	});

	afterEach(() => {
		tracker.reset();
	});

	describe("createRun", () => {
		it("inserts and returns run with id", async () => {
			const inserted = {
				id: runId,
				customer_id: customerId,
				template_id: templateId,
				created_at: new Date()
			};
			tracker.on.insert("monitoring_run").response([inserted]);

			const result = await repository.createRun(customerId, templateId);

			expect(result).toMatchObject({
				id: runId,
				customer_id: customerId,
				template_id: templateId
			});
			expect(tracker.history.insert).toHaveLength(1);
		});

		it("throws when insert returns empty", async () => {
			tracker.on.insert("monitoring_run").response([]);

			await expect(repository.createRun(customerId, templateId)).rejects.toThrow("Failed to create monitoring run");
		});
	});

	describe("getRunById", () => {
		it("returns run when found", async () => {
			const run = { id: runId, customer_id: customerId, template_id: templateId, created_at: new Date() };
			tracker.on.select("monitoring_run").response([run]);

			const result = await repository.getRunById(runId);

			expect(result).toMatchObject({ id: runId });
		});

		it("returns undefined when not found", async () => {
			tracker.on.select("monitoring_run").response([]);

			const result = await repository.getRunById(runId);

			expect(result).toBeUndefined();
		});
	});

	describe("addBusinessToRun", () => {
		it("inserts business run and returns row with parsed metadata", async () => {
			const row = {
				run_id: runId,
				business_id: businessId,
				template_id: templateId,
				start_at: null,
				complete_at: null,
				status: "PENDING",
				score_trigger_id: null,
				metadata: JSON.stringify({ key: "value" })
			};
			tracker.on.insert("rel_business_monitoring_run").response([row]);

			const result = await repository.addBusinessToRun(runId, businessId, templateId, {
				metadata: { key: "value" }
			});

			expect(result.run_id).toBe(runId);
			expect(result.business_id).toBe(businessId);
			expect(result.metadata).toEqual({ key: "value" });
			expect(result.status).toBe("PENDING");
		});
	});

	describe("updateBusinessRun", () => {
		it("updates and returns row when found", async () => {
			const updated = {
				run_id: runId,
				business_id: businessId,
				template_id: templateId,
				start_at: "2025-01-01T00:00:00Z",
				complete_at: "2025-01-01T01:00:00Z",
				status: "COMPLETED",
				score_trigger_id: null,
				metadata: "{}"
			};
			tracker.on.update("rel_business_monitoring_run").response([updated]);

			const result = await repository.updateBusinessRun(runId, businessId, {
				status: "COMPLETED",
				complete_at: "2025-01-01T01:00:00Z"
			});

			expect(result).toBeDefined();
			expect(result!.status).toBe("COMPLETED");
			expect(tracker.history.update).toHaveLength(1);
		});

		it("returns undefined when no row updated", async () => {
			tracker.on.update("rel_business_monitoring_run").response([]);

			const result = await repository.updateBusinessRun(runId, businessId, { status: "COMPLETED" });

			expect(result).toBeUndefined();
		});
	});

	describe("getBusinessRunsByRunId", () => {
		it("returns list of business runs with parsed metadata", async () => {
			const rows = [
				{
					run_id: runId,
					business_id: businessId,
					template_id: templateId,
					status: "PENDING",
					metadata: JSON.stringify({ a: 1 })
				}
			];
			tracker.on.select("rel_business_monitoring_run").response(rows);

			const result = await repository.getBusinessRunsByRunId(runId);

			expect(result).toHaveLength(1);
			expect(result[0].metadata).toEqual({ a: 1 });
		});
	});
});
