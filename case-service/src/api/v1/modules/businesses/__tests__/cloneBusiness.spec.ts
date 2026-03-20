import { CloneBusiness } from "../cloneBusiness";
import { caseManagementService as caseService } from "../../case-management/case-management";
import { onboarding } from "../../onboarding/onboarding";
import { decryptEin } from "#utils";
import type { UserInfo } from "#types";
import type { Business, Case } from "@joinworth/types/dist/types/cases";
import type { Business as BusinessType } from "#types/business";
import { UUID } from "crypto";

// Mock BullQueue first to prevent constructor errors
jest.mock("#helpers/index", () => ({
	BullQueue: jest.fn().mockImplementation(() => ({
		add: jest.fn(),
		process: jest.fn(),
		close: jest.fn()
	})),
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn()
	},
	producer: {
		send: jest.fn()
	}
}));

// Mock other dependencies
jest.mock("../../case-management/case-management");
jest.mock("../../onboarding/onboarding");
jest.mock("#utils", () => ({
	decryptEin: jest.fn()
}));
jest.mock("#common", () => ({
	sendEventToGatherWebhookData: jest.fn(),
	sendEventToFetchAdverseMedia: jest.fn()
}));
jest.mock("../../onboarding/customer-limits", () => ({
	customerLimits: {
		addBusinessCount: jest.fn()
	}
}));
jest.mock("../businessInvites", () => ({
	BusinessInvites: {
		create: jest.fn(),
		update: jest.fn()
	}
}));

// Mock BulkCreateBusinessMap
const mockBulkCreateBusinessMap = {
	match: jest.fn(),
	validate: jest.fn(),
	execute: jest.fn(),
	setAdditionalMetadata: jest.fn(),
	getAdditionalMetadata: jest.fn().mockReturnValue({
		data_businesses: { id: "new-business-123", name: "New Business LLC" },
		data_cases: [{ id: "new-case-123" }]
	}),
	sanitizeMetadata: jest.fn().mockReturnValue({})
};

jest.mock("../maps/bulkCreateBusinessMap", () => ({
	BulkCreateBusinessMap: jest.fn().mockImplementation(() => mockBulkCreateBusinessMap)
}));

const mockCaseService = caseService as jest.Mocked<typeof caseService>;
const mockOnboarding = onboarding as jest.Mocked<typeof onboarding>;
const mockDecryptEin = decryptEin as jest.MockedFunction<typeof decryptEin>;

describe("CloneBusiness", () => {
	let mockUserInfo: UserInfo;
	let mockSourceCaseData: any;
	let mockBusinessNames: BusinessType.BusinessName[];
	let mockBusinessAddresses: BusinessType.BusinessAddress[];

	beforeEach(() => {
		jest.clearAllMocks();

		mockUserInfo = {
			user_id: "user-123",
			issued_for: { customer_id: "customer-123" }
		} as UserInfo;

		mockSourceCaseData = {
			business: {
				id: "source-business-123",
				name: "Source Business LLC",
				tin: "encrypted-tin",
				address_line_1: "123 Source St",
				address_line_2: null,
				address_city: "Source City",
				address_state: "CA",
				address_postal_code: "90210",
				address_country: "US",
				industry: { id: 18, name: "Technology" },
				naics_code: 123456,
				naics_title: "Software Development",
				mcc_code: 7372,
				mcc_title: "Software Services",
				official_website: "https://source.com",
				mobile: "+15551234567"
			},
			owners: [
				{
					first_name: "John",
					last_name: "Doe",
					ssn: "encrypted-ssn",
					email: "john@example.com",
					mobile: "+15559876543",
					date_of_birth: "1980-01-01",
					title: { title: "CEO" },
					ownership_percentage: 75,
					owner_type: "CONTROL",
					address_line_1: "456 Owner Ave",
					address_city: "Owner City",
					address_state: "CA",
					address_postal_code: "90211",
					address_country: "US"
				}
			]
		};

		mockBusinessNames = [
			{ name: "Source Business LLC", is_primary: true },
			{ name: "Source DBA", is_primary: false }
		];

		mockBusinessAddresses = [
			{
				line_1: "123 Source St",
				apartment: "Suite 100",
				city: "Source City",
				state: "CA",
				country: "US",
				postal_code: "90210",
				mobile: "+15551234567",
				is_primary: true
			},
			{
				line_1: "789 Secondary Ave",
				apartment: "Suite 100",
				city: "Secondary City",
				state: "CA",
				country: "US",
				postal_code: "90212",
				mobile: null,
				is_primary: false
			}
		];

		// Mock service responses
		mockCaseService.internalGetCaseByID.mockResolvedValue(mockSourceCaseData);
		mockCaseService.getBusinessNames.mockResolvedValue(mockBusinessNames);
		mockCaseService.getBusinessAddresses.mockResolvedValue(mockBusinessAddresses);
		mockCaseService.getCustomFields.mockResolvedValue([]);
		mockOnboarding.getCustomerBusinessConfigs.mockResolvedValue([
			{ config: { skip_credit_check: true, bypass_ssn: false } }
		]);
		mockDecryptEin.mockReturnValue("123456789");
	});

	describe("cloneBusiness", () => {
		const mockParams = {
			customerID: "550e8400-e29b-41d4-a716-446655440001" as UUID,
			businessID: "550e8400-e29b-41d4-a716-446655440002" as UUID,
			caseID: "550e8400-e29b-41d4-a716-446655440003" as UUID
		};

		let executeBusinessCreationSpy: jest.SpyInstance;

		beforeEach(() => {
			// Set up spy before each test
			executeBusinessCreationSpy = jest.spyOn(CloneBusiness, "executeBusinessCreation").mockResolvedValue({
				business: { id: "new-business-123", name: "New Business LLC" } as Business.BusinessRecord,
				case: { id: "new-case-123" } as Case.CaseRecord,
				metadata: {}
			});
		});

		it("should build correct business payload with provided business details", async () => {
			const mockBody = {
				businessDetails: {
					name: "New Business Name",
					dba_name: "New DBA",
					tin: "987654321",
					address_line_1: "456 New St",
					address_city: "New City"
				},
				sectionsToClone: {}
			};

			await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(executeBusinessCreationSpy).toHaveBeenCalledTimes(1);
			const capturedPayload = executeBusinessCreationSpy.mock.calls[0][0] as Record<string, any>;

			expect(capturedPayload).toMatchObject({
				name: "New Business Name",
				dba1_name: "New DBA",
				tin: "987654321",
				address_line_1: "456 New St",
				address_city: "New City",
				quick_add: true,
				skip_credit_check: true,
				bypass_ssn: false
			});
			expect(capturedPayload.external_id).toBeDefined();
		});

		it("should fallback to source business data when business details not provided", async () => {
			const mockBody = {
				businessDetails: {},
				sectionsToClone: {}
			};

			await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(executeBusinessCreationSpy).toHaveBeenCalledTimes(1);
			const capturedPayload = executeBusinessCreationSpy.mock.calls[0][0] as Record<string, any>;

			expect(capturedPayload).toMatchObject({
				name: "Source Business LLC",
				tin: "123456789",
				address_line_1: "123 Source St",
				address_city: "Source City",
				address_state: "CA",
				address_postal_code: "90210",
				address_country: "US",
				industry: 18,
				naics_code: 123456,
				naics_title: "Software Development",
				mcc_code: 7372,
				official_website: "https://source.com",
				mobile: "+15551234567"
			});
		});

		it("should include DBA names from source business", async () => {
			const mockBody = {
				businessDetails: {},
				sectionsToClone: {}
			};

			await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(executeBusinessCreationSpy).toHaveBeenCalledTimes(1);
			const capturedPayload = executeBusinessCreationSpy.mock.calls[0][0] as Record<string, any>;

			expect(capturedPayload.dba1_name).toBe("Source DBA");
		});

		it("should include additional addresses from source business", async () => {
			const mockBody = {
				businessDetails: {},
				sectionsToClone: {}
			};

			await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(executeBusinessCreationSpy).toHaveBeenCalledTimes(1);
			const capturedPayload = executeBusinessCreationSpy.mock.calls[0][0] as Record<string, any>;

			expect(capturedPayload.address2_line_1).toBe("789 Secondary Ave");
			expect(capturedPayload.address2_city).toBe("Secondary City");
			expect(capturedPayload.address2_state).toBe("CA");
			expect(capturedPayload.address2_postal_code).toBe("90212");
		});

		it("should include ownership data when sectionsToClone.ownership is true", async () => {
			const mockBody = {
				businessDetails: {},
				sectionsToClone: { ownership: true }
			};

			await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(executeBusinessCreationSpy).toHaveBeenCalledTimes(1);
			const capturedPayload = executeBusinessCreationSpy.mock.calls[0][0] as Record<string, any>;

			expect(capturedPayload.owner1_first_name).toBe("John");
			expect(capturedPayload.owner1_last_name).toBe("Doe");
			expect(capturedPayload.owner1_ssn).toBe("123456789");
			expect(capturedPayload.owner1_email).toBe("john@example.com");
			expect(capturedPayload.owner1_ownership_percentage).toBe(75);
			expect(capturedPayload.owner1_owner_type).toBe("CONTROL");
		});

		it("should include custom fields when sectionsToClone.customFields is true", async () => {
			const mockCustomFields = [
				{
					field_code: "annual_revenue",
					value: "1000000",
					value_id: "123",
					customer_field_id: "456",
					template_id: "789",
					rules: {},
					type: "number"
				},
				{
					field_code: "industry_type",
					value: "technology",
					value_id: "123",
					customer_field_id: "456",
					template_id: "789",
					rules: {},
					type: "string"
				}
			];
			mockCaseService.getCustomFields.mockResolvedValue(mockCustomFields);

			const mockBody = {
				businessDetails: {},
				sectionsToClone: { customFields: true }
			};

			await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(executeBusinessCreationSpy).toHaveBeenCalledTimes(1);
			const capturedPayload = executeBusinessCreationSpy.mock.calls[0][0] as Record<string, any>;

			expect(capturedPayload["custom:annual_revenue"]).toBe("1000000");
			expect(capturedPayload["custom:industry_type"]).toBe("technology");
		});

		it("should pass correct audit context to executeBusinessCreation", async () => {
			const mockBody = {
				businessDetails: {},
				sectionsToClone: {}
			};

			await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(executeBusinessCreationSpy).toHaveBeenCalledTimes(1);
			const capturedAuditContext = executeBusinessCreationSpy.mock.calls[0][3];

			expect(capturedAuditContext).toMatchObject({
				sourceCaseID: "550e8400-e29b-41d4-a716-446655440003",
				sourceBusinessID: "550e8400-e29b-41d4-a716-446655440002",
				sourceBusinessName: "Source Business LLC",
				customerID: "550e8400-e29b-41d4-a716-446655440001",
				userID: "user-123"
			});
		});

		it("should remove empty string values from payload", async () => {
			const mockBody = {
				businessDetails: {
					name: "New Business",
					address_line_2: "" // Empty string should be removed
				},
				sectionsToClone: {}
			};

			await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(executeBusinessCreationSpy).toHaveBeenCalledTimes(1);
			const capturedPayload = executeBusinessCreationSpy.mock.calls[0][0] as Record<string, any>;

			expect(capturedPayload.address_line_2).toBeUndefined();
			expect(capturedPayload.tin).toBe("123456789");
		});

		it("should throw error when source case is not found", async () => {
			mockCaseService.internalGetCaseByID.mockResolvedValue(undefined as any);

			const mockBody = {
				businessDetails: {},
				sectionsToClone: {}
			};

			await expect(CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo)).rejects.toThrow(
				"Source case 550e8400-e29b-41d4-a716-446655440003 not found"
			);

			// Should not call executeBusinessCreation if source case not found
			expect(executeBusinessCreationSpy).not.toHaveBeenCalled();
		});

		it("should return correct response structure", async () => {
			const mockBody = {
				businessDetails: {},
				sectionsToClone: {}
			};

			const result = await CloneBusiness.cloneBusiness(mockParams, mockBody, mockUserInfo);

			expect(result).toEqual({
				businessId: "new-business-123",
				caseId: "new-case-123"
			});
		});
	});

	describe("buildDbaPayload", () => {
		it("should return provided dba_name when specified", () => {
			const result = CloneBusiness.buildDbaPayload(mockBusinessNames, "Custom DBA");
			expect(result).toEqual({ dba1_name: "Custom DBA" });
		});

		it("should build payload from non-primary business names", () => {
			const businessNames = [
				{ name: "Primary Business", is_primary: true },
				{ name: "First DBA", is_primary: false },
				{ name: "Second DBA", is_primary: false }
			];

			const result = CloneBusiness.buildDbaPayload(businessNames);
			expect(result).toEqual({
				dba1_name: "First DBA",
				dba2_name: "Second DBA"
			});
		});

		it("should return empty object when no business names provided", () => {
			const result = CloneBusiness.buildDbaPayload([]);
			expect(result).toEqual({});
		});
	});

	describe("buildAdditionalAddressesPayload", () => {
		it("should build payload from non-primary addresses", () => {
			const result = CloneBusiness.buildAdditionalAddressesPayload(mockBusinessAddresses);

			expect(result).toEqual({
				address2_line_1: "789 Secondary Ave",
				address2_apartment: "Suite 100",
				address2_city: "Secondary City",
				address2_state: "CA",
				address2_country: "US",
				address2_postal_code: "90212",
				address2_mobile: null
			});
		});

		it("should return empty object when no addresses provided", () => {
			const result = CloneBusiness.buildAdditionalAddressesPayload([]);
			expect(result).toEqual({});
		});

		it("should filter out addresses without line_1", () => {
			const addressesWithoutLine1 = [{ city: "No Line 1", is_primary: false, line_1: null }];

			const result = CloneBusiness.buildAdditionalAddressesPayload(addressesWithoutLine1 as any);
			expect(result).toEqual({});
		});
	});
});
