import { CONNECTION_STATUS, DIRECTORIES, INTEGRATION_ID } from "#constants";
import type { IBusinessIntegrationTaskEnriched, IDBConnection, TDateISO } from "#types";
import { type ZoomInfoFirmographicsEvent } from "@joinworth/types/dist/types/kafka/entity_matching.v1/FirmographicsEvent";
import { ZoomInfo } from "../zoominfo";
import type { ZoomInfoEntityMatchTask } from "../types";

// Mock taskQueue to prevent the entire import chain that leads to OpenAI
jest.mock("#workers/taskHandler", () => ({
	taskQueue: {
		add: jest.fn(),
		process: jest.fn(),
		on: jest.fn()
	}
}));

// Mock kafkaToQueue function
jest.mock("#messaging/index", () => ({
	kafkaToQueue: jest.fn()
}));

// Mock specific helper functions
jest.mock("#helpers", () => ({
	...jest.requireActual("#helpers"),
	getOrCreateConnection: jest.fn(),
	platformFactory: jest.fn(),
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn()
	}
}));

class ZoomInfoUnderTest extends ZoomInfo {
	constructor(dbConnection: IDBConnection) {
		super(dbConnection);
	}
	saveRequestResponse = jest.fn().mockResolvedValue(undefined);
	updateTask = jest.fn().mockResolvedValue(undefined);
	saveToS3 = jest.fn().mockResolvedValue(undefined);
	convertKafkaEventPayloadToLegacyMetadata = jest.fn().mockReturnValue({
		match_id: "0000-0000-0000-0000-0000",
		prediction: 0,
		match: null,
		all_matches: null,
		match_mode: "ai",
		firmographic: {
			company_number: "L18000057850",
			jurisdiction_code: "us_fl"
		}
	});
}

describe("BEST-64: ZoomInfo Entity Matching", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	const businessID = "0000-0000-0000-0000-0000";
	const dbConnection: IDBConnection = {
		id: "1111-0000-0000-0000-0000",
		business_id: businessID,
		platform_id: INTEGRATION_ID.ZOOMINFO,
		connection_status: CONNECTION_STATUS.SUCCESS,
		created_at: new Date().toISOString() as TDateISO,
		updated_at: new Date().toISOString() as TDateISO,
		configuration: {}
	};
	const zoomInfo = new ZoomInfoUnderTest(dbConnection);

	it("should process entity matching", async () => {
		const taskId = "0000-0000-0000-0000-9999";
		const externalId = "1235:789:22222";

		const task = { id: taskId, metadata: {} } as unknown as IBusinessIntegrationTaskEnriched<ZoomInfoEntityMatchTask>;
		const payload = generateZI();
		const metadata = {
			all_matches: null,
			firmographic: payload.firmographics?.comp_standard_global[0],
			match: null,
			match_mode: "ai",
			match_id: undefined,
			prediction: null
		};

		const result = await zoomInfo.processFirmographicsEvent(task, payload);
		expect(result).toBe(undefined);
		expect(zoomInfo.saveRequestResponse).toHaveBeenCalledWith(task, expect.objectContaining({ firmographic: expect.objectContaining(payload.firmographics?.comp_standard_global[0]) }), externalId);
		expect(zoomInfo.updateTask).toHaveBeenCalledWith(taskId, {
			reference_id: externalId,
			metadata: expect.objectContaining({ firmographic: expect.objectContaining(payload.firmographics?.comp_standard_global[0]) })
		});
		expect(zoomInfo.saveToS3).toHaveBeenCalledWith(
			expect.objectContaining({ firmographic: expect.objectContaining(payload.firmographics?.comp_standard_global[0]) }),
			"match",
			DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
			"ZOOMINFO"
		);
	});
});

const generateZI = (args = {}): ZoomInfoFirmographicsEvent => {
	return {
		collected_at: "2025-09-02T15:00:37.919422Z",
		business_id: "b644680a-e43d-464b-8ae3-4d3c06021236",
		source: "zoominfo",
		firmographics: {
			comp_standard_global: [
				{
					zi_c_location_id: 789,
					zi_c_company_id: 1235,
					zi_es_location_id: "22222",
					zi_es_ecid: 12345,
					zi_c_is_hq: "0",
					zi_c_tier_grade: "A",
					zi_c_name: "ZoomInfo",
					zi_c_name_display: "ZoomInfo",
					zi_c_legal_entity_type: "Corporation",
					zi_c_url: "https://www.zoominfo.com",
					zi_c_street: "123 Main St",
					zi_c_street_2: "Apt 4B",
					zi_c_city: "New York",
					zi_c_state: "NY",
					zi_c_zip: "10001",
					zi_c_country: "United States",
					zi_c_cbsa_name: "New York-Newark-Jersey City",
					zi_c_county: "New York County",
					zi_c_latitude: 40.7128,
					zi_c_longitude: -74.006,
					zi_c_verified_address: "0",
					zi_c_employee_range: "1-100",
					zi_c_employees: 50,
					zi_c_revenue_range: "1-100M",
					zi_c_revenue: 50000000,
					zi_c_phone: "123-456-7890",
					zi_c_fax: "123-456-7891",
					zi_c_industry_primary: "Software",
					zi_c_sub_industry_primary: "Cloud Computing",
					zi_c_industries: "Software, Cloud Computing",
					zi_c_sub_industries: "Cloud Computing",
					zi_es_industry: "Software",
					zi_es_industries_top3: "Software, Cloud Computing",
					zi_c_naics2: "54",
					zi_c_naics4: "5411",
					zi_c_naics6: "541110",
					zi_c_naics_top3: "541110",
					zi_c_sic2: "73",
					zi_c_sic3: "737",
					zi_c_sic4: "7372",
					zi_c_sic_top3: "7372",
					zi_c_estimated_age: 10,
					zi_c_year_founded: "2000",
					zi_c_is_b2b: "0",
					zi_c_is_b2c: "1",
					zi_es_hq_ecid: 12345,
					zi_es_hq_location_id: "22222",
					zi_c_company_name: "ZoomInfo",
					zi_c_company_url: "https://www.zoominfo.com",
					zi_c_company_street: "123 Main St",
					zi_c_company_street_2: "Apt 4B",
					zi_c_company_city: "New York",
					zi_c_company_state: "NY",
					zi_c_company_zip: "10001",
					zi_c_company_country: "United States",
					zi_c_company_cbsa_name: "New York-Newark-Jersey City",
					zi_c_company_county: "New York County",
					zi_c_company_latitude: 40.7128,
					zi_c_company_longitude: -74.006,
					zi_c_company_verified_address: "0",
					zi_c_company_employee_range: "1-100",
					zi_c_company_employees: 50,
					zi_c_company_revenue_range: "1-100M",
					zi_c_company_revenue: 50000000,
					zi_c_company_phone: "123-456-7890",
					zi_c_company_fax: "123-456-7891",
					zi_c_linkedin_url: null,
					zi_c_facebook_url: null,
					zi_c_twitter_url: null,
					zi_c_yelp_url: null,
					zi_c_domain_rank: null,
					zi_c_keywords: "",
					zi_c_top_keywords: null,
					zi_c_num_keywords: null,
					zi_c_employee_growth_1yr: null,
					zi_c_employee_growth_2yr: null,
					zi_es_growth: null,
					zi_es_employee_growth: null,
					zi_es_revenue_growth: null,
					zi_es_percent_employee_growth: null,
					zi_es_percent_revenue_growth: null,
					zi_c_name_confidence_score: null,
					zi_c_url_confidence_score: null,
					zi_c_address_confidence_score: 85,
					zi_c_phone_confidence_score: null,
					zi_c_employees_confidence_score: null,
					zi_c_revenue_confidence_score: null,
					zi_es_industry_confidence_score: null,
					zi_c_naics_confidence_score: null,
					zi_c_sic_confidence_score: null,
					zi_es_industries_top3_confidence_scores: "",
					zi_c_naics_top3_confidence_scores: "",
					zi_c_sic_top3_confidence_scores: "",
					zi_c_ids_merged: "",
					zi_c_names_other: null,
					zi_c_url_status: "",
					zi_c_urls_alt: null,
					zi_c_url_last_updated: null,
					zi_c_inactive_flag: "0",
					zi_c_ein: null,
					zi_c_is_small_business: "0",
					zi_c_is_public: "0",
					zi_c_ticker: null,
					zi_c_tickers_alt: null,
					zi_c_has_mobile_app: "0",
					zi_c_currency_code: "USD",
					zi_c_num_locations: 1,
					zi_c_hr_contacts: null,
					zi_c_sales_contacts: null,
					zi_c_marketing_contacts: null,
					zi_c_finance_contacts: null,
					zi_c_c_suite_contacts: null,
					zi_c_engineering_contacts: null,
					zi_c_it_contacts: null,
					zi_c_operations_contacts: null,
					zi_c_legal_contacts: null,
					zi_c_medical_contacts: null,
					zi_c_tech_ids: "",
					zi_c_latest_funding_age: null,
					zi_c_num_of_investors: null,
					zi_c_investor_names: null,
					zi_c_funding_strength: null,
					zi_c_funding_type: null,
					zi_c_total_funding_amount: null,
					zi_c_latest_funding_amount: null,
					zi_c_latest_funding_date: null,
					zi_c_num_funding_rounds: null,
					zi_c_is_fortune_100: "0",
					zi_c_is_fortune_500: "0",
					zi_c_is_s_and_p_500: "0",
					zi_c_last_updated_date: "2025-01-10",
					zi_c_release_date: "2025-01-10"
				}
			]
		},
		...args
	} as ZoomInfoFirmographicsEvent;
};
