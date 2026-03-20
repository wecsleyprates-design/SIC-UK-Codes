import { BUSINESS_STATUS } from "#constants";
import { businessLookupHelper } from "#helpers/businessLookupHelper";
import { BulkCreateBusinessMap } from "../bulkCreateBusinessMap";
import { db, getApplicantByID, getBusinessApplicants, sqlQuery } from "#helpers/index";
import { createTracker, type Tracker } from "knex-mock-client";
import { businesses } from "../../businesses";
import { Business } from "#types/business";
import { Mapper } from "../../mapper";
import { getApplicantConfigFields } from "../fields";
import { maskString } from "#utils";
jest.mock("kafkajs");
jest.mock("#utils/index", () => {
	const originalModule = jest.requireActual("#utils/index");
	return {
		...originalModule,
		encryptEin: jest.fn().mockImplementation((ein: string) => ein),
		decryptEin: jest.fn().mockImplementation((ein: string) => ein)
	};
});

jest.mock("#helpers/countryHelper", () => ({
	__esModule: true,
	isCountryAllowedWithSetupCheck: jest.fn().mockResolvedValue(true), // or false
	isUSBusiness: jest.fn().mockReturnValue(false) // optional if needed
}));

const enterpriseApplicantID = "1111-000-0000-0000-0000";

jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id",
		ENTERPRISE_APPLICANT_ID: enterpriseApplicantID
		// Other mocked configuration properties
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000, // 30*24*60*60
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60, // 10 minutes
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60 // 10 minutes
	}
}));
jest.mock("#helpers/businessLookupHelper");
jest.mock("#helpers/index", () => {
	const originalModule = jest.requireActual("#helpers/index");

	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		...originalModule,
		businessLookupHelper: jest.fn(),
		producer: {
			send: jest.fn()
		},
		getFlagValue: jest.fn(),
		sqlQuery: jest.fn(),
		getBusinessEntityVerificationDetails: jest.fn(),
		getBusinessApplicants: jest.fn(),
		getApplicantByID: jest.fn(),
		submitBusinessEntityForReview: jest.fn(),
		upsertBusinessOwnerApplicant: jest.fn(),
		isUSBusiness: jest.fn(),
		db: knex({ client: MockClient, dialect: "pg" }),
		BullQueue: jest.fn().mockImplementation(() => {
			return {};
		}),
		logger: {
			info: i => console.log(i),
			error: i => console.log(i),
			debug: i => console.debug(i),
			warn: i => console.debug(i)
		}
	};
});

describe("quickAdd", () => {
	let tracker: Tracker;

	beforeAll(() => {
		tracker = createTracker(db);
		// Owner validation calls Owners.getOwnerTitles() which queries core_owner_titles via knex.
		// If this isn't stubbed, knex-mock-client can leave the test awaiting an unresolved query.
		tracker.on.select("core_owner_titles").response([{ id: 1, title: "test title" }]);
		// Owner validation also calls businesses.getProgressionConfig(); keep this unit test isolated from onboarding SQL.
		jest.spyOn(businesses, "getProgressionConfig").mockResolvedValue([]);
	});

	afterEach(() => {
		jest.clearAllMocks(); // Clear mocks to reset between tests
		tracker.reset();
	});
	it("should return an existing business when TIN is provided", async () => {
		const enterpriseApplicantId = "1111-000-0000-0000-0000-0000";
		const externalId = "0b57f6a0-f93b-4008-9c7c-451b91ad9463";
		const payload = {
			external_id: externalId,
			name: "Tacos My Friend",
			tin: "453121232",
			quick_add: true,
			address_line_1: "3899 Recker Highway ",
			address_postal_code: "33880",
			address_city: "Winter Haven",
			address_state: "Florida",
			address_country: "USA",
			dba1: "Tacos",
			aging_config: JSON.stringify({
				thresholds: { low: 30, medium: 60, high: 100 },
				custom_messages: {
					low: "Please complete your application soon.",
					medium: "Your application has been pending for some time — please review missing details.",
					high: "Your application is overdue and may be closed soon if no action is taken."
				}
			})
		};
		const newBusiness = {
			...payload,
			id: "000000-0000-4444-0000-0000",
			created_at: "2024-09-11T00:00:00.000Z",
			status: BUSINESS_STATUS.UNVERIFIED,
			updated_at: "2024-09-11T00:00:00.000Z",
			created_by: enterpriseApplicantId,
			updated_by: enterpriseApplicantId,
			mobile: "1234567890"
		} as Business.Record;
		jest.spyOn(businesses, "createBusinessFromEgg").mockResolvedValue(newBusiness);
		jest.spyOn(businesses, "getBusinessByID").mockResolvedValue(newBusiness as unknown as any);
		(sqlQuery as jest.Mock).mockResolvedValue({
			rows: [
				{
					config: [
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
					],
					source: "core"
				}
			]
		});
		const customerID = "1111111-1111-1111-1111-111111111111";
		const existingBusiness = {
			id: "000000-0000-5555-0000-0000",
			tin: "453121232",
			name: "Existing Business",
			status: BUSINESS_STATUS.VERIFIED
		};
		const inputMap = new Map<string, any>(Object.entries(payload));
		(businessLookupHelper as jest.Mock).mockImplementation(async args => {
			if (args.tin) {
				return existingBusiness;
			} else if (args.externalID) {
				// This is happy path
				throw new Error("Business not found");
			}
			return newBusiness;
		});

		tracker.on.select("data_cases").response([{ id: "0000-0000-0000-0000-0000" }]);
		tracker.on.select("rel_business_customer_monitoring").response([]);
		tracker.on.insert("rel_business_customer_monitoring").response([
			{
				customer_id: customerID,
				external_id: externalId,
				business_id: newBusiness.id,
				is_monitoring_enabled: true
			}
		]);
		// Mock for data_business_applicant_configs select query (used by applicantConfig.addOrUpdateApplicantConfigForBusiness)
		tracker.on.select("data_business_applicant_configs").response([
			{
				config: [
					{ urgency: "low", threshold: 7, allowed_case_status: [1, 2], message: "Default low urgency message" },
					{ urgency: "medium", threshold: 14, allowed_case_status: [1, 2], message: "Default medium urgency message" },
					{ urgency: "high", threshold: 30, allowed_case_status: [1, 2], message: "Default high urgency message" }
				],
				source: "core"
			}
		]);
		tracker.on.insert("data_business_applicant_configs").response([1]);

		jest.spyOn(businesses, "updateBusinessDetails").mockResolvedValue();
		(getBusinessApplicants as jest.Mock).mockImplementation(async businessID => {
			if (businessID === existingBusiness.id) {
				return [];
			}
			return [];
		});
		(getApplicantByID as jest.Mock).mockResolvedValue({
			id: enterpriseApplicantId,
			email: "enterprise@joinworth.com",
			mobile: "12345",
			first_name: "Enterprise",
			last_name: "Applicant",
			status: "ACTIVE",
			code: "owner",
			subrole_id: enterpriseApplicantId
		});

		const mapper = new BulkCreateBusinessMap(inputMap);
		mapper.setAdditionalMetadata({ userID: enterpriseApplicantID, customerID: customerID, riskMonitoring: true });
		await mapper.execute();
		const metadata = mapper.getAdditionalMetadata();
		expect(metadata).toHaveProperty("data_businesses");
		expect(metadata).toHaveProperty("integration_data");
		expect(metadata.data_businesses.id).toBe(newBusiness.id);
	});
});

class BulkCreateBusinessMapUnderTest extends BulkCreateBusinessMap {
	constructor(input: Map<string, any>, runId = "abc", threshold = 0.2) {
		super(input, runId, threshold);
		this.setAdditionalMetadata({ userID: "test-user-id", customerID: "test-customer-id", riskMonitoring: true });
	}
}

describe("bulkCreateBusinessMap internal mapping functionality", () => {
	let tracker: Tracker;

	(businessLookupHelper as jest.Mock).mockImplementation(async () => {
		// This is happy path
		throw new Error("Business not found");
	});

	beforeAll(() => {
		tracker = createTracker(db);
		tracker.on.select("core_owner_titles").response([{ id: 1, title: "test title" }]);
	});

	const getRequest = (overrides = {}) => {
		return {
			external_id: "testRecord",
			name: "test record",
			owner1_ssn: "123456789",
			address_line1: "123 MAIN ST",
			owner1_first_name: "USA 2",
			City: "WESTPORT",
			State: "MA",
			Zip: "2790",
			owner1_last_name: "Johnson",
			owner1_email: "test@gmail.com",
			owner1_mobile: "5088636908",
			owner1_date_of_birth: "1973-07-04",
			owner1_address_line1: "Kidds Hill",
			owner1_address_line_2: "",
			owner1_address_city: "San Francisco",
			owner1_address_state: "CA",
			owner1_address_postal_code: "90210",
			owner1_address_country: "US",
			owner1_ownership_percentage: "0.00",
			owner1_owner_type: "BENEFICIARY",
			...overrides
		};
	};

	const phoneScenarios = [
		["normal us phone number", { owner1_mobile: "5088636908" }, "15088636908"],
		["us phone with non alphanumerics", { owner1_mobile: "(508) 863-6908" }, "15088636908"],
		["british phone with country code", { owner1_mobile: "+4400123456477 " }, "+4400123456477"],
		["mexican phone number with country code", { owner1_mobile: "+52 1234567890" }, "+521234567890"]
	];
	phoneScenarios.forEach(([scenario, overrides, expected]) => {
		it(`phone mapping scenario: ${scenario} : ${expected}`, async () => {
			const request = getRequest(overrides);
			const mapper = new BulkCreateBusinessMapUnderTest(new Map(Object.entries(request)));
			const match = await mapper.match();
			expect(match.mapped.owner1_mobile.value).toBe(expected);
		});
	});

	const tinScenarios = [
		["US TIN with formatting strips non-digits", { tin: "123-45-6789" }, "123456789"],
		["US TIN shorter input strips non-digits (no padding)", { tin: "12-345678" }, "12345678"],
		["TIN via alternate key tax_id maps + sanitizes", { tax_id: "12-345678" }, "12345678"],
		["International tax id keeps alphanumeric uppercase", { tin: "ab-12 3" }, "AB123"]
	];
	tinScenarios.forEach(([scenario, overrides, expected]) => {
		it(`tin mapping scenario: ${scenario}`, async () => {
			const request = getRequest(overrides);
			const mapper = new BulkCreateBusinessMapUnderTest(new Map(Object.entries(request)));
			const match = await mapper.match();
			// match.mapped is keyed by the provided key
			const key = Object.keys(overrides as any)[0]!;
			expect(match.mapped[key].value).toBe(expected);
		});
	});
});

describe("BulkCreateBusinessMap.sanitizeMetadata", () => {
	it("redacts ssn fields in serialized output", () => {
		const mapper = new BulkCreateBusinessMapUnderTest(new Map());
		const expected = maskString("123456789");
		mapper.setAdditionalMetadata({
			owners: [
				{
					id: "owner-1",
					first_name: "Jane",
					last_name: "Doe",
					ssn: "123456789",
					last_four_of_ssn: "6789"
				}
			],
			integration_data: {
				owner1_ssn: "123456789",
				owner1_dob: "2000-10-17"
			},
			business_customer: {
				metadata: {
					owner1_ssn: "123456789"
				}
			}
		});

		const out: any = mapper.sanitizeMetadata();
		expect(out.owners?.[0]?.ssn).toBe(expected);
		expect(out.owners?.[0]?.last_four_of_ssn).toBe("6789");
		expect(out.integration_data?.owner1_ssn).toBe(expected);
		expect(out.business_customer?.metadata?.owner1_ssn).toBe(expected);
	});
});

describe("data_business_applicant_configs - agingConfigFields", () => {
	const agingConfigField = getApplicantConfigFields()[0];
	const mockMapper = {} as Mapper;

	describe("sanitize function", () => {
		it("should return null for null input", async () => {
			const result = await agingConfigField.sanitize!(mockMapper, null);
			expect(result).toBeNull();
		});

		it("should return null for undefined input", async () => {
			const result = await agingConfigField.sanitize!(mockMapper, undefined);
			expect(result).toBeNull();
		});

		it("should return null for empty string input", async () => {
			const result = await agingConfigField.sanitize!(mockMapper, "");
			expect(result).toBeNull();
		});

		it("should parse valid JSON string with thresholds and custom_messages", async () => {
			const validConfig = JSON.stringify({
				thresholds: { low: 7, medium: 14, high: 30 },
				custom_messages: {
					low: "Low urgency message",
					medium: "Medium urgency message",
					high: "High urgency message"
				}
			});
			const result = await agingConfigField.sanitize!(mockMapper, validConfig);
			expect(result).toEqual({
				thresholds: { low: 7, medium: 14, high: 30 },
				custom_messages: {
					low: "Low urgency message",
					medium: "Medium urgency message",
					high: "High urgency message"
				}
			});
		});

		it("should parse valid JSON string with only thresholds", async () => {
			const validConfig = JSON.stringify({
				thresholds: { low: 10, medium: 20, high: 50 }
			});
			const result = await agingConfigField.sanitize!(mockMapper, validConfig);
			expect(result).toEqual({
				thresholds: { low: 10, medium: 20, high: 50 }
			});
		});

		it("should accept valid object input directly", async () => {
			const validConfig = {
				thresholds: { low: 5, medium: 15, high: 25 },
				custom_messages: { low: "Test message" }
			};
			const result = await agingConfigField.sanitize!(mockMapper, validConfig);
			expect(result).toEqual(validConfig);
		});

		it("should return null for invalid JSON string", async () => {
			const result = await agingConfigField.sanitize!(mockMapper, "{ invalid json }");
			expect(result).toBeNull();
		});

		it("should return null for config missing thresholds", async () => {
			const invalidConfig = JSON.stringify({
				custom_messages: { low: "Message" }
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null when thresholds is not an object", async () => {
			const invalidConfig = JSON.stringify({
				thresholds: "not an object"
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null when threshold.low is not a number", async () => {
			const invalidConfig = JSON.stringify({
				thresholds: { low: "seven", medium: 14, high: 30 }
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null when threshold.medium is not a number", async () => {
			const invalidConfig = JSON.stringify({
				thresholds: { low: 7, medium: "fourteen", high: 30 }
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null when threshold.high is not a number", async () => {
			const invalidConfig = JSON.stringify({
				thresholds: { low: 7, medium: 14, high: "thirty" }
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null when custom_messages is not an object", async () => {
			const invalidConfig = JSON.stringify({
				thresholds: { low: 7, medium: 14, high: 30 },
				custom_messages: "not an object"
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null when custom_messages.low is not a string", async () => {
			const invalidConfig = JSON.stringify({
				thresholds: { low: 7, medium: 14, high: 30 },
				custom_messages: { low: 123 }
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null when custom_messages.medium is not a string", async () => {
			const invalidConfig = JSON.stringify({
				thresholds: { low: 7, medium: 14, high: 30 },
				custom_messages: { medium: { nested: "object" } }
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null when custom_messages.high is not a string", async () => {
			const invalidConfig = JSON.stringify({
				thresholds: { low: 7, medium: 14, high: 30 },
				custom_messages: { high: ["array", "value"] }
			});
			const result = await agingConfigField.sanitize!(mockMapper, invalidConfig);
			expect(result).toBeNull();
		});

		it("should return null for non-string and non-object input", async () => {
			const result = await agingConfigField.sanitize!(mockMapper, 12345);
			expect(result).toBeNull();
		});

		it("should accept partial thresholds", async () => {
			const partialConfig = {
				thresholds: { low: 5 }
			};
			const result = await agingConfigField.sanitize!(mockMapper, partialConfig);
			expect(result).toEqual(partialConfig);
		});

		it("should accept partial custom_messages", async () => {
			const partialConfig = {
				thresholds: { low: 5, medium: 10, high: 20 },
				custom_messages: { high: "Only high message" }
			};
			const result = await agingConfigField.sanitize!(mockMapper, partialConfig);
			expect(result).toEqual(partialConfig);
		});
	});

	describe("validate function", () => {
		it("should pass validation for valid threshold ordering (low < medium < high)", async () => {
			const field = {
				...agingConfigField,
				value: {
					thresholds: { low: 7, medium: 14, high: 30 }
				}
			};
			await expect(agingConfigField.validate!(mockMapper, field)).resolves.not.toThrow();
		});

		it("should pass validation when field value is null", async () => {
			const field = {
				...agingConfigField,
				value: null
			};
			await expect(agingConfigField.validate!(mockMapper, field)).resolves.not.toThrow();
		});

		it("should pass validation when field value is undefined", async () => {
			const field = {
				...agingConfigField,
				value: undefined
			};
			await expect(agingConfigField.validate!(mockMapper, field)).resolves.not.toThrow();
		});

		it("should fail validation when low >= medium", async () => {
			const field = {
				...agingConfigField,
				value: {
					thresholds: { low: 20, medium: 14, high: 30 }
				}
			};
			await expect(agingConfigField.validate!(mockMapper, field)).rejects.toThrow();
		});

		it("should fail validation when medium >= high", async () => {
			const field = {
				...agingConfigField,
				value: {
					thresholds: { low: 7, medium: 35, high: 30 }
				}
			};
			await expect(agingConfigField.validate!(mockMapper, field)).rejects.toThrow();
		});

		it("should fail validation when low equals medium", async () => {
			const field = {
				...agingConfigField,
				value: {
					thresholds: { low: 10, medium: 10, high: 30 }
				}
			};
			await expect(agingConfigField.validate!(mockMapper, field)).rejects.toThrow();
		});

		it("should fail validation when medium equals high", async () => {
			const field = {
				...agingConfigField,
				value: {
					thresholds: { low: 5, medium: 20, high: 20 }
				}
			};
			await expect(agingConfigField.validate!(mockMapper, field)).rejects.toThrow();
		});

		it("should fail validation when any threshold is negative", async () => {
			const field = {
				...agingConfigField,
				value: {
					thresholds: { low: -1, medium: 14, high: 30 }
				}
			};
			await expect(agingConfigField.validate!(mockMapper, field)).rejects.toThrow();
		});

		it("should pass validation with zero as low threshold", async () => {
			const field = {
				...agingConfigField,
				value: {
					thresholds: { low: 0, medium: 14, high: 30 }
				}
			};
			await expect(agingConfigField.validate!(mockMapper, field)).resolves.not.toThrow();
		});

		it("should pass validation with large threshold values", async () => {
			const field = {
				...agingConfigField,
				value: {
					thresholds: { low: 100, medium: 200, high: 365 }
				}
			};
			await expect(agingConfigField.validate!(mockMapper, field)).resolves.not.toThrow();
		});
	});

	describe("field configuration", () => {
		it("should have correct column name", () => {
			expect(agingConfigField.column).toBe("aging_config");
		});

		it("should have correct table name", () => {
			expect(agingConfigField.table).toBe("data_business_applicant_configs");
		});

		it("should have correct data type", () => {
			expect(agingConfigField.dataType).toBe("json");
		});

		it("should not be required", () => {
			expect(agingConfigField.required).toBe(false);
		});
	});
});

describe("expected validation input -> output", () => {
	// Mock validateBusiness
	/*
	jest.mock("../../validateBusiness", () => ({
		validateBusiness: jest.fn()
	}));
*/
	const inputScenario: Array<Record<string, any>> = [
		{
			external_id: "4a2fg0123-e4676-aa3-f4a354c557aa",
			tin: "111222333",
			name: "Central Irrrrigation Supply Pvtt Lttd",
			address_line_1: "8 Williams Street",
			address_city: "Elmsford",
			address_state: "NY",
			address_postal_code: "10523",
			bank_account_number: "0000000001",
			bank_name: "Plaid Checking",
			institution_name: "Chase",
			bank_routing_number: "021000021",
			bank_wire_routing_number: "026009593",
			bank_official_name: "Plaid Gold Standard 0% Interest Checking",
			bank_account_type: "depository",
			bank_account_subtype: "checking",
			bank_account_balance_current: 110.0,
			bank_account_balance_available: 100.0,
			bank_account_balance_limit: 0,
			annual_total_income: 250000.0,
			owner1_title: "Partner",
			owner1_first_name: "Leslie",
			owner1_last_name: "Knope",
			owner1_mobile: "2345678900",
			owner1_ssn: "123456789",
			owner1_dob: "1975-01-18",
			owner1_address_line_1: "123 Main St.",
			owner1_address_city: "Pawnee",
			owner1_address_state: "IN",
			owner1_address_postal: "46001",
			owner1_address_country: "US",
			owner1_owner_type: "CONTROL",
			owner1_ownership_percentage: 0,
			owner2_title: "Director",
			owner2_first_name: "Leslief",
			owner2_last_name: "Knopef",
			owner2_mobile: "2345678900",
			owner2_ssn: "123456289",
			owner2_dob: "02/20/1980",
			owner2_address_line_1: "123 Main St.",
			owner2_address_city: "Pawnee",
			owner2_address_state: "IN",
			owner2_address_postal: "46001",
			owner2_address_country: "USA",
			owner2_owner_type: "BENEFICIARY",
			owner2_ownership_percentage: 25
		}
	];
	inputScenario.forEach(scenario => {
		it(`bulk map scenario: ${scenario.external_id}`, async () => {
			const mapper = new BulkCreateBusinessMap(new Map(Object.entries(scenario)));
			await mapper.match();
			expect(mapper.toApiResponse()).toMatchSnapshot();
		});
	});
});
