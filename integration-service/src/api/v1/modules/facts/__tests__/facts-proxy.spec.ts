import { factsProxy } from "../facts-proxy";
import { FactsApiError } from "../error";
import { getBusinessApplicants, getBusinessFacts } from "#helpers";
import { ROLES, ERROR_CODES } from "#constants";
import { StatusCodes } from "http-status-codes";
import type { UserInfo } from "#types";
import type { UUID } from "crypto";

// Mock the helper functions
jest.mock("#helpers", () => ({
	getBusinessApplicants: jest.fn(),
	getBusinessFacts: jest.fn()
}));

// Mock logger to avoid console output during tests
jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn()
	}
}));

describe("FactsProxy", () => {
	const mockBusinessID = "00000000-0000-0000-0000-000000000000" as UUID;
	const mockUserID = "11111111-1111-1111-1111-111111111111" as UUID;
	
	const mockAdminUser: UserInfo = {
		user_id: mockUserID,
		email: "admin@test.com",
		role: {
			id: 1,
			code: ROLES.ADMIN
		},
		given_name: "Admin",
		family_name: "User"
	};

	const mockApplicantUser: UserInfo = {
		user_id: mockUserID,
		email: "applicant@test.com",
		role: {
			id: 3,
			code: ROLES.APPLICANT
		},
		given_name: "Applicant",
		family_name: "User"
	};

	const mockCustomerUser: UserInfo = {
		user_id: mockUserID,
		email: "customer@test.com",
		role: {
			id: 2,
			code: ROLES.CUSTOMER
		},
		given_name: "Customer",
		family_name: "User"
	};

	const mockBusinessFacts = [
		{ name: "business_name", value: "Test Company LLC" },
		{ name: "business_address", value: "123 Test St" },
		{ name: "business_phone", value: "+1234567890" },
		{ name: "business_email", value: "test@company.com" },
		{ name: "business_website", value: "https://testcompany.com" },
		{ name: "ein", value: "12-3456789" },
		{ name: "industry", value: "Technology" },
		{ name: "naics_code", value: "541511" },
		{ name: "employees_count", value: "50" },
		{ name: "annual_revenue", value: "1000000" },
		{ name: "kyb_status", value: "verified" },
		{ name: "kyb_score", value: "95" },
		{ name: "bjl_status", value: "clear" },
		{ name: "bjl_score", value: "0" },
		{ name: "review_rating", value: "4.5" },
		{ name: "review_count", value: "25" },
		{ name: "financial_score", value: "750" },
		{ name: "credit_rating", value: "A" },
		{ name: "match_confidence", value: "high" },
		{ name: "match_score", value: "98" }
	];

	const mockBusinessApplicants = [
		{ id: mockUserID },
		{ id: "22222222-2222-2222-2222-222222222222" }
	];

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getProxyBusinessDetails", () => {
		describe("Authorization checks", () => {
			it("should allow admin users to access business details", async () => {
				(getBusinessFacts as jest.Mock).mockResolvedValue(mockBusinessFacts);

				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser);

				expect(getBusinessFacts).toHaveBeenCalledWith(mockBusinessID);
				expect(getBusinessApplicants).not.toHaveBeenCalled();
				expect(result).toHaveProperty("business_name", "Test Company LLC");
			});

			it("should allow customer users to access business details", async () => {
				(getBusinessFacts as jest.Mock).mockResolvedValue(mockBusinessFacts);

				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockCustomerUser);

				expect(getBusinessFacts).toHaveBeenCalledWith(mockBusinessID);
				expect(getBusinessApplicants).not.toHaveBeenCalled();
				expect(result).toHaveProperty("business_name", "Test Company LLC");
			});

			it("should allow applicant users to access their own business details", async () => {
				(getBusinessApplicants as jest.Mock).mockResolvedValue(mockBusinessApplicants);
				(getBusinessFacts as jest.Mock).mockResolvedValue(mockBusinessFacts);

				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockApplicantUser);

				expect(getBusinessApplicants).toHaveBeenCalledWith(mockBusinessID);
				expect(getBusinessFacts).toHaveBeenCalledWith(mockBusinessID);
				expect(result).toHaveProperty("business_name", "Test Company LLC");
			});

			it("should throw unauthorized error when applicant tries to access other business details", async () => {
				const unauthorizedApplicant: UserInfo = {
					...mockApplicantUser,
					user_id: "99999999-9999-9999-9999-999999999999" as UUID
				};

				(getBusinessApplicants as jest.Mock).mockResolvedValue(mockBusinessApplicants);

				await expect(
					factsProxy.getProxyBusinessDetails(mockBusinessID, unauthorizedApplicant)
				).rejects.toThrow(FactsApiError);

				await expect(
					factsProxy.getProxyBusinessDetails(mockBusinessID, unauthorizedApplicant)
				).rejects.toMatchObject({
					message: "You are not allowed to access details of this business.",
					status: StatusCodes.UNAUTHORIZED,
					errorCode: ERROR_CODES.UNAUTHENTICATED
				});

				expect(getBusinessApplicants).toHaveBeenCalledWith(mockBusinessID);
				expect(getBusinessFacts).not.toHaveBeenCalled();
			});
		});

		describe("Category filtering", () => {
			beforeEach(() => {
				(getBusinessFacts as jest.Mock).mockResolvedValue(mockBusinessFacts);
			});

			it("should return all facts when no category is specified", async () => {
				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser);

				expect(Object.keys(result)).toHaveLength(mockBusinessFacts.length);
				expect(result).toHaveProperty("business_name", "Test Company LLC");
				expect(result).toHaveProperty("kyb_status", "verified");
				expect(result).toHaveProperty("bjl_status", "clear");
				expect(result).toHaveProperty("review_rating", "4.5");
				expect(result).toHaveProperty("annual_revenue", "1000000");
				expect(result).toHaveProperty("match_confidence", "high");
			});

			it("should return all facts when category is 'all'", async () => {
				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser, "all");

				expect(Object.keys(result)).toHaveLength(mockBusinessFacts.length);
				expect(result).toHaveProperty("business_name", "Test Company LLC");
				expect(result).toHaveProperty("kyb_status", "verified");
			});



			it("should return only review facts when category is 'reviews'", async () => {
				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser, "reviews");

				// Should contain review facts
				expect(result).toHaveProperty("review_rating", "4.5");
				expect(result).toHaveProperty("review_count", "25");
				
				// Should not contain facts from other categories
				expect(result).not.toHaveProperty("business_name");
				expect(result).not.toHaveProperty("kyb_status");
				expect(result).not.toHaveProperty("bjl_status");
			});


			it("should return empty object when no facts match the category", async () => {
				// Mock empty facts array
				(getBusinessFacts as jest.Mock).mockResolvedValue([]);

				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser, "business-details");

				expect(result).toEqual({});
			});
		});

		describe("Error handling", () => {
			it("should propagate errors from getBusinessApplicants", async () => {
				const mockError = new Error("Failed to get applicants");
				(getBusinessApplicants as jest.Mock).mockRejectedValue(mockError);

				await expect(
					factsProxy.getProxyBusinessDetails(mockBusinessID, mockApplicantUser)
				).rejects.toThrow("Failed to get applicants");

				expect(getBusinessApplicants).toHaveBeenCalledWith(mockBusinessID);
				expect(getBusinessFacts).not.toHaveBeenCalled();
			});

			it("should propagate errors from getBusinessFacts", async () => {
				const mockError = new Error("Failed to get facts");
				(getBusinessFacts as jest.Mock).mockRejectedValue(mockError);

				await expect(
					factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser)
				).rejects.toThrow("Failed to get facts");

				expect(getBusinessFacts).toHaveBeenCalledWith(mockBusinessID);
			});

			it("should handle missing role information gracefully", async () => {
				const userWithoutRole: UserInfo = {
					...mockAdminUser,
					role: undefined as any
				};

				(getBusinessFacts as jest.Mock).mockResolvedValue(mockBusinessFacts);

				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, userWithoutRole);

				expect(result).toHaveProperty("business_name", "Test Company LLC");
				expect(getBusinessApplicants).not.toHaveBeenCalled();
			});
		});

		describe("Edge cases", () => {
			it("should handle empty business facts array", async () => {
				(getBusinessFacts as jest.Mock).mockResolvedValue([]);

				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser);

				expect(result).toEqual({});
			});

			it("should handle facts with null or undefined values", async () => {
				const factsWithNullValues = [
					{ name: "business_name", value: null },
					{ name: "business_address", value: undefined },
					{ name: "business_phone", value: "" },
					{ name: "valid_fact", value: "valid_value" }
				];

				(getBusinessFacts as jest.Mock).mockResolvedValue(factsWithNullValues);

				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser);

				expect(result).toEqual({
					business_name: null,
					business_address: undefined,
					business_phone: "",
					valid_fact: "valid_value"
				});
			});

			it("should handle duplicate fact names (last one wins)", async () => {
				const duplicateFacts = [
					{ name: "business_name", value: "First Company" },
					{ name: "business_name", value: "Second Company" },
					{ name: "business_address", value: "123 Test St" }
				];

				(getBusinessFacts as jest.Mock).mockResolvedValue(duplicateFacts);

				const result = await factsProxy.getProxyBusinessDetails(mockBusinessID, mockAdminUser);

				expect(result).toEqual({
					business_name: "Second Company",
					business_address: "123 Test St"
				});
			});

			it("should handle empty business applicants array for applicant user", async () => {
				(getBusinessApplicants as jest.Mock).mockResolvedValue([]);

				await expect(
					factsProxy.getProxyBusinessDetails(mockBusinessID, mockApplicantUser)
				).rejects.toThrow(FactsApiError);

				expect(getBusinessApplicants).toHaveBeenCalledWith(mockBusinessID);
				expect(getBusinessFacts).not.toHaveBeenCalled();
			});
		});
	});
});