/* */
/**
 * Tests for truliooBusiness source addressSources and reviewTasks functionality
 * This ensures the changes made to fetch addressSources and reviewTasks from the database
 * work correctly and handle errors gracefully.
 */

import { UUID } from "crypto";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { INTEGRATION_ID } from "#constants";
import { sources } from "../sources";
import type { IBusinessEntityAddressSource, IBusinessEntityReviewTask } from "#types/db";

// Mock dependencies
jest.mock("#helpers/knex", () => {
	const createMockQuery = (result: any) => {
		const query: any = {};
		query.select = jest.fn(() => query);
		query.where = jest.fn(() => query);
		query.andWhere = jest.fn(() => query);
		query.whereIn = jest.fn(() => query);
		query.whereNotNull = jest.fn(() => query);
		query.join = jest.fn(() => query);
		query.orderBy = jest.fn(() => query);
		query.orderByRaw = jest.fn(() => query);
		query.limit = jest.fn(() => query);
		query.first = jest.fn(() => query);
		query.then = jest.fn((resolve: any) => Promise.resolve(result).then(resolve));
		query.catch = jest.fn((reject: any) => Promise.resolve(result).catch(reject));
		return query;
	};

	let mockQueryResult: any = null;
	const mockDb: any = jest.fn((table: string) => createMockQuery(mockQueryResult));
	mockDb.raw = jest.fn((query: string) => query);
	mockDb.__setResult = (result: any) => {
		mockQueryResult = result;
	};

	return { db: mockDb };
});

jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("#helpers/api", () => ({
	confidenceScore: jest.fn(),
	confidenceScoreMany: jest.fn(),
	getBusinessCustomers: jest.fn(),
	TIN_BEHAVIOR: {}
}));

jest.mock("#lib/business/normalizedBusiness");

describe("truliooBusiness Source - addressSources and reviewTasks", () => {
	const businessID = "00000000-0000-0000-0000-000000000001" as UUID;
	const mockBusinessEntityVerificationId = "00000000-0000-0000-0000-000000000002" as UUID;

	beforeEach(() => {
		jest.clearAllMocks();
		sources.business.confidence = undefined;
		(db as any).__setResult(null);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("addressSources and reviewTasks fetching", () => {
		it("should include addressSources and reviewTasks as empty arrays when businessEntityVerification is not found", async () => {
			const mockTruliooResponse = {
				clientData: {
					status: "completed",
					businessData: {
						name: "Test Company"
					}
				}
			};

			const mockRequestResponse = {
				response: mockTruliooResponse,
				requested_at: new Date(),
				request_received: new Date()
			};

			// Mock db to return different results based on table
			let requestResponseCallCount = 0;
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					requestResponseCallCount++;
					if (requestResponseCallCount === 1) {
						// Create a query object that supports chaining after first()
						// getFromRequestResponse calls andWhere() after first(), so first() must return the query object
						const queryObj: any = {
							select: jest.fn(() => queryObj),
							where: jest.fn(() => queryObj),
							andWhere: jest.fn(() => queryObj),
							whereIn: jest.fn(() => queryObj),
							orderBy: jest.fn(() => queryObj),
							limit: jest.fn(() => queryObj),
							first: jest.fn(() => queryObj), // Return query object, not a promise
							then: jest.fn((resolve: any) => Promise.resolve(mockRequestResponse).then(resolve)),
							catch: jest.fn((reject: any) => Promise.resolve(mockRequestResponse).catch(reject))
						};
						return queryObj;
					}
				}
				if (table === "integration_data.business_entity_verification") {
					return {
						select: jest.fn().mockReturnThis(),
						where: jest.fn().mockReturnThis(),
						whereNotNull: jest.fn().mockReturnThis(),
						join: jest.fn().mockReturnThis(),
						orderBy: jest.fn().mockReturnThis(),
						orderByRaw: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue(undefined) // No verification found
					};
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const { NormalizedBusiness } = require("#lib/business/normalizedBusiness");
			jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(undefined);
			jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(undefined);

			const source = sources.business;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
			expect(result?.addressSources).toEqual([]);
			expect(result?.reviewTasks).toEqual([]);
			expect(Array.isArray(result?.addressSources)).toBe(true);
			expect(Array.isArray(result?.reviewTasks)).toBe(true);
		});

		it("should handle database query errors gracefully and return empty arrays", async () => {
			const mockTruliooResponse = {
				clientData: {
					status: "completed",
					businessData: {
						name: "Test Company"
					}
				}
			};

			const mockRequestResponse = {
				response: mockTruliooResponse,
				requested_at: new Date(),
				request_received: new Date()
			};

			let requestResponseCallCount = 0;
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					requestResponseCallCount++;
					if (requestResponseCallCount === 1) {
						// Create a query object that supports chaining after first()
						// getFromRequestResponse calls andWhere() after first(), so first() must return the query object
						const queryObj: any = {
							select: jest.fn(() => queryObj),
							where: jest.fn(() => queryObj),
							andWhere: jest.fn(() => queryObj),
							whereIn: jest.fn(() => queryObj),
							orderBy: jest.fn(() => queryObj),
							limit: jest.fn(() => queryObj),
							first: jest.fn(() => queryObj), // Return query object, not a promise
							then: jest.fn((resolve: any) => Promise.resolve(mockRequestResponse).then(resolve)),
							catch: jest.fn((reject: any) => Promise.resolve(mockRequestResponse).catch(reject))
						};
						return queryObj;
					}
				}
				if (table === "integration_data.business_entity_verification") {
					return {
						select: jest.fn().mockReturnThis(),
						where: jest.fn().mockReturnThis(),
						whereNotNull: jest.fn().mockReturnThis(),
						join: jest.fn().mockReturnThis(),
						orderBy: jest.fn().mockReturnThis(),
						orderByRaw: jest.fn().mockReturnThis(),
						first: jest.fn().mockRejectedValue(new Error("Database connection failed"))
					};
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const { NormalizedBusiness } = require("#lib/business/normalizedBusiness");
			jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(undefined);
			jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(undefined);

			const source = sources.business;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
			expect(result?.addressSources).toEqual([]);
			expect(result?.reviewTasks).toEqual([]);
			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Could not fetch addressSources or reviewTasks for trulioo business")
			);
			expect(Array.isArray(result?.addressSources)).toBe(true);
			expect(Array.isArray(result?.reviewTasks)).toBe(true);
		});

		it("should return undefined when Trulioo response is missing", async () => {
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					// Create a query object that supports chaining after first()
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => queryObj),
						whereIn: jest.fn(() => queryObj),
						orderBy: jest.fn(() => queryObj),
						limit: jest.fn(() => queryObj),
						first: jest.fn(() => queryObj), // Return query object, not a promise
						then: jest.fn((resolve: any) => Promise.resolve(null).then(resolve)),
						catch: jest.fn((reject: any) => Promise.resolve(null).catch(reject))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const source = sources.business;
			const result = await source.getter(businessID);

			expect(result).toBeUndefined();
		});

		it("should ensure response always has addressSources and reviewTasks as arrays", async () => {
			const mockTruliooResponse = {
				clientData: {
					status: "completed",
					businessData: { name: "Test Company" }
				}
			};

			const mockRequestResponse = {
				response: mockTruliooResponse,
				requested_at: new Date(),
				request_received: new Date()
			};

			let requestResponseCallCount = 0;
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					requestResponseCallCount++;
					if (requestResponseCallCount === 1) {
						// Create a query object that supports chaining after first()
						// getFromRequestResponse calls andWhere() after first(), so first() must return the query object
						const queryObj: any = {
							select: jest.fn(() => queryObj),
							where: jest.fn(() => queryObj),
							andWhere: jest.fn(() => queryObj),
							whereIn: jest.fn(() => queryObj),
							orderBy: jest.fn(() => queryObj),
							limit: jest.fn(() => queryObj),
							first: jest.fn(() => queryObj), // Return query object, not a promise
							then: jest.fn((resolve: any) => Promise.resolve(mockRequestResponse).then(resolve)),
							catch: jest.fn((reject: any) => Promise.resolve(mockRequestResponse).catch(reject))
						};
						return queryObj;
					}
				}
				if (table === "integration_data.business_entity_verification") {
					return {
						select: jest.fn().mockReturnThis(),
						where: jest.fn().mockReturnThis(),
						whereNotNull: jest.fn().mockReturnThis(),
						join: jest.fn().mockReturnThis(),
						orderBy: jest.fn().mockReturnThis(),
						first: jest.fn().mockRejectedValue(new Error("Database error"))
					};
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const { NormalizedBusiness } = require("#lib/business/normalizedBusiness");
			jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(undefined);
			jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(undefined);

			const source = sources.business;
			const result = await source.getter(businessID);

			// Even with database error, should return an object with empty arrays
			expect(result).toBeDefined();
			expect(Array.isArray(result?.addressSources)).toBe(true);
			expect(Array.isArray(result?.reviewTasks)).toBe(true);
			expect(result?.addressSources).toEqual([]);
			expect(result?.reviewTasks).toEqual([]);
		});

		it("should filter by TRULIOO platform_id when querying businessEntityVerification", async () => {
			const mockTruliooResponse = {
				clientData: {
					status: "completed",
					businessData: { name: "Test Company" }
				}
			};

			const mockRequestResponse = {
				response: mockTruliooResponse,
				requested_at: new Date(),
				request_received: new Date()
			};

			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockJoin = jest.fn().mockReturnThis();

			let requestResponseCallCount = 0;
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					requestResponseCallCount++;
					if (requestResponseCallCount === 1) {
						// Create a query object that supports chaining after first()
						// getFromRequestResponse calls andWhere() after first(), so first() must return the query object
						const queryObj: any = {
							select: jest.fn(() => queryObj),
							where: jest.fn(() => queryObj),
							andWhere: jest.fn(() => queryObj),
							whereIn: jest.fn(() => queryObj),
							orderBy: jest.fn(() => queryObj),
							limit: jest.fn(() => queryObj),
							first: jest.fn(() => queryObj), // Return query object, not a promise
							then: jest.fn((resolve: any) => Promise.resolve(mockRequestResponse).then(resolve)),
							catch: jest.fn((reject: any) => Promise.resolve(mockRequestResponse).catch(reject))
						};
						return queryObj;
					}
				}
				if (table === "integration_data.business_entity_verification") {
					return {
						select: jest.fn().mockReturnThis(),
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						join: mockJoin,
						orderBy: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue(undefined)
					};
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const { NormalizedBusiness } = require("#lib/business/normalizedBusiness");
			jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(undefined);
			jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(undefined);

			const source = sources.business;
			await source.getter(businessID);

			// Verify the query includes platform_id filter
			expect(mockWhere).toHaveBeenCalledWith(
				"integrations.data_connections.platform_id",
				INTEGRATION_ID.TRULIOO
			);
			// Note: whereNotNull is not needed because INNER JOIN already filters NULL values
			// and the column is NOT NULL in the database schema
		});

		it("should select only the required columns for addressSources and reviewTasks", async () => {
			const mockTruliooResponse = {
				clientData: {
					status: "completed",
					businessData: { name: "Test Company" }
				}
			};

			const mockRequestResponse = {
				response: mockTruliooResponse,
				requested_at: new Date(),
				request_received: new Date()
			};

			const mockAddressSourcesSelect = jest.fn().mockReturnThis();
			const mockReviewTasksSelect = jest.fn().mockReturnThis();

			const expectedAddressSourceColumns = [
				"id",
				"business_entity_verification_id",
				"created_at",
				"updated_at",
				"external_id",
				"external_registration_id",
				"full_address",
				"address_line_1",
				"address_line_2",
				"city",
				"state",
				"postal_code",
				"submitted",
				"deliverable"
			];

			const expectedReviewTaskColumns = [
				"id",
				"business_entity_verification_id",
				"created_at",
				"updated_at",
				"category",
				"key",
				"status",
				"message",
				"label",
				"sublabel",
				"metadata"
			];

			let requestResponseCallCount = 0;
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					requestResponseCallCount++;
					if (requestResponseCallCount === 1) {
						// Create a query object that supports chaining after first()
						// getFromRequestResponse calls andWhere() after first(), so first() must return the query object
						const queryObj: any = {
							select: jest.fn(() => queryObj),
							where: jest.fn(() => queryObj),
							andWhere: jest.fn(() => queryObj),
							whereIn: jest.fn(() => queryObj),
							orderBy: jest.fn(() => queryObj),
							limit: jest.fn(() => queryObj),
							first: jest.fn(() => queryObj), // Return query object, not a promise
							then: jest.fn((resolve: any) => Promise.resolve(mockRequestResponse).then(resolve)),
							catch: jest.fn((reject: any) => Promise.resolve(mockRequestResponse).catch(reject))
						};
						return queryObj;
					}
				}
				if (table === "integration_data.business_entity_verification") {
					return {
						select: jest.fn().mockReturnThis(),
						where: jest.fn().mockReturnThis(),
						whereNotNull: jest.fn().mockReturnThis(),
						join: jest.fn().mockReturnThis(),
						orderBy: jest.fn().mockReturnThis(),
						orderByRaw: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue({ id: mockBusinessEntityVerificationId })
					};
				}
				if (table === "integration_data.business_entity_address_source") {
					return {
						select: mockAddressSourcesSelect,
						where: jest.fn().mockResolvedValue([])
					};
				}
				if (table === "integration_data.business_entity_review_task") {
					return {
						select: mockReviewTasksSelect,
						where: jest.fn().mockResolvedValue([])
					};
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const { NormalizedBusiness } = require("#lib/business/normalizedBusiness");
			jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(undefined);
			jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(undefined);

			const source = sources.business;
			await source.getter(businessID);

			// Verify that select was called with the specific columns (not "*")
			expect(mockAddressSourcesSelect).toHaveBeenCalledWith(...expectedAddressSourceColumns);
			expect(mockReviewTasksSelect).toHaveBeenCalledWith(...expectedReviewTaskColumns);
		});
	});
});
