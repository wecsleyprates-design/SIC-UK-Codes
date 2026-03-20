// @ts-nocheck

import { db } from "#helpers/index";
import { createTracker, type Tracker } from "knex-mock-client";
import { TemplateRepository } from "../monitoringTemplateRepository";

jest.mock("#helpers/index", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" }),
		logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() }
	};
});

describe("TemplateRepository", () => {
	let tracker: Tracker;
	let repository: InstanceType<typeof TemplateRepository>;
	const customerId = "11111111-1111-1111-1111-111111111111";
	const templateId = "22222222-2222-2222-2222-222222222222";
	const userId = "33333333-3333-3333-3333-333333333333";

	beforeAll(() => {
		tracker = createTracker(db);
		repository = new TemplateRepository(db);
	});

	afterEach(() => {
		tracker.reset();
	});

	describe("listByCustomer", () => {
		it("returns templates ordered by priority and created_at", async () => {
			const rows = [
				{
					id: templateId,
					customer_id: customerId,
					priority: 0,
					is_active: true,
					is_default: false,
					label: "A",
					created_at: new Date(),
					updated_at: new Date(),
					created_by: userId,
					updated_by: userId
				}
			];
			tracker.on.select("monitoring_templates").response(rows);

			const result = await repository.listByCustomer(customerId);

			expect(result).toHaveLength(1);
			expect(result[0].label).toBe("A");
			expect(tracker.history.select).toHaveLength(1);
		});
	});

	describe("getByIdAndCustomer", () => {
		it("returns template when found", async () => {
			const row = {
				id: templateId,
				customer_id: customerId,
				label: "Test",
				priority: 0,
				is_active: true,
				is_default: false,
				created_at: new Date(),
				updated_at: new Date(),
				created_by: userId,
				updated_by: userId
			};
			tracker.on.select("monitoring_templates").response([row]);

			const result = await repository.getByIdAndCustomer(templateId, customerId);

			expect(result).toMatchObject({ id: templateId, label: "Test" });
		});

		it("returns undefined when not found", async () => {
			tracker.on.select("monitoring_templates").response([]);

			const result = await repository.getByIdAndCustomer(templateId, customerId);

			expect(result).toBeUndefined();
		});
	});

	describe("create", () => {
		it("inserts and returns template", async () => {
			const data = {
				customer_id: customerId,
				priority: 0,
				is_active: true,
				is_default: false,
				label: "New",
				created_by: userId,
				updated_by: userId
			};
			const inserted = { id: templateId, ...data, created_at: new Date(), updated_at: new Date() };
			tracker.on.insert("monitoring_templates").response([inserted]);

			const result = await repository.create(data);

			expect(result).toMatchObject({ id: templateId, label: "New" });
			expect(tracker.history.insert).toHaveLength(1);
		});
	});

	describe("update", () => {
		it("updates and returns row", async () => {
			const updated = {
				id: templateId,
				customer_id: customerId,
				label: "Updated",
				priority: 1,
				is_active: true,
				is_default: false,
				created_at: new Date(),
				updated_at: new Date(),
				created_by: userId,
				updated_by: userId
			};
			tracker.on.update("monitoring_templates").response([updated]);

			const result = await repository.update(templateId, customerId, {
				label: "Updated",
				priority: 1,
				updated_by: userId
			});

			expect(result).toMatchObject({ label: "Updated", priority: 1 });
		});
	});

	describe("delete", () => {
		it("returns true when row deleted", async () => {
			tracker.on.delete("monitoring_templates").response(1);

			const result = await repository.delete(templateId, customerId);

			expect(result).toBe(true);
			expect(tracker.history.delete).toHaveLength(1);
		});

		it("returns false when no row deleted", async () => {
			tracker.on.delete("monitoring_templates").response(0);

			const result = await repository.delete(templateId, customerId);

			expect(result).toBe(false);
		});
	});

	describe("getLastRunAtByTemplateId", () => {
		it("returns max created_at as string when present", async () => {
			const now = new Date("2025-01-02T12:00:00Z");
			tracker.on.select("monitoring_run").response([{ last_run_at: now }]);

			const result = await repository.getLastRunAtByTemplateId(templateId);

			expect(result).toBeDefined();
			expect(new Date(result!).getTime()).toBe(now.getTime());
		});

		it("returns null when no runs", async () => {
			tracker.on.select("monitoring_run").response([{ last_run_at: null }]);

			const result = await repository.getLastRunAtByTemplateId(templateId);

			expect(result).toBeNull();
		});
	});

	describe("getBusinessCountByTemplateId", () => {
		it("returns count", async () => {
			tracker.on.select("rel_monitoring_template_business").response([{ count: "3" }]);

			const result = await repository.getBusinessCountByTemplateId(templateId);

			expect(result).toBe(3);
		});

		it("returns 0 when no rows", async () => {
			tracker.on.select("rel_monitoring_template_business").response([{ count: "0" }]);

			const result = await repository.getBusinessCountByTemplateId(templateId);

			expect(result).toBe(0);
		});
	});

	describe("upsertBusinessTemplate", () => {
		it("calls insert with onConflict merge", async () => {
			tracker.on.insert("rel_monitoring_template_business").response([]);

			await repository.upsertBusinessTemplate("biz-1", customerId, templateId);

			expect(tracker.history.insert).toHaveLength(1);
		});
	});

	describe("getBusinessTemplate", () => {
		it("returns template_id when found", async () => {
			tracker.on.select("rel_monitoring_template_business").response([{ template_id: templateId }]);

			const result = await repository.getBusinessTemplate("biz-1", customerId);

			expect(result).toEqual({ template_id: templateId });
		});

		it("returns undefined when not found", async () => {
			tracker.on.select("rel_monitoring_template_business").response([]);

			const result = await repository.getBusinessTemplate("biz-1", customerId);

			expect(result).toBeUndefined();
		});
	});
});
