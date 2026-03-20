import { BulkUpdateBusinessMap } from "../bulkUpdateBusinessMap";
import { BusinessState } from "../../businessState";
import { type Business } from "#types";
import { businesses } from "../../businesses";
import { validateBusiness } from "../../validateBusiness";
import { maskString } from "#utils";

jest.mock("#utils/encryption", () => ({
	encryptEin: (ein: string) => `encrypted:${ein}`
}));

jest.mock("#utils", () => {
	const actual = jest.requireActual("#utils");
	// BulkUpdateBusinessMap imports `encryptEin` from `#utils/encryption`, but we also override it here
	// to guard against any indirect imports through `#utils` in other codepaths.
	return {
		...actual,
		encryptEin: (ein: string) => `encrypted:${ein}`
	};
});

jest.mock("../../validateBusiness", () => ({
	validateBusiness: jest.fn()
}));
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
describe("BulkUpdateBusinessMap.postValidate", () => {
	const samplePayload = {
		external_id: "2025-12-29:01",
		name: "Another Test",
		website: "https://www.staxpayments.com",
		tin: "222222226",
		dba1_name: "A Test For You",
		address2_line_1: "123 Main St",
		address2_city: "Worcseter",
		address2_state: "MA",
		address2_postal_code: "02915",
		address2_country: "US",
		bank_account_number: "12333333",
		bank_routing_number: "123456780",
		bank_account_subtype: "Savings",
		bank_account_type: "Savings",
		bank_name: "Bank of Matt"
	};

	const makeMapperField = (table: string, column: string, value: any, pathKey?: string) =>
		({
			table,
			column,
			value,
			pathKey
		}) as any;

	it("produces a diff and stores changes for a typical bulk update row", async () => {
		const originalState = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: {
				data_businesses: {
					id: "biz-1",
					name: "Old Name",
					tin: "111111111"
				} as any,
				data_cases: [],
				onboarding_case: undefined,
				rel_business_customer_monitoring: { external_id: "old-ext" } as any,
				data_business_addresses: [],
				data_business_names: [{ name: "Old Name", is_primary: true }],
				data_business_custom_fields: {},
				data_business_owners: []
			}
		});

		const mailingAddresses: Business.BusinessAddress[] = [
			{
				line_1: samplePayload.address2_line_1,
				apartment: undefined,
				city: samplePayload.address2_city,
				state: samplePayload.address2_state,
				country: samplePayload.address2_country,
				postal_code: samplePayload.address2_postal_code,
				mobile: undefined,
				is_primary: false
			}
		];

		const mapperFields = [
			makeMapperField("data_businesses", "name", samplePayload.name, "data_businesses.name"),
			makeMapperField("data_businesses", "tin", samplePayload.tin, "data_businesses.tin"),
			makeMapperField("data_businesses", "official_website", samplePayload.website, "data_businesses.official_website"),
			makeMapperField(
				"rel_business_customer_monitoring",
				"external_id",
				samplePayload.external_id,
				"rel_business_customer_monitoring.external_id"
			),
			// dba field uses metadata (pathKey contains [] so setPath will skip it)
			makeMapperField("data_business_names", "dba1_name", samplePayload.dba1_name, "data_business_names[].name")
		];

		const additionalMetadata = {
			originalState,
			dba_names: [{ name: samplePayload.dba1_name, is_primary: false }],
			mailing_addresses: mailingAddresses,
			owners: []
		};

		const addAdditionalMetadata = jest.fn();
		const mapperMock = {
			getMappedFields: () => mapperFields,
			getAdditionalMetadata: () => additionalMetadata,
			addAdditionalMetadata
		} as any;

		if (!BulkUpdateBusinessMap.MAP.postValidate) {
			throw new Error("BulkUpdateBusinessMap.MAP.postValidate is not defined");
		}
		await BulkUpdateBusinessMap.MAP.postValidate(mapperMock);

		expect(addAdditionalMetadata).toHaveBeenCalled();
		const callArg = addAdditionalMetadata.mock.calls[addAdditionalMetadata.mock.calls.length - 1]?.[0] || {};
		const changes = callArg.changes as Record<string, any>;
		expect(changes).toBeDefined();
		expect(changes["data_businesses.name"]).toBeDefined();
		expect(changes["data_businesses.tin"]).toBeDefined();
		expect(changes["rel_business_customer_monitoring.external_id"]).toBeDefined();
		expect(changes["data_business_addresses.__self"]).toBeDefined();
	});
});

describe("BulkUpdateBusinessMap.data_businesses.process", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(businesses, "updateBusiness").mockResolvedValue(undefined as any);
		jest.spyOn(businesses, "getBusinessByID").mockResolvedValue({ id: "biz-1" } as any);
		(validateBusiness as jest.Mock).mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("updates DBA names even when `name` is not provided in the row", async () => {
		const originalState = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: {
				data_businesses: {
					id: "biz-1",
					name: "Existing Legal Name",
					tin: "111111111"
				} as any,
				data_cases: [],
				onboarding_case: undefined,
				rel_business_customer_monitoring: { external_id: "old-ext" } as any,
				data_business_addresses: [],
				data_business_names: [{ name: "Existing Legal Name", is_primary: true }],
				data_business_custom_fields: {},
				data_business_owners: []
			}
		});

		const additionalMetadata = {
			originalState,
			data_businesses: { id: "biz-1", name: "Existing Legal Name", tin: "111111111" } as any,
			businessID: "biz-1",
			userID: "user-1",
			dba_names: [{ name: "New DBA", is_primary: false }],
			mailing_addresses: undefined,
			changes: {
				"data_business_names.__self": { previousValue: [], newValue: [{ name: "New DBA", is_primary: false }] }
			}
		};

		const mapperMock = {
			getAdditionalMetadata: () => additionalMetadata,
			addAdditionalMetadata: jest.fn(),
			getMappedValueForColumn: () => "user-1",
			getAuth: () => undefined
		} as any;

		const process = BulkUpdateBusinessMap.MAP.tables?.data_businesses?.process;
		if (!process) throw new Error("BulkUpdateBusinessMap.MAP.tables.data_businesses.process is not defined");

		// Simulate a row where only DBA fields were provided, so there are no mapped data_businesses fields.
		await process(mapperMock, [] as any);

		expect(businesses.updateBusiness).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "biz-1",
				name: "Existing Legal Name",
				dba_names: [{ name: "New DBA", is_primary: false }]
			})
		);
	});

	it("updates mailing addresses even when `name` is not provided in the row", async () => {
		const originalState = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: {
				data_businesses: {
					id: "biz-1",
					name: "Existing Legal Name",
					tin: "111111111"
				} as any,
				data_cases: [],
				onboarding_case: undefined,
				rel_business_customer_monitoring: { external_id: "old-ext" } as any,
				data_business_addresses: [],
				data_business_names: [{ name: "Existing Legal Name", is_primary: true }],
				data_business_custom_fields: {},
				data_business_owners: []
			}
		});

		const mailingAddresses: Business.BusinessAddress[] = [
			{
				line_1: "123 Main St",
				apartment: undefined,
				city: "Boston",
				state: "MA",
				country: "US",
				postal_code: "02110",
				mobile: undefined,
				is_primary: false
			}
		];

		const additionalMetadata = {
			originalState,
			data_businesses: { id: "biz-1", name: "Existing Legal Name", tin: "111111111" } as any,
			businessID: "biz-1",
			userID: "user-1",
			dba_names: undefined,
			mailing_addresses: mailingAddresses,
			changes: {
				"data_business_addresses.__self": { previousValue: [], newValue: mailingAddresses }
			}
		};

		const mapperMock = {
			getAdditionalMetadata: () => additionalMetadata,
			addAdditionalMetadata: jest.fn(),
			getMappedValueForColumn: () => "user-1",
			getAuth: () => undefined
		} as any;

		const process = BulkUpdateBusinessMap.MAP.tables?.data_businesses?.process;
		if (!process) throw new Error("BulkUpdateBusinessMap.MAP.tables.data_businesses.process is not defined");

		// Simulate a row where only address fields were provided, so there are no mapped data_businesses fields.
		await process(mapperMock, [] as any);

		expect(businesses.updateBusiness).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "biz-1",
				name: "Existing Legal Name"
			})
		);
		expect(validateBusiness).toHaveBeenCalledWith(
			"biz-1",
			expect.objectContaining({
				name: "Existing Legal Name",
				tin: "111111111",
				mailing_addresses: [
					expect.objectContaining({
						address_line_1: "123 Main St",
						address_city: "Boston",
						address_state: "MA",
						address_postal_code: "02110",
						address_country: "US"
					})
				]
			}),
			"user-1",
			expect.objectContaining({
				isBulk: true,
				shouldRunSerpSearch: true,
				userInfo: expect.objectContaining({ user_id: "user-1" })
			})
		);
	});

	it("encrypts TIN for updateBusiness but passes plaintext TIN to validateBusiness (when TIN provided explicitly)", async () => {
		const originalState = new BusinessState({
			id: "biz-1" as any,
			updatedAt: "2025-01-01T00:00:00.000Z",
			customerId: null,
			state: {
				data_businesses: {
					id: "biz-1",
					name: "Existing Legal Name",
					tin: "111111111"
				} as any,
				data_cases: [],
				onboarding_case: undefined,
				rel_business_customer_monitoring: { external_id: "old-ext" } as any,
				data_business_addresses: [],
				data_business_names: [{ name: "Existing Legal Name", is_primary: true }],
				data_business_custom_fields: {},
				data_business_owners: []
			}
		});

		const additionalMetadata = {
			originalState,
			data_businesses: { id: "biz-1", name: "Existing Legal Name", tin: "111111111" } as any,
			businessID: "biz-1",
			userID: "user-1",
			dba_names: undefined,
			mailing_addresses: undefined,
			changes: {
				"data_businesses.tin": { previousValue: "111111111", newValue: "012345678" },
				"data_businesses.official_website": { previousValue: null, newValue: "https://example.com" }
			}
		};

		const mapperMock = {
			getAdditionalMetadata: () => additionalMetadata,
			addAdditionalMetadata: jest.fn(),
			getMappedValueForColumn: () => "user-1",
			getAuth: () => undefined
		} as any;

		const process = BulkUpdateBusinessMap.MAP.tables?.data_businesses?.process;
		if (!process) throw new Error("BulkUpdateBusinessMap.MAP.tables.data_businesses.process is not defined");

		const mappedFields = [
			{ table: "data_businesses", column: "tin", value: "012345678" },
			{ table: "data_businesses", column: "official_website", value: "https://example.com" }
		] as any;

		await process(mapperMock, mappedFields);

		expect(businesses.updateBusiness).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "biz-1",
				// from our encryptEin mock
				tin: "encrypted:012345678"
			})
		);

		expect(validateBusiness).toHaveBeenCalledWith(
			"biz-1",
			expect.objectContaining({
				name: "Existing Legal Name",
				tin: "012345678"
			}),
			"user-1",
			expect.objectContaining({
				isBulk: true,
				userInfo: expect.objectContaining({ user_id: "user-1" })
			})
		);
	});
});

describe("BulkUpdateBusinessMap.sanitizeMetadata", () => {
	it("redacts ssn fields in serialized output", () => {
		const mapper = new BulkUpdateBusinessMap(new Map());
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
			changes: { "data_businesses.name": { previousValue: "A", newValue: "B" } }
		});

		const out: any = mapper.sanitizeMetadata();
		expect(out.owners?.[0]?.ssn).toBe(expected);
		expect(out.owners?.[0]?.last_four_of_ssn).toBe("6789");
		expect(out.integration_data?.owner1_ssn).toBe(expected);
		// sanitizeMetadata should also strip internal changes payload
		expect(out.changes).toBeUndefined();
	});
});
