// @ts-nocheck

import { applicantConfig } from "../applicant-config";
import { db } from "#helpers/knex";
import type { AgingConfig } from "../../businesses/types";
import { createTracker, type Tracker } from "knex-mock-client";

jest.mock("#helpers/index", () => ({
	sqlQuery: jest.fn(),
	logger: {
		info: jest.fn(),
		error: jest.fn()
	}
}));

// Mock the db with knex-mock-client
jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

describe("ApplicantConfig - addOrUpdateApplicantConfigForBusiness", () => {
	let tracker: Tracker;

	const mockBusinessID = "85daaf61-f279-40ab-b7ce-3de03795b191";
	const mockCustomerID = "95daaf61-f279-40ab-b7ce-3de03795b192";
	const mockCoreConfigID = 1;

	const mockExistingConfig = [
		{
			urgency: "low",
			threshold: 7,
			allowed_case_status: [1, 2],
			message: "Default low urgency message"
		},
		{
			urgency: "medium",
			threshold: 14,
			allowed_case_status: [1, 2],
			message: "Default medium urgency message"
		},
		{
			urgency: "high",
			threshold: 30,
			allowed_case_status: [1, 2],
			message: "Default high urgency message"
		}
	];

	beforeAll(() => {
		tracker = createTracker(db);
	});

	afterEach(() => {
		tracker.reset();
	});

	describe("Update existing business config", () => {
		it("should update existing business config with new thresholds and messages", async () => {
			const agingConfig: AgingConfig = {
				thresholds: {
					low: 25,
					medium: 45,
					high: 75
				},
				custom_messages: {
					low: "Updated low message.",
					medium: "Updated medium message.",
					high: "Updated high message."
				}
			};

			// Mock select query to return existing business config
			tracker.on.select("data_business_applicant_configs").response([
				{ config: mockExistingConfig, source: "business" }
			]);

			// Mock update query
			tracker.on.update("data_business_applicant_configs").response(1);

			await applicantConfig.addOrUpdateApplicantConfigForBusiness(
				mockBusinessID,
				mockCustomerID,
				mockCoreConfigID,
				agingConfig
			);

			// Verify the update was called
			const updateHistory = tracker.history.update;
			expect(updateHistory.length).toBe(1);
		});

		it("should update only thresholds when custom messages are not provided", async () => {
			const agingConfig: AgingConfig = {
				thresholds: {
					low: 10,
					medium: 30,
					high: 50
				},
				custom_messages: {}
			};

			tracker.on.select("data_business_applicant_configs").response([
				{ config: mockExistingConfig, source: "business" }
			]);
			tracker.on.update("data_business_applicant_configs").response(1);

			await applicantConfig.addOrUpdateApplicantConfigForBusiness(
				mockBusinessID,
				mockCustomerID,
				mockCoreConfigID,
				agingConfig
			);

			expect(tracker.history.update.length).toBe(1);
		});

		it("should update only custom messages when thresholds are not provided", async () => {
			const agingConfig: AgingConfig = {
				thresholds: {},
				custom_messages: {
					low: "Only message updated for low.",
					medium: "Only message updated for medium.",
					high: "Only message updated for high."
				}
			};

			tracker.on.select("data_business_applicant_configs").response([
				{ config: mockExistingConfig, source: "business" }
			]);
			tracker.on.update("data_business_applicant_configs").response(1);

			await applicantConfig.addOrUpdateApplicantConfigForBusiness(
				mockBusinessID,
				mockCustomerID,
				mockCoreConfigID,
				agingConfig
			);

			expect(tracker.history.update.length).toBe(1);
		});

		it("should update specific urgency levels only", async () => {
			const agingConfig: AgingConfig = {
				thresholds: {
					low: 12,
					high: 55
				},
				custom_messages: {
					medium: "Only medium message updated."
				}
			};

			tracker.on.select("data_business_applicant_configs").response([
				{ config: mockExistingConfig, source: "business" }
			]);
			tracker.on.update("data_business_applicant_configs").response(1);

			await applicantConfig.addOrUpdateApplicantConfigForBusiness(
				mockBusinessID,
				mockCustomerID,
				mockCoreConfigID,
				agingConfig
			);

			expect(tracker.history.update.length).toBe(1);
		});
	});

	describe("Insert new business config", () => {
		it("should insert new config when source is customer", async () => {
			const agingConfig: AgingConfig = {
				thresholds: { low: 10, medium: 20, high: 30 },
				custom_messages: {}
			};

			// Source is 'customer', not 'business', so INSERT should be called
			tracker.on.select("data_business_applicant_configs").response([
				{ config: mockExistingConfig, source: "customer" }
			]);
			tracker.on.insert("data_business_applicant_configs").response([1]);

			await applicantConfig.addOrUpdateApplicantConfigForBusiness(
				mockBusinessID,
				mockCustomerID,
				mockCoreConfigID,
				agingConfig
			);

			// Verify INSERT was called (not UPDATE)
			expect(tracker.history.insert.length).toBe(1);
			expect(tracker.history.update.length).toBe(0);
		});

		it("should insert new config when source is core", async () => {
			const agingConfig: AgingConfig = {
				thresholds: { low: 10, medium: 20, high: 30 },
				custom_messages: {}
			};

			tracker.on.select("data_business_applicant_configs").response([
				{ config: mockExistingConfig, source: "core" }
			]);
			tracker.on.insert("data_business_applicant_configs").response([1]);

			await applicantConfig.addOrUpdateApplicantConfigForBusiness(
				mockBusinessID,
				mockCustomerID,
				mockCoreConfigID,
				agingConfig
			);

			expect(tracker.history.insert.length).toBe(1);
			expect(tracker.history.update.length).toBe(0);
		});

		it("should insert when no existing config found", async () => {
			const agingConfig: AgingConfig = {
				thresholds: { low: 10, medium: 20, high: 30 },
				custom_messages: {}
			};

			// Empty result - no existing config
			tracker.on.select("data_business_applicant_configs").response([]);
			tracker.on.insert("data_business_applicant_configs").response([1]);

			await applicantConfig.addOrUpdateApplicantConfigForBusiness(
				mockBusinessID,
				mockCustomerID,
				mockCoreConfigID,
				agingConfig
			);

			expect(tracker.history.insert.length).toBe(1);
		});
	});

	describe("Error handling", () => {
		it("should throw error when select query fails", async () => {
			const agingConfig: AgingConfig = {
				thresholds: { low: 10, medium: 20, high: 30 },
				custom_messages: {}
			};

			tracker.on.select("data_business_applicant_configs").simulateError(new Error("Database connection failed"));

			await expect(
				applicantConfig.addOrUpdateApplicantConfigForBusiness(
					mockBusinessID,
					mockCustomerID,
					mockCoreConfigID,
					agingConfig
				)
			).rejects.toThrow("Database connection failed");
		});

		it("should throw error when update query fails", async () => {
			const agingConfig: AgingConfig = {
				thresholds: { low: 10, medium: 20, high: 30 },
				custom_messages: {}
			};

			tracker.on.select("data_business_applicant_configs").response([
				{ config: mockExistingConfig, source: "business" }
			]);
			tracker.on.update("data_business_applicant_configs").simulateError(new Error("Update query failed"));

			await expect(
				applicantConfig.addOrUpdateApplicantConfigForBusiness(
					mockBusinessID,
					mockCustomerID,
					mockCoreConfigID,
					agingConfig
				)
			).rejects.toThrow("Update query failed");
		});

		it("should throw error when insert query fails", async () => {
			const agingConfig: AgingConfig = {
				thresholds: { low: 10, medium: 20, high: 30 },
				custom_messages: {}
			};

			tracker.on.select("data_business_applicant_configs").response([
				{ config: mockExistingConfig, source: "core" }
			]);
			tracker.on.insert("data_business_applicant_configs").simulateError(new Error("Insert query failed"));

			await expect(
				applicantConfig.addOrUpdateApplicantConfigForBusiness(
					mockBusinessID,
					mockCustomerID,
					mockCoreConfigID,
					agingConfig
				)
			).rejects.toThrow("Insert query failed");
		});

		it("should handle non-array config gracefully", async () => {
			const agingConfig: AgingConfig = {
				thresholds: { low: 10, medium: 20, high: 30 },
				custom_messages: {}
			};

			// Config is not an array - should be treated as empty
			tracker.on.select("data_business_applicant_configs").response([
				{ config: { invalid: "data" }, source: "core" }
			]);
			tracker.on.insert("data_business_applicant_configs").response([1]);

			await applicantConfig.addOrUpdateApplicantConfigForBusiness(
				mockBusinessID,
				mockCustomerID,
				mockCoreConfigID,
				agingConfig
			);

			// Should still work - treats non-array as empty array
			expect(tracker.history.insert.length).toBe(1);
		});
	});
});
